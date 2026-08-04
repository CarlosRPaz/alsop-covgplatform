import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { authenticateRequest, isAuthError } from '@/lib/apiAuth';

/**
 * POST /api/email/mark-sent
 * Mark a specific template as emailed for a policy.
 */
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

        // Insert a row into renewal_email_log table
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
            return NextResponse.json({ error: `Failed to log renewal email: ${logError.message}` }, { status: 500 });
        }

        // Try to update policies table (non-fatal if columns don't exist)
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

        // Insert an activity event (non-fatal)
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

        return NextResponse.json({ success: true, entry });

    } catch (err: any) {
        console.error('Error in POST /api/email/mark-sent:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/email/mark-sent
 * Unmark a specific template email log entry.
 * Body: { entryId: string, policyId: string }
 */
export async function DELETE(req: NextRequest) {
    const auth = await authenticateRequest(req, { requiredRole: ['admin', 'service'] });
    if (isAuthError(auth)) return auth;

    try {
        const body = await req.json();
        const { entryId, policyId } = body;

        if (!entryId) {
            return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Delete the specific log entry
        const { error: delError } = await supabase
            .from('renewal_email_log')
            .delete()
            .eq('id', entryId);

        if (delError) {
            console.error('Error deleting from renewal_email_log:', delError);
            return NextResponse.json({ error: `Failed to unmark: ${delError.message}` }, { status: 500 });
        }

        // If policyId provided, check if there are any remaining log entries
        // If none, reset the policy status
        if (policyId) {
            try {
                const { data: remaining } = await supabase
                    .from('renewal_email_log')
                    .select('id')
                    .eq('policy_id', policyId)
                    .limit(1);

                if (!remaining || remaining.length === 0) {
                    await supabase
                        .from('policies')
                        .update({
                            renewal_email_status: 'not_sent',
                            renewal_email_last_sent_at: null
                        })
                        .eq('id', policyId);
                }
            } catch (updateError) {
                console.warn('Failed to update policies table (non-fatal):', updateError);
            }
        }

        // Log activity
        try {
            await supabase.from('activity_events').insert({
                event_type: 'email.unmarked_sent',
                title: 'Renewal email unmarked',
                detail: `Entry: ${entryId}`,
                policy_id: policyId || null,
                meta: { entry_id: entryId }
            });
        } catch (eventError) {
            console.warn('Activity event insert failed (non-fatal):', eventError);
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('Error in DELETE /api/email/mark-sent:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
