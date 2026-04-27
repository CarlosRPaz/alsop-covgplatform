import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getPolicyDetailById, fetchFlagsByPolicyId, PolicyDetail, PolicyFlagRow } from '@/lib/api';

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
You are creating a COMPACT, CLIENT-FACING coverage analysis report for an insurance brokerage.
This report will be shared with the client. It must be clear, professional, and concise.

AUDIENCE: Homeowners and policyholders. Use plain language. No jargon.

WRITING RULES:
1. Be CONCISE. Every word must earn its place.
2. executive_summary: MAX 3 sentences. Lead with the single most important finding. End with overall risk posture.
3. renewal_snapshot: 1-2 sentences about timing and urgency. Keep it tight.
4. top_concerns: Each explanation should be 1 sentence max. Evidence should be a brief data point, not a paragraph.
5. coverage_review observations: Keep to 10-15 words per observation. No filler.
6. recommendations: Each should be a single clear sentence. Actionable, not advisory essays.
7. action_items: Short, direct checklist items. "Verify roof age with inspector" not "It would be advisable to verify..."
8. data_gaps: Only include if genuinely impactful to the client conversation. Skip trivial gaps.
9. property_observations: Include observations with real value only. Skip generic/obvious items.
10. internal_notes: Put agent-only observations, raw enrichment conflicts, and technical notes HERE. This field is NOT shown to clients.

CRITICAL RULES:
- DO NOT invent facts. Only cite what is in the JSON context.
- If enrichments conflict with policy data, flag it as something to verify, not as an error.
- Cite sources: "policy declaration", "satellite imagery", "property data", etc. (But respect the EXCLUSIONS below).
- Frame recommendations as discussion points: "Consider", "We recommend discussing", "Worth reviewing".
- Prioritize by client impact: 1 = urgent, 2 = before renewal, 3 = when convenient.
- Output strict JSON matching the required schema.

EXCLUSIONS AND GUARDRAILS (STRICT):
1. NO FIRE RISK: NEVER mention fire risk, fire scores, or wildfire scores in any section. Completely suppress these findings from the output.
2. NO IMAGERY NOTES: NEVER mention image quality, satellite limitations, or unclear photos.
3. NO INSPECTION NOTES: NEVER recommend visual, property, or field inspections.
4. NO "APPROVED VENDOR": DO NOT use the phrase "with an approved vendor". Simply state "Review replacement cost estimate".
5. NO REASSURANCE: NEVER use reassuring words like "adequate", "sufficient", "properly covered", "looks good", "coverage is good", or "no issue". Use neutral or improvement-oriented framing (e.g., "Consider reviewing", "Recommended to evaluate").
6. IMPROVEMENT ORIENTED ONLY: Only include findings, observations, or action items that represent a gap, suggestion, or review opportunity. Do not include "good news" confirmations.

VALUATION DATA GUIDANCE:
- If replacement cost estimate is available, frame as: "Based on available data, estimated replacement cost is approximately $X. Review replacement cost estimate."
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
                                    description: 'Assessment per coverage line. Keep observations to 10-15 words.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            coverage: { type: 'string', description: 'Coverage name' },
                                            current_value: { type: 'string', description: 'Current limit from the policy' },
                                            observation: { type: 'string', description: 'Brief note (10-15 words max)' },
                                            adequacy: { type: 'string', enum: ['review', 'gap', 'unknown'], description: 'Never use adequate. Use review or unknown for neutral items.' }
                                        },
                                        required: ['coverage', 'current_value', 'observation', 'adequacy'],
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
