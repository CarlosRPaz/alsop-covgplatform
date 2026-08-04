import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { authenticateRequest, isAuthError } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    const auth = await authenticateRequest(req, { requiredRole: ['admin', 'service'] });
    if (isAuthError(auth)) return auth;

    try {
        const body = await req.json();
        const { policyId, clientId, templateId, templateName } = body;

        if (!policyId || !templateId || !templateName) {
            return NextResponse.json({ error: 'policyId, templateId, and templateName are required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // a. Insert a row into renewal_email_log table
        const { data: entry, error: logError } = await supabase
            .from('renewal_email_log')
            .insert({
                policy_id: policyId,
                client_id: clientId || null,
                template_id: templateId,
                template_name: templateName
            })
            .select()
            .single();

        if (logError) {
            console.error('Error inserting into renewal_email_log:', logError);
            return NextResponse.json({ error: 'Failed to log renewal email' }, { status: 500 });
        }

        // b. Try to update policies table
        try {
            await supabase
                .from('policies')
                .update({
                    renewal_email_status: 'sent',
                    renewal_email_last_sent_at: new Date().toISOString()
                })
                .eq('id', policyId);
        } catch (updateError) {
            console.warn('Failed to update policies table (columns might not exist yet):', updateError);
        }

        // c. Insert an activity event
        try {
            await supabase.from('activity_events').insert({
                event_type: 'email.marked_sent',
                title: 'Renewal email marked as sent',
                detail: `Template: ${templateName}`,
                policy_id: policyId,
                client_id: clientId || null,
                meta: { template_id: templateId, template_name: templateName }
            });
        } catch (eventError) {
            console.warn('Activity event insert failed (non-fatal):', eventError);
        }

        // Return success with inserted row
        return NextResponse.json({ success: true, entry });

    } catch (err: any) {
        console.error('Error in /api/email/mark-sent:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
