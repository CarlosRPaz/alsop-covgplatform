import { NextRequest, NextResponse } from 'next/server';
import {
    sendEmail,
    getDefaultFrom,
    getDefaultReplyTo,
    EmailMessage,
} from '@/lib/emailService';
import {
    renderTemplate,
    getTemplateFrom,
    getTemplateReplyTo,
} from '@/lib/emailTemplates';

/**
 * POST /api/email/send
 *
 * Send an email via the platform's email system.
 *
 * Body:
 * {
 *   templateId?: string,           // Template to use (or omit for freeform)
 *   to: string,                    // Recipient email
 *   variables?: Record<string,string>,  // Merge variables for template
 *   subject?: string,              // Required if no templateId
 *   htmlBody?: string,             // Required if no templateId
 *   from?: string,                 // Override From address
 *   replyTo?: string,              // Override Reply-To
 *   attachments?: Array<{ name, content, contentType }>,
 *   policyId?: string,
 *   clientId?: string,
 *   reportId?: string,
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            templateId,
            to,
            variables,
            subject: customSubject,
            htmlBody: customHtmlBody,
            from,
            replyTo,
            attachments,
            policyId,
            clientId,
            reportId,
        } = body;

        if (!to || typeof to !== 'string') {
            return NextResponse.json({ error: '"to" email address is required' }, { status: 400 });
        }

        let subject: string;
        let htmlBody: string;

        if (templateId) {
            // Template-based send
            const rendered = renderTemplate(templateId, variables || {});
            if (!rendered) {
                return NextResponse.json({ error: `Template "${templateId}" not found` }, { status: 400 });
            }
            subject = rendered.subject;
            htmlBody = rendered.htmlBody;
        } else {
            // Freeform send
            if (!customSubject || !customHtmlBody) {
                return NextResponse.json({ error: 'Either templateId or both subject and htmlBody are required' }, { status: 400 });
            }
            subject = customSubject;
            htmlBody = customHtmlBody;
        }

        const message: EmailMessage = {
            to,
            from: from || (templateId ? getTemplateFrom(templateId) : getDefaultFrom()),
            replyTo: replyTo || (templateId ? getTemplateReplyTo(templateId) : getDefaultReplyTo()),
            subject,
            htmlBody,
            attachments,
            templateId,
            policyId,
            clientId,
            reportId,
        };

        const result = await sendEmail(message);

        return NextResponse.json({
            success: result.success,
            mode: result.mode,
            messageId: result.messageId,
            redirectedFrom: result.redirectedFrom,
            error: result.error,
            timestamp: result.timestamp,
        });
    } catch (err: any) {
        console.error('[Email Send] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
