import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getPolicyDetailById, fetchFlagsByPolicyId, PolicyDetail, PolicyFlagRow } from '@/lib/api';

/**
 * Expected schema from the GPT-4o report synthesizer.
 */
interface AIReportInsights {
    executive_summary: string;
    renewal_snapshot: string;
    top_concerns: Array<{
        topic: string;
        explanation: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
    }>;
    recommendations: Array<{
        text: string;
        category: 'discuss' | 'verify' | 'review' | 'consider_coverage';
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
                recommendations: []
            });
        }

        const systemPrompt = `
You are an expert Property & Casualty Insurance Underwriter and Client Advisor.
Your job is to synthesize raw policy, flag, and property enrichment data into a polished, accurate, and highly professional Report structure.

CRITICAL RULES:
1. DO NOT invent facts or hallucinate coverages. Only cite what is provided in the JSON context.
2. If property enrichments (e.g., satellite AI, street view AI) conflict with the policy (e.g., policy says 1 story, AI says 2), highlight it as a discrepancy.
3. Keep the tone professional, objective, and consultative.
4. Output strict JSON matching the required schema.

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
                temperature: 0.1, // Keep it deterministic
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Generate the structured report insights based on the provided context.' }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'report_insights',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                executive_summary: {
                                    type: 'string',
                                    description: 'A 2-3 sentence overview of the policy review and immediate needs.'
                                },
                                renewal_snapshot: {
                                    type: 'string',
                                    description: 'A concise summary of the policy timing, age, urgency, and overall risk posture.'
                                },
                                top_concerns: {
                                    type: 'array',
                                    description: 'The highest priority flags or discrepancies grouped and explained.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            topic: { type: 'string' },
                                            explanation: { type: 'string' },
                                            severity: { enum: ['critical', 'high', 'medium', 'low'] }
                                        },
                                        required: ['topic', 'explanation', 'severity'],
                                        additionalProperties: false
                                    }
                                },
                                recommendations: {
                                    type: 'array',
                                    description: 'Clear, practical next steps categorized by action type.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            text: { type: 'string' },
                                            category: { enum: ['discuss', 'verify', 'review', 'consider_coverage'] }
                                        },
                                        required: ['text', 'category'],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ['executive_summary', 'renewal_snapshot', 'top_concerns', 'recommendations'],
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

        const data = await response.json();
        const aiInsights: AIReportInsights = JSON.parse(data.choices[0].message.content);

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
