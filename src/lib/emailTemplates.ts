/**
 * Email Templates — Reusable email templates with merge-variable support.
 *
 * Each template defines:
 * - subject with {{variable}} placeholders
 * - HTML body with {{variable}} placeholders
 * - default from/replyTo
 *
 * To add a new template: add an entry to the TEMPLATES record below.
 */

import { getDefaultFrom, getDefaultReplyTo } from './emailService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTemplate {
    id: string;
    name: string;
    description: string;
    subject: string;
    htmlBody: string;
    defaultFrom?: string;
    defaultReplyTo?: string;
    variables: string[];  // List of supported {{variables}} for documentation
}

// ---------------------------------------------------------------------------
// Shared Styles
// ---------------------------------------------------------------------------

const WRAPPER_OPEN = `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;line-height:1.6;">
`;

const WRAPPER_CLOSE = `
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
  <div style="font-size:12px;color:#94a3b8;line-height:1.5;">
    <p>Alsop Insurance Agency<br/>Coverage & Policy Platform</p>
    <p style="font-size:11px;color:#cbd5e1;">This is an automated message from the CFP Platform. Please do not reply directly to this email — replies go to our support team.</p>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Template Definitions
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, EmailTemplate> = {
    report_delivery: {
        id: 'report_delivery',
        name: 'Report Delivery',
        description: 'Send a generated policy review report to a client or agent.',
        subject: 'Policy Review Report — {{policyNumber}}',
        htmlBody: `${WRAPPER_OPEN}
  <h2 style="color:#0f172a;font-size:20px;margin-bottom:4px;">Policy Review Report</h2>
  <p style="color:#64748b;font-size:14px;margin-top:0;">Policy #{{policyNumber}}</p>

  <p>Dear {{clientName}},</p>

  <p>Please find the attached policy review report for your property at <strong>{{propertyAddress}}</strong>.</p>

  <p>This report summarizes your current coverage, highlights areas for review, and provides recommendations for your upcoming renewal.</p>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
    <div style="font-weight:600;color:#334155;margin-bottom:8px;">What's Included</div>
    <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;">
      <li>Coverage snapshot and adequacy review</li>
      <li>Property observations from public data</li>
      <li>Identified gaps or areas of concern</li>
      <li>Recommendations and discussion items</li>
    </ul>
  </div>

  <p>If you have questions or would like to schedule a review meeting, please don't hesitate to reach out.</p>

  <p>Best regards,<br/><strong>{{agentName}}</strong><br/>Alsop Insurance Agency</p>
${WRAPPER_CLOSE}`,
        variables: ['clientName', 'agentName', 'policyNumber', 'propertyAddress'],
    },

    report_ready: {
        id: 'report_ready',
        name: 'Report Ready (Internal)',
        description: 'Notify an agent that a policy report has been generated and is ready for review.',
        subject: 'Report Ready for Review — {{policyNumber}}',
        htmlBody: `${WRAPPER_OPEN}
  <h2 style="color:#0f172a;font-size:20px;margin-bottom:4px;">Report Ready</h2>
  <p style="color:#64748b;font-size:14px;margin-top:0;">Policy #{{policyNumber}}</p>

  <p>Hi {{agentName}},</p>

  <p>The AI-generated policy review report for <strong>{{clientName}}</strong> ({{policyNumber}}) is ready for your review.</p>

  <div style="margin:20px 0;">
    <a href="{{reportUrl}}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;">
      View Report
    </a>
  </div>

  <p style="color:#64748b;font-size:13px;">Please review the report before sharing it with the client. AI-generated content should be verified for accuracy.</p>
${WRAPPER_CLOSE}`,
        variables: ['agentName', 'clientName', 'policyNumber', 'reportUrl'],
    },

    renewal_followup: {
        id: 'renewal_followup',
        name: 'Renewal Follow-Up',
        description: 'Send a renewal reminder or follow-up to a client.',
        subject: 'Upcoming Renewal — {{policyNumber}}',
        htmlBody: `${WRAPPER_OPEN}
  <h2 style="color:#0f172a;font-size:20px;margin-bottom:4px;">Renewal Reminder</h2>
  <p style="color:#64748b;font-size:14px;margin-top:0;">Policy #{{policyNumber}}</p>

  <p>Dear {{clientName}},</p>

  <p>Your policy <strong>{{policyNumber}}</strong> is scheduled to renew on <strong>{{expirationDate}}</strong>.</p>

  <p>We'd like to schedule a brief review to ensure your coverage still meets your needs. This is a great opportunity to:</p>

  <ul style="color:#475569;font-size:14px;">
    <li>Review any changes to your property or situation</li>
    <li>Discuss coverage adjustments or improvements</li>
    <li>Address any questions about your policy</li>
  </ul>

  <p>Please reply to this email or call us to schedule a convenient time.</p>

  <p>Best regards,<br/><strong>{{agentName}}</strong><br/>Alsop Insurance Agency</p>
${WRAPPER_CLOSE}`,
        variables: ['clientName', 'agentName', 'policyNumber', 'expirationDate'],
    },

    missing_info: {
        id: 'missing_info',
        name: 'Missing Information Request',
        description: 'Request missing documents or information from a client.',
        subject: 'Action Needed — Missing Information for {{policyNumber}}',
        htmlBody: `${WRAPPER_OPEN}
  <h2 style="color:#0f172a;font-size:20px;margin-bottom:4px;">Information Needed</h2>
  <p style="color:#64748b;font-size:14px;margin-top:0;">Policy #{{policyNumber}}</p>

  <p>Dear {{clientName}},</p>

  <p>We're working on your policy and need the following information to proceed:</p>

  <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:20px 0;">
    <div style="font-weight:600;color:#92400e;margin-bottom:8px;">Items Needed</div>
    <div style="color:#78350f;font-size:14px;">{{missingItems}}</div>
  </div>

  <p>Please reply to this email with the requested information, or call us if you have any questions.</p>

  <p>Thank you,<br/><strong>{{agentName}}</strong><br/>Alsop Insurance Agency</p>
${WRAPPER_CLOSE}`,
        variables: ['clientName', 'agentName', 'policyNumber', 'missingItems'],
    },
};

// ---------------------------------------------------------------------------
// Template API
// ---------------------------------------------------------------------------

/**
 * Get all available templates.
 */
export function getAllTemplates(): EmailTemplate[] {
    return Object.values(TEMPLATES);
}

/**
 * Get a specific template by ID.
 */
export function getTemplate(templateId: string): EmailTemplate | null {
    return TEMPLATES[templateId] || null;
}

/**
 * Apply merge variables to a template, returning resolved subject and HTML body.
 */
export function renderTemplate(
    templateId: string,
    variables: Record<string, string>
): { subject: string; htmlBody: string } | null {
    const template = getTemplate(templateId);
    if (!template) return null;

    let subject = template.subject;
    let htmlBody = template.htmlBody;

    for (const [key, value] of Object.entries(variables)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(pattern, value);
        htmlBody = htmlBody.replace(pattern, value);
    }

    return { subject, htmlBody };
}

/**
 * Get the default From address for a template.
 */
export function getTemplateFrom(templateId: string): string {
    const template = getTemplate(templateId);
    return template?.defaultFrom || getDefaultFrom();
}

/**
 * Get the default Reply-To address for a template.
 */
export function getTemplateReplyTo(templateId: string): string {
    const template = getTemplate(templateId);
    return template?.defaultReplyTo || getDefaultReplyTo();
}
