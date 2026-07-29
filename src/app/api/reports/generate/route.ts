import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getPolicyDetailById, fetchFlagsByPolicyId, PolicyDetail, PolicyFlagRow } from '@/lib/api';
import { authenticateRequest, isAuthError } from '@/lib/apiAuth';

/**
 * Expected schema from the GPT-4o report synthesizer (v3 — compact client-facing).
 *
 * Changes from v2:
 *  - executive_summary: tighter (2-4 sentences)
 *  - top_concerns: shorter explanations
 *  - coverage_review: shorter observations
 *  - property_observations: retained for agent-only internal review
 *  - data_gaps / recommendations / action_items: retained for backwards compat,
 *    but the client report merges them into "Next Steps"
 *  - internal_notes: NEW — agent-only observations
 */
interface AIReportInsights {
    executive_summary: string;
    renewal_snapshot: string;
    top_concerns: Array<{
        topic: string;
        explanation: string;
        severity: 'high' | 'medium' | 'low';
        source: string;
        evidence: string;
    }>;
    coverage_review: Array<{
        coverage: string;
        current_value: string;
        observation: string;
        adequacy: 'adequate' | 'review' | 'gap' | 'unknown';
    }>;
    property_observations: Array<{
        observation: string;
        source: string;
        confidence: string;
        discrepancy: string;
    }>;
    data_gaps: Array<{
        field: string;
        impact: string;
        suggestion: string;
    }>;
    recommendations: Array<{
        text: string;
        category: 'discuss' | 'verify' | 'review' | 'consider_coverage';
        priority: number;
        source: string;
    }>;
    action_items: Array<{
        item: string;
        type: 'confirm' | 'discuss' | 'update' | 'verify';
        urgency: 'before_renewal' | 'at_renewal' | 'when_convenient';
    }>;
    internal_notes: string;
}

