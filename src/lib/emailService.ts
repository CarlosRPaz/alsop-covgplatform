/**
 * Email Service — Core email sending infrastructure for CFP Platform.
 *
 * Architecture:
 * - Google Workspace = human inboxes (support@, admin@, reports@)
 * - Postmark = app-generated transactional email
 *
 * Safety system:
 * - EMAIL_SEND_MODE controls behavior:
 *   - 'disabled'  (DEFAULT) — all sends silently logged, never delivered
 *   - 'redirect'  — all sends redirected to EMAIL_DEV_REDIRECT
 *   - 'live'      — real delivery (requires NODE_ENV=production)
 *
 * Real client delivery is OPT-IN. It is never enabled by default.
 */

import { getSupabaseAdmin } from '@/lib/supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailSendMode = 'disabled' | 'redirect' | 'live';

export interface EmailAddress {
    email: string;
    name?: string;
}

export interface EmailAttachment {
    name: string;
    content: string;      // Base64 encoded
    contentType: string;  // e.g. 'application/pdf'
}

export interface EmailMessage {
    to: string | EmailAddress;
    from?: string | EmailAddress;
    replyTo?: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    attachments?: EmailAttachment[];
    // Metadata for logging
    templateId?: string;
    policyId?: string;
    clientId?: string;
    reportId?: string;
}

export interface EmailSendResult {
    success: boolean;
    messageId?: string;
    mode: EmailSendMode;
    redirectedFrom?: string;  // Original recipient if redirected
    error?: string;
    timestamp: string;
}

