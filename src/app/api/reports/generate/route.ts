import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getPolicyDetailById, fetchFlagsByPolicyId, PolicyDetail, PolicyFlagRow } from '@/lib/api';
import { authenticateRequest, isAuthError } from '@/lib/apiAuth';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';


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
    next_steps?: Array<{ text: string; group: string }>;
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

        // 1. Gather all required data (using admin client to bypass RLS)
        const policy = await getPolicyDetailById(policyId, supabase);
        if (!policy) {
            return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
        }

        const flags = await fetchFlagsByPolicyId(policyId, supabase) || [];

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
        const openAiKey = env.OPENAI_API_KEY;
        if (!openAiKey) {
            logger.warn('Generate', 'OPENAI_API_KEY missing - saving draft report without AI insights')
            return saveAndReturnReport(policyId, policy.client_id, dataPayload, {
                executive_summary: "Coverage review in progress.",
                renewal_snapshot: "",
                top_concerns: [],
                coverage_review: [],
                property_observations: [],
                data_gaps: [],
                recommendations: [],
                action_items: [],
                next_steps: [],
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
6. BE CONCISE: Observations 10-15 words max.
7. STRUCTURE FINDINGS: For structural findings (e.g., pools, ADUs, solar, trampolines), do not state they exist definitively. Use language like: "We may have detected a [structure] based on Google imagery from [Date]. Please confirm with your agent so we can ensure it is properly covered." You MUST explicitly cite 'Google' as the source in your observation text. If the date is not available, just say "based on Google imagery".
8. FAIR RENTAL VALUE: "Loss of Use" and "Fair Rental Value" are the exact same coverage. Always refer to it as "Fair Rental Value" and never say it is missing if "Fair Rental Value" is present.
9. EVIDENCE FORMATTING: Do NOT use literal system flag names (like "NO_DIC" or "MISSING_PERILS_INSURED") in the evidence or explanations. Use natural, human-readable language (e.g., "No DIC coverage on file").

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
                        name: 'report_insights_v4',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                top_concerns: {
                                    type: 'array',
                                    description: 'Top 3-5 findings. Keep explanations to 1-2 sentences.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            explanation: { type: 'string', description: 'Clear, client-facing explanation of the concern.' },
                                            source: { type: 'string', description: 'Data source: policy, satellite, property data, etc.' },
                                            evidence: { type: 'string', description: 'Brief data point supporting this concern' }
                                        },
                                        required: ['explanation', 'source', 'evidence'],
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
                                            source: { type: 'string', description: 'Source document or line reference' }
                                        },
                                        required: ['coverage', 'current_value', 'observation', 'source'],
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
                                next_steps: {
                                    type: 'array',
                                    description: 'Actionable next steps, combining recommendations, action items, and data gaps into a single logical list. No duplicates.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            text: { type: 'string', description: 'Clear, concise recommendation or action item (1 sentence)' },
                                            timeframe: { type: 'string', enum: ['review_now', 'discuss_at_renewal', 'confirm_and_update'] }
                                        },
                                        required: ['text', 'timeframe'],
                                        additionalProperties: false
                                    }
                                },
                                internal_notes: {
                                    type: 'string',
                                    description: 'Agent-only notes: technical observations, enrichment conflicts, raw data insights. NOT shown to clients.'
                                }
                            },
                            required: ['top_concerns', 'coverage_review', 'property_observations', 'next_steps', 'internal_notes'],
                            additionalProperties: false
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            logger.error('Generate', 'OpenAI Error:', { detail: errBody })
            throw new Error('Failed to generate AI insights');
        }

        const responseData = await response.json();
        const aiInsights: AIReportInsights = JSON.parse(responseData.choices[0].message.content);

        // 4. Save to DB
        return await saveAndReturnReport(policyId, policy.client_id, dataPayload, aiInsights);

    } catch (err: any) {
        logger.error('Generate', 'Error generating report:', err)
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
        logger.error('Generate', 'Failed to save report to DB:', { error: error.message })
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
        logger.warn('Generate', 'Activity event insert failed (non-fatal):', { error: e instanceof Error ? e.message : String(e) });
    }

    // Save a reference in platform_documents so report appears in Files tab
    try {
        const reportDate = new Date().toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
        await supabase.from('platform_documents').insert({
            policy_id: policyId,
            client_id: clientId || null,
            doc_type: 'other',
            file_name: `Coverage Analysis Report — ${reportDate}.pdf`,
            parse_status: 'parsed',
            match_status: 'matched',
            writeback_status: 'complete',
            processing_step: null,
            error_message: null,
        });
    } catch (e) {
        logger.warn('Generate', 'platform_documents insert for report failed (non-fatal):', { error: e instanceof Error ? e.message : String(e) });
    }

    return NextResponse.json({ success: true, report: data });
}