export async function POST(req: NextRequest) {
    const auth = await authenticateRequest(req, { requiredRole: ['admin', 'service'] });
    if (isAuthError(auth)) return auth;

    try {
        const body = await req.json();
        const { policyId } = body;

        if (!policyId) {
            return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Gather all required data
        const policy: PolicyDetail | undefined = await getPolicyDetailById(policyId);
        if (!policy) {
            return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
        }

        const flags: PolicyFlagRow[] = await fetchFlagsByPolicyId(policyId) || [];

        // Fetch enrichments for this policy directly using Admin
        const { data: enrichmentsData } = await supabase
            .from('property_enrichments')
            .select('*')
            .eq('policy_id', policyId);

        const enrichments = enrichmentsData || [];

        // 2. Build deterministic JSON payload (Layer 1)
        const dataPayload = {
            policy,
            flags: flags.map(f => ({
                code: f.code,
                title: f.title,
                severity: f.severity,
                status: f.status,
                source: f.source
            })),
            enrichments: enrichments.map((e: any) => ({
                key: e.field_key,
                value: e.field_value,
                confidence: e.confidence,
                source: e.source_name,
                notes: e.notes
            }))
        };

        // 3. Prompt GPT-4o for Synthesis (Layer 2)
        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            console.warn('OPENAI_API_KEY missing - saving draft report without AI insights');
            return saveAndReturnReport(policyId, policy.client_id, dataPayload, {
                executive_summary: "AI analysis unavailable (Missing API Key). Review the raw data below.",
                renewal_snapshot: "AI overview unavailable.",
                top_concerns: [],
                coverage_review: [],
                property_observations: [],
                data_gaps: [],
                recommendations: [],
                action_items: [],
                internal_notes: ""
            });
        }

        const systemPrompt = `
You are creating a COMPACT, CLIENT-FACING coverage comparison report for an insurance brokerage.
This report will be shared with the client. It must be clear, professional, concise, and non-judgmental.

AUDIENCE: Homeowners and policyholders. Use plain language. No jargon.

STRICT MANDATORY RULES:
1. EVERYTHING MUST BE SOURCED: Every top concern, coverage review item, property observation, and recommendation MUST explicitly specify its source (e.g., "2026 Policy Declaration", "Replacement Cost Estimate (RCE)", "County Assessor Data").
2. DO NOT DETERMINE COVERAGE ADEQUACY: Never state, imply, or judge whether coverage is "adequate", "inadequate", "sufficient", or "deficient". Determining adequacy creates liability. Your job is ONLY to explain where we found coverage on their previous policy and point out differences or optional coverages that may be missing.
3. NEUTRAL & COMPARATIVE TONE: Frame findings neutrally: "On your previous policy, X limit was $Y. An option to adjust to $Z is available to evaluate." or "This endorsement was not present on your prior dec page."
4. NO GUARANTEES: Never reassure the client that they are "fully protected" or "properly covered".
5. CLIENT RESPONSIBILITY: Frame all recommendations as options for the client to review and decide upon.
6. BE CONCISE: Executive summary max 3 sentences. Observations 10-15 words max.

EXCLUSIONS AND GUARDRAILS:
1. NO FIRE RISK: NEVER mention fire risk, fire scores, or wildfire scores in any section. Completely suppress these findings.
2. NO IMAGERY NOTES: NEVER mention satellite image quality or photo limitations.
3. NO INSPECTION NOTES: NEVER recommend visual, property, or field inspections.
4. NO "APPROVED VENDOR": DO NOT use the phrase "with an approved vendor". Simply state "Review replacement cost estimate".
5. NO REASSURANCE: NEVER use words like "adequate", "inadequate", "sufficient", "properly covered", "looks good", or "coverage is good".
6. SOURCED COMPARISON ONLY: Every recommendation must cite what data source triggered the observation.

VALUATION DATA GUIDANCE:
- If replacement cost estimate is available, frame as: "Based on available RCE document, estimated replacement cost is $X. You may review this estimate."
- NEVER present estimates as authoritative.

Data Context:
${JSON.stringify(dataPayload, null, 2)}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                temperature: 0.1,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Generate the structured report. Be concise — the client report should feel tight and premium, not verbose.' }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'report_insights_v3',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                executive_summary: {
                                    type: 'string',
                                    description: '2-3 sentence overview. Lead with the biggest finding. State overall risk. Max 50 words.'
                                },
                                renewal_snapshot: {
                                    type: 'string',
                                    description: '1-2 sentences on timing and urgency. Max 30 words.'
                                },
                                top_concerns: {
                                    type: 'array',
                                    description: 'Top 3-5 findings, sorted by severity. Keep explanations to 1 sentence.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            topic: { type: 'string', description: 'Short headline (5-8 words)' },
                                            explanation: { type: 'string', description: 'One concise sentence explaining why this matters' },
                                            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                                            source: { type: 'string', description: 'Data source: policy, satellite, property data, etc.' },
                                            evidence: { type: 'string', description: 'Brief data point supporting this concern' }
                                        },
                                        required: ['topic', 'explanation', 'severity', 'source', 'evidence'],
                                        additionalProperties: false
                                    }
                                },
                                coverage_review: {
                                    type: 'array',
                                    description: 'Comparative notes per coverage line. Keep observations to 10-15 words.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            coverage: { type: 'string', description: 'Coverage name' },
                                            current_value: { type: 'string', description: 'Current limit from the policy' },
                                            observation: { type: 'string', description: 'Brief comparative note (10-15 words max)' },
                                            status: { type: 'string', enum: ['review_suggested', 'missing_coverage', 'informational'], description: 'Neutral status indicator. Never pass judgement as adequate.' },
                                            source: { type: 'string', description: 'Source document or line reference' }
                                        },
                                        required: ['coverage', 'current_value', 'observation', 'status', 'source'],
                                        additionalProperties: false
                                    }
                                },
                                property_observations: {
                                    type: 'array',
                                    description: 'Structured property observations from enrichment data. Include only high-value items.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            observation: { type: 'string', description: 'What was observed (1 sentence)' },
                                            source: { type: 'string', description: 'Named data source' },
                                            confidence: { type: 'string', description: 'high, medium, or low' },
                                            discrepancy: { type: 'string', description: 'Any conflict with policy data. Empty string if none.' }
                                        },
                                        required: ['observation', 'source', 'confidence', 'discrepancy'],
                                        additionalProperties: false
                                    }
                                },
                                data_gaps: {
                                    type: 'array',
                                    description: 'Missing data that impacts the coverage conversation. Only include material gaps.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            field: { type: 'string' },
                                            impact: { type: 'string', description: 'Brief impact (1 sentence)' },
                                            suggestion: { type: 'string', description: 'What to do about it' }
                                        },
                                        required: ['field', 'impact', 'suggestion'],
                                        additionalProperties: false
                                    }
                                },
                                recommendations: {
                                    type: 'array',
                                    description: 'Actionable next steps. Each is 1 clear sentence.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            text: { type: 'string', description: 'Clear, concise recommendation (1 sentence)' },
                                            category: { type: 'string', enum: ['discuss', 'verify', 'review', 'consider_coverage'] },
                                            priority: { type: 'number', description: '1 = immediate, 2 = before renewal, 3 = future' },
                                            source: { type: 'string', description: 'What drives this recommendation' }
                                        },
                                        required: ['text', 'category', 'priority', 'source'],
                                        additionalProperties: false
                                    }
                                },
                                action_items: {
                                    type: 'array',
                                    description: 'Concrete checklist items for the renewal conversation.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            item: { type: 'string', description: 'Short, direct action item' },
                                            type: { type: 'string', enum: ['confirm', 'discuss', 'update', 'verify'] },
                                            urgency: { type: 'string', enum: ['before_renewal', 'at_renewal', 'when_convenient'] }
                                        },
                                        required: ['item', 'type', 'urgency'],
                                        additionalProperties: false
                                    }
                                },
                                internal_notes: {
                                    type: 'string',
                                    description: 'Agent-only notes: technical observations, enrichment conflicts, raw data insights. NOT shown to clients.'
                                }
                            },
                            required: ['executive_summary', 'renewal_snapshot', 'top_concerns', 'coverage_review', 'property_observations', 'data_gaps', 'recommendations', 'action_items', 'internal_notes'],
                            additionalProperties: false
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('OpenAI Error:', errBody);
            throw new Error('Failed to generate AI insights');
        }

        const responseData = await response.json();
        const aiInsights: AIReportInsights = JSON.parse(responseData.choices[0].message.content);

        // 4. Save to DB
        return await saveAndReturnReport(policyId, policy.client_id, dataPayload, aiInsights);

    } catch (err: any) {
        console.error('Error generating report:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function saveAndReturnReport(policyId: string, clientId: string | undefined, dataPayload: any, aiInsights: AIReportInsights) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('policy_reports')
        .insert({
            policy_id: policyId,
            client_id: clientId || null,
            status: 'published',
            data_payload: dataPayload,
            ai_insights: aiInsights
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to save report to DB:', error);
        return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
    }

    // Activity event: report generated
    try {
        await supabase.from('activity_events').insert({
            event_type: 'report.generated',
            title: 'Coverage analysis report generated',
            detail: `Report created for policy review`,
            policy_id: policyId,
            client_id: clientId || null,
            meta: { report_id: data.id },
        });
    } catch (e) {
        console.warn('Activity event insert failed (non-fatal):', e);
    }

    return NextResponse.json({ success: true, report: data });
}