export interface EmailSystemStatus {
    mode: EmailSendMode;
    redirectTarget: string | null;
    postmarkConfigured: boolean;
    fromDefault: string;
    replyToDefault: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface EmailProvider {
    name: string;
    send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// ---------------------------------------------------------------------------
// Postmark Provider
// ---------------------------------------------------------------------------

class PostmarkProvider implements EmailProvider {
    name = 'Postmark';

    async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
        const token = process.env.POSTMARK_SERVER_TOKEN;
        if (!token) {
            return { success: false, error: 'POSTMARK_SERVER_TOKEN not configured' };
        }

        const fromStr = typeof message.from === 'string'
            ? message.from
            : message.from
                ? `${message.from.name || ''} <${message.from.email}>`.trim()
                : getDefaultFrom();

        const toStr = typeof message.to === 'string'
            ? message.to
            : `${message.to.name || ''} <${message.to.email}>`.trim();

        const body: Record<string, unknown> = {
            From: fromStr,
            To: toStr,
            Subject: message.subject,
            HtmlBody: message.htmlBody,
            TextBody: message.textBody || stripHtml(message.htmlBody),
            MessageStream: 'outbound',
        };

        if (message.replyTo) {
            body.ReplyTo = message.replyTo;
        }

        if (message.attachments && message.attachments.length > 0) {
            body.Attachments = message.attachments.map(a => ({
                Name: a.name,
                Content: a.content,
                ContentType: a.contentType,
            }));
        }

        try {
            const res = await fetch('https://api.postmark.app/email', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Postmark-Server-Token': token,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok || data.ErrorCode) {
                return { success: false, error: data.Message || `Postmark error ${data.ErrorCode}` };
            }

            return { success: true, messageId: data.MessageID };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
}

// ---------------------------------------------------------------------------
// Console Provider (dev fallback)
// ---------------------------------------------------------------------------

class ConsoleProvider implements EmailProvider {
    name = 'Console';

    async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string }> {
        const toStr = typeof message.to === 'string' ? message.to : message.to.email;
        console.log(`\n📧 [Console Email Provider]`);
        console.log(`   To: ${toStr}`);
        console.log(`   Subject: ${message.subject}`);
        console.log(`   Template: ${message.templateId || 'none'}`);
        console.log(`   Body length: ${message.htmlBody.length} chars\n`);
        return { success: true, messageId: `console-${Date.now()}` };
    }
}

// ---------------------------------------------------------------------------
// Config Helpers
// ---------------------------------------------------------------------------

export function getEmailSendMode(): EmailSendMode {
    const mode = (process.env.EMAIL_SEND_MODE || 'disabled').toLowerCase() as EmailSendMode;
    if (!['disabled', 'redirect', 'live'].includes(mode)) return 'disabled';

    // Extra safety: 'live' mode requires production environment
    if (mode === 'live' && process.env.NODE_ENV !== 'production') {
        console.warn('[Email] EMAIL_SEND_MODE=live ignored — NODE_ENV is not production. Falling back to redirect.');
        return 'redirect';
    }

    return mode;
}

export function getDevRedirectTarget(): string {
    return process.env.EMAIL_DEV_REDIRECT || 'carlospaz@allstate.com';
}

export function getDefaultFrom(): string {
    return process.env.EMAIL_FROM_DEFAULT || 'reports@cfpplatform.com';
}

export function getDefaultReplyTo(): string {
    return process.env.EMAIL_REPLY_TO_DEFAULT || 'support@cfpplatform.com';
}

export function getEmailSystemStatus(): EmailSystemStatus {
    const mode = getEmailSendMode();
    return {
        mode,
        redirectTarget: mode === 'redirect' ? getDevRedirectTarget() : null,
        postmarkConfigured: !!process.env.POSTMARK_SERVER_TOKEN,
        fromDefault: getDefaultFrom(),
        replyToDefault: getDefaultReplyTo(),
    };
}

// ---------------------------------------------------------------------------
// Provider Selection
// ---------------------------------------------------------------------------

function getProvider(): EmailProvider {
    if (process.env.POSTMARK_SERVER_TOKEN) {
        return new PostmarkProvider();
    }
    return new ConsoleProvider();
}

// ---------------------------------------------------------------------------
// Core Send Function
// ---------------------------------------------------------------------------

/**
 * Send an email through the platform's email system.
 *
 * Safety behavior by mode:
 * - disabled: logs the attempt, never sends
 * - redirect: rewrites To to dev redirect, marks subject with [DEV/TEST]
 * - live: sends to real recipient (production only)
 */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const mode = getEmailSendMode();
    const now = new Date().toISOString();
    const originalTo = typeof message.to === 'string' ? message.to : message.to.email;

    // ── DISABLED MODE ──
    if (mode === 'disabled') {
        await logEmailEvent('email.blocked', message, {
            mode,
            reason: 'Email sending is disabled (EMAIL_SEND_MODE=disabled)',
            originalTo,
        });

        return {
            success: true,
            mode: 'disabled',
            timestamp: now,
        };
    }

    // ── REDIRECT MODE ──
    if (mode === 'redirect') {
        const redirectTarget = getDevRedirectTarget();

        // Rewrite the message for dev safety
        const redirectedMessage: EmailMessage = {
            ...message,
            to: redirectTarget,
            subject: `[DEV/TEST] ${message.subject}`,
            htmlBody: buildRedirectBanner(originalTo, message.templateId) + message.htmlBody,
        };

        const provider = getProvider();
        const result = await provider.send(redirectedMessage);

        await logEmailEvent('email.redirected', message, {
            mode,
            originalTo,
            redirectedTo: redirectTarget,
            provider: provider.name,
            messageId: result.messageId,
            success: result.success,
            error: result.error,
        });

        return {
            success: result.success,
            messageId: result.messageId,
            mode: 'redirect',
            redirectedFrom: originalTo,
            error: result.error,
            timestamp: now,
        };
    }

    // ── LIVE MODE ──
    // Final safety check
    if (process.env.NODE_ENV !== 'production') {
        await logEmailEvent('email.blocked', message, {
            mode: 'live',
            reason: 'Live mode blocked — NODE_ENV is not production',
            originalTo,
        });

        return {
            success: false,
            mode: 'live',
            error: 'Live sending blocked — not in production environment',
            timestamp: now,
        };
    }

    const provider = getProvider();
    const result = await provider.send(message);

    await logEmailEvent(result.success ? 'email.sent' : 'email.failed', message, {
        mode: 'live',
        provider: provider.name,
        messageId: result.messageId,
        success: result.success,
        error: result.error,
    });

    return {
        success: result.success,
        messageId: result.messageId,
        mode: 'live',
        error: result.error,
        timestamp: now,
    };
}

// ---------------------------------------------------------------------------
// Activity Logging
// ---------------------------------------------------------------------------

async function logEmailEvent(
    eventType: string,
    message: EmailMessage,
    meta: Record<string, unknown>
) {
    try {
        const supabase = getSupabaseAdmin();
        const toStr = typeof message.to === 'string' ? message.to : message.to.email;

        await supabase.from('activity_events').insert({
            event_type: eventType,
            title: `Email: ${message.subject.replace(/^\[DEV\/TEST\]\s*/, '').slice(0, 80)}`,
            detail: `To: ${meta.originalTo || toStr} | Mode: ${meta.mode} | Template: ${message.templateId || 'custom'}`,
            policy_id: message.policyId || null,
            client_id: message.clientId || null,
            meta: {
                to: toStr,
                from: typeof message.from === 'string' ? message.from : message.from?.email || getDefaultFrom(),
                replyTo: message.replyTo || getDefaultReplyTo(),
                templateId: message.templateId,
                reportId: message.reportId,
                ...meta,
            },
        });
    } catch (err) {
        console.error('[Email] Failed to log activity event:', err);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRedirectBanner(originalTo: string, templateId?: string): string {
    return `
<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-family:system-ui,sans-serif;">
  <div style="font-weight:700;color:#92400e;font-size:14px;margin-bottom:4px;">⚠️ DEV/TEST EMAIL — NOT SENT TO CLIENT</div>
  <div style="color:#78350f;font-size:13px;">
    <strong>Original recipient:</strong> ${originalTo}<br/>
    <strong>Template:</strong> ${templateId || 'custom'}<br/>
    <strong>Redirected at:</strong> ${new Date().toISOString()}
  </div>
</div>
`;
}

function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
