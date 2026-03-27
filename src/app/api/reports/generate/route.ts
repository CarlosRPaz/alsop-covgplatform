import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getPolicyDetailById, fetchFlagsByPolicyId, PolicyDetail, PolicyFlagRow } from '@/lib/api';

/**
 * Expected schema from the GPT-4o report synthesizer (v2 — beta-ready).
 */
interface AIReportInsights {
    executive_summary: string;
    renewal_snapshot: string;
    top_concerns: Array<{
        topic: string;
        explanation: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
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
                action_items: []
            });
        }

        const systemPrompt = `
You are creating a professional, client-facing policy review report for an insurance brokerage.
This report will be shared with or discussed alongside the client during a renewal or coverage review conversation.

AUDIENCE: Insurance agents and their clients. The tone must be professional, clear, and consultative — NOT internal underwriting language.

REPORT PURPOSE:
- Help the client understand their current coverage
- Highlight potential gaps, weaknesses, or areas that need attention  
- Identify things that should be confirmed or verified before renewal
- Suggest coverage improvements the client should consider
- Give the agent clear talking points for a productive renewal conversation

CRITICAL RULES:
1. DO NOT invent facts or hallucinate coverages. Only cite what is in the JSON context.
2. If property enrichments (satellite AI, street view AI) conflict with policy data, flag it as something to verify — NOT as an error.
3. Keep language accessible. Avoid jargon like "underwriting posture" or "binding authority". Use plain language.
4. Every finding MUST cite its source (e.g., "policy declaration", "property data", "automated review", "satellite imagery").
5. Recommendations must be framed as discussion points, not mandates. Use "Consider", "We recommend discussing", "This may warrant review".
6. Prioritize by impact to the client: 1 = urgent (could affect a claim right now), 2 = important for renewal, 3 = worth considering.
7. Output strict JSON matching the required schema.

RENEWAL CONTEXT: Write as if this report will be discussed with the client at their next renewal meeting. Focus on what they need to know, what questions to ask, and what actions to take.

VALUATION DATA GUIDANCE:
- If square footage data is available (field_key "best_sqft" in enrichments), mention it as a supporting property fact in coverage_review or property_observations.
- If a replacement cost estimate is available (field_key "rc_estimate_fallback"), use it CAREFULLY:
  - Always note that it is an internal estimate, not a vendor-certified valuation.
  - Frame it as: "Based on available property data, the estimated replacement cost is approximately $X. This is an internal estimate and should be verified with an approved vendor."
  - If the estimate differs significantly from the policy's dwelling coverage, flag it as a discussion point — NOT as an error.
- NEVER present a fallback estimate as authoritative or vendor-grade.

Data Payload Context:
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
                    { role: 'user', content: 'Generate the structured report insights based on the provided context. Be thorough and cite sources for every finding.' }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'report_insights_v2',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                executive_summary: {
                                    type: 'string',
                                    description: '3-4 sentence overview of the policy review. State urgency if renewal is approaching. Mention the most critical finding.'
                                },
                                renewal_snapshot: {
                                    type: 'string',
                                    description: 'Concise summary of policy timing, renewal urgency, overall risk posture, and the key metric an agent needs to know right now.'
                                },
                                top_concerns: {
                                    type: 'array',
                                    description: 'Highest priority flags or discrepancies, explained and sourced.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            topic: { type: 'string', description: 'Short title of the concern' },
                                            explanation: { type: 'string', description: 'Clear explanation of why this matters' },
                                            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                                            source: { type: 'string', description: 'Where this was detected: policy, flag_engine, enrichment, inferred' },
                                            evidence: { type: 'string', description: 'Specific data point or comparison that supports this concern' }
                                        },
                                        required: ['topic', 'explanation', 'severity', 'source', 'evidence'],
                                        additionalProperties: false
                                    }
                                },
                                coverage_review: {
                                    type: 'array',
                                    description: 'Assessment of each coverage line from the policy.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            coverage: { type: 'string', description: 'Coverage name (Dwelling, Other Structures, Personal Property, etc.)' },
                                            current_value: { type: 'string', description: 'Current limit or value from the policy' },
                                            observation: { type: 'string', description: 'Brief note about this coverage line' },
                                            adequacy: { type: 'string', enum: ['adequate', 'review', 'gap', 'unknown'], description: 'Assessment of coverage adequacy' }
                                        },
                                        required: ['coverage', 'current_value', 'observation', 'adequacy'],
                                        additionalProperties: false
                                    }
                                },
                                property_observations: {
                                    type: 'array',
                                    description: 'Structured observations from property enrichment data.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            observation: { type: 'string', description: 'What was observed' },
                                            source: { type: 'string', description: 'Data source (Google Maps, USDA, satellite AI, street view AI, etc.)' },
                                            confidence: { type: 'string', description: 'Confidence level (high, medium, low)' },
                                            discrepancy: { type: 'string', description: 'If this conflicts with policy data, describe the discrepancy. Empty string if no conflict.' }
                                        },
                                        required: ['observation', 'source', 'confidence', 'discrepancy'],
                                        additionalProperties: false
                                    }
                                },
                                data_gaps: {
                                    type: 'array',
                                    description: 'Missing or unverifiable information that could affect underwriting.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            field: { type: 'string', description: 'What data is missing or needs verification' },
                                            impact: { type: 'string', description: 'How this gap affects coverage assessment' },
                                            suggestion: { type: 'string', description: 'What the agent should do to resolve this' }
                                        },
                                        required: ['field', 'impact', 'suggestion'],
                                        additionalProperties: false
                                    }
                                },
                                recommendations: {
                                    type: 'array',
                                    description: 'Actionable next steps, prioritized and categorized.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            text: { type: 'string', description: 'Clear, concise recommendation' },
                                            category: { type: 'string', enum: ['discuss', 'verify', 'review', 'consider_coverage'] },
                                            priority: { type: 'number', description: '1 = immediate, 2 = before renewal, 3 = future consideration' },
                                            source: { type: 'string', description: 'What data point or finding drives this recommendation' }
                                        },
                                        required: ['text', 'category', 'priority', 'source'],
                                        additionalProperties: false
                                    }
                                },
                                action_items: {
                                    type: 'array',
                                    description: 'Concrete checklist items for the agent-client renewal conversation.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            item: { type: 'string', description: 'A specific action to take or discuss' },
                                            type: { type: 'string', enum: ['confirm', 'discuss', 'update', 'verify'] },
                                            urgency: { type: 'string', enum: ['before_renewal', 'at_renewal', 'when_convenient'] }
                                        },
                                        required: ['item', 'type', 'urgency'],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ['executive_summary', 'renewal_snapshot', 'top_concerns', 'coverage_review', 'property_observations', 'data_gaps', 'recommendations', 'action_items'],
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
            title: 'Policy review report generated',
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
