import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emailService';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

/**
 * POST /api/support
 * Handles support requests submitted by clients or guests.
 * Emails support@coveragechecknow.com and logs an activity event.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, subject, message, policyNumber } = body;

        if (!email || typeof email !== 'string' || !email.trim()) {
            return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
        }

        const clientName = name?.trim() || email.split('@')[0];
        const emailSubject = `[Support Inquiry] ${subject || 'General Question'} - ${clientName}`;

        const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <div style="background: #2243B6; color: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 18px;">New Client Support Request</h2>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">CoverageCheckNow Platform Support</p>
                </div>
                <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 14px;">
                        <tr><td style="padding: 6px 0; color: #64748b; width: 130px;"><strong>Client Name:</strong></td><td style="padding: 6px 0;">${clientName}</td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;"><strong>Client Email:</strong></td><td style="padding: 6px 0;"><a href="mailto:${email}" style="color: #2243B6;">${email}</a></td></tr>
                        ${policyNumber ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Policy #:</strong></td><td style="padding: 6px 0;">${policyNumber}</td></tr>` : ''}
                        <tr><td style="padding: 6px 0; color: #64748b;"><strong>Topic / Subject:</strong></td><td style="padding: 6px 0;">${subject || 'General Inquiry'}</td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;"><strong>Submitted At:</strong></td><td style="padding: 6px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</td></tr>
                    </table>
                    <div style="background: #f8fafc; border-left: 4px solid #2243B6; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Message Body</h4>
                        <p style="margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #334155;">${message}</p>
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                        You can reply directly to this email to respond to the client at ${email}.
                    </p>
                </div>
            </div>
        `;

        // Send support email to support@coveragechecknow.com
        const sendResult = await sendEmail({
            to: 'support@coveragechecknow.com',
            from: 'support@coveragechecknow.com',
            replyTo: email,
            subject: emailSubject,
            htmlBody,
        });

        // Log activity event
        try {
            const supabase = getSupabaseAdmin();
            await supabase.from('activity_events').insert({
                event_type: 'support.inquiry',
                title: 'Client Support Inquiry Submitted',
                detail: `${clientName} (${email}): ${subject || 'Inquiry'}`,
                meta: { client_name: clientName, client_email: email, policy_number: policyNumber, subject, message }
            });
        } catch (actErr) {
            console.warn('Failed to insert activity event for support request:', actErr);
        }

        return NextResponse.json({ success: true, message: 'Support request sent successfully', sendResult });

    } catch (err: any) {
        console.error('Error in POST /api/support:', err);
        return NextResponse.json({ error: err.message || 'Failed to submit support request' }, { status: 500 });
    }
}
