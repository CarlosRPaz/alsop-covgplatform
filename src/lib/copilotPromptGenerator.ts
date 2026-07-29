/**
 * CoPilot Prompt Generator
 *
 * Generates structured prompts that agents can paste into Allstate CoPilot
 * to have it draft professional emails with full policy/client context.
 *
 * This does NOT send any emails — it only produces text prompts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoPilotPromptContext {
    clientName: string;
    clientEmail?: string;
    policyNumber: string;
    propertyAddress: string;
    agentName: string;
    expirationDate?: string;
    effectiveDate?: string;
    annualPremium?: string;
    paymentMethod?: string;        // 'insured' | 'mortgage' | etc.
    mortgageeName?: string;
    carrierStatus?: string;
    reportUrl?: string;
    rceDownloadUrl?: string;
    meetingUrl?: string;
}

export type PromptTemplateId =
    | 'renewal_notice_insured'
    | 'renewal_notice_mortgage'
    | 'rce_verification'
    | 'coverage_recommendations_meeting'
    | 'schedule_review'
    | 'custom';

export interface PromptTemplate {
    id: PromptTemplateId;
    name: string;
    description: string;
    /** Generate the full CoPilot prompt for this template */
    generate: (ctx: CoPilotPromptContext) => string;
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function formatContextBlock(ctx: CoPilotPromptContext): string {
    const lines = [
        `- Name: ${ctx.clientName}`,
        `- Policy Number: ${ctx.policyNumber}`,
        `- Property Address: ${ctx.propertyAddress}`,
    ];
    if (ctx.expirationDate) lines.push(`- Expiration Date: ${ctx.expirationDate}`);
    if (ctx.effectiveDate) lines.push(`- Effective Date: ${ctx.effectiveDate}`);
    if (ctx.annualPremium) lines.push(`- Annual Premium: ${ctx.annualPremium}`);
    if (ctx.paymentMethod) lines.push(`- Payment Method: ${ctx.paymentMethod}`);
    if (ctx.mortgageeName) lines.push(`- Mortgagee: ${ctx.mortgageeName}`);
    if (ctx.carrierStatus) lines.push(`- Policy Status: ${ctx.carrierStatus}`);
    return lines.join('\n');
}

const TONE_AND_RULES = `
Tone & Guardrails:
- Tone: Professional, warm, permission-requesting, and advisory. Written as an insurance agent from Alsop and Associates Insurance Agency.
- Framing: Explain where we identified coverage differences or missing options compared to their previous policy. Request permission to make recommended coverage adjustments where appropriate.
- Disclaimer: Clarify that final coverage selection and decisions rest with the policyholder.
- Requirements:
  - Address the client by first name
  - Mention the specific policy number and property address
  - Include a clear call-to-action (e.g. reply to confirm permission or schedule a review)
  - Keep under 200 words
  - Sign off with agent name and "Alsop and Associates Insurance Agency"`.trim();

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const PROMPT_TEMPLATES: Record<PromptTemplateId, PromptTemplate> = {

    rce_verification: {
        id: 'rce_verification',
        name: 'Campaign 1: Verify RCE Property Data',
        description: 'Ask client to verify property specs (sq ft, features) from the Replacement Cost Estimate.',
        generate: (ctx) => `Draft a professional email to a policyholder requesting verification of their Replacement Cost Estimate (RCE) property details.

Client Details:
${formatContextBlock(ctx)}

Email Purpose: Ask the client to review and verify their property specifications (such as square footage, year built, and construction features) noted on their Replacement Cost Estimate (attached as a PDF). Explain that accurate property data ensures their replacement cost calculation aligns with current construction costs.

${TONE_AND_RULES}`,
    },

    coverage_recommendations_meeting: {
        id: 'coverage_recommendations_meeting',
        name: 'Campaign 2: Coverage Recommendations & Meeting',
        description: 'Present coverage findings, request permission to apply increases, and invite to Outlook meeting.',
        generate: (ctx) => `Draft a professional email presenting coverage recommendations and requesting client permission to make updates.

Client Details:
${formatContextBlock(ctx)}
${ctx.reportUrl ? `- Full Coverage Report: ${ctx.reportUrl}` : ''}

Email Purpose: Highlight coverage options or differences identified when comparing their previous policy with current replacement cost estimates. Request permission from the client to apply recommended coverage increases where appropriate. Invite them to accept the proposed adjustments or schedule a quick meeting to review together.

${TONE_AND_RULES}`,
    },

    renewal_notice_insured: {
        id: 'renewal_notice_insured',
        name: 'Renewal Notice — Insured Billed',
        description: 'For clients who pay their own CFP bill. Prompts CoPilot to draft a payment-due notification.',
        generate: (ctx) => `Draft a professional email to a California Fair Plan policyholder about their upcoming renewal.

Client Details:
${formatContextBlock(ctx)}

Email Purpose: Notify the client that their California Fair Plan renewal payment is due soon and ask for their permission to review potential coverage updates before payment is finalized. The client pays their own bill directly.

${TONE_AND_RULES}`,
    },

    renewal_notice_mortgage: {
        id: 'renewal_notice_mortgage',
        name: 'Renewal Notice — Mortgage Billed',
        description: 'For clients whose lender pays CFP. Prompts CoPilot to draft a mortgage-billed renewal notice.',
        generate: (ctx) => `Draft a professional email to a California Fair Plan policyholder about their upcoming renewal.

Client Details:
${formatContextBlock(ctx)}

Email Purpose: Inform the client that their California Fair Plan policy renewal is approaching. Their mortgage company handles payment through escrow, but ask for permission to review recommended coverage adjustments prior to renewal.

${TONE_AND_RULES}`,
    },

    schedule_review: {
        id: 'schedule_review',
        name: 'Schedule Coverage Review',
        description: 'Invite the client to schedule a coverage review appointment.',
        generate: (ctx) => `Draft a professional email to a California Fair Plan policyholder inviting them to schedule a coverage review.

Client Details:
${formatContextBlock(ctx)}
${ctx.reportUrl ? `- Coverage Report: ${ctx.reportUrl}` : ''}

Email Purpose: Invite the client to schedule a time to review their insurance coverage options and discuss recommended policy updates.
${ctx.reportUrl ? '\nMention that a coverage report is ready for them to review.' : ''}

${TONE_AND_RULES}`,
    },

    custom: {
        id: 'custom',
        name: 'Custom Prompt',
        description: 'Provide your own purpose — CoPilot drafts based on the context you supply.',
        generate: (ctx) => `Draft a professional email to a California Fair Plan policyholder.

Client Details:
${formatContextBlock(ctx)}

Email Purpose: [DESCRIBE THE PURPOSE OF THIS EMAIL]

${TONE_AND_RULES}`,
    },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get all available CoPilot prompt templates */
export function getCoPilotTemplates(): PromptTemplate[] {
    return Object.values(PROMPT_TEMPLATES);
}

/** Get a specific CoPilot prompt template by ID */
export function getTemplate(id: PromptTemplateId): PromptTemplate | null {
    return PROMPT_TEMPLATES[id] || null;
}

/** Generate a CoPilot prompt for the given template and context */
export function generateCoPilotPrompt(
    templateId: PromptTemplateId,
    ctx: CoPilotPromptContext
): string {
    const template = PROMPT_TEMPLATES[templateId];
    if (!template) return '';
    return template.generate(ctx);
}

/**
 * Generate a plain-text email draft from the preview body content.
 * This converts the rendered preview into copyable text.
 */
export function generateEmailDraftText(opts: {
    subject: string;
    body: string;
    from?: string;
    agentName: string;
}): string {
    const lines = [];
    lines.push(`Subject: ${opts.subject}`);
    if (opts.from) lines.push(`From: ${opts.from}`);
    lines.push('');
    lines.push(opts.body);
    lines.push('');
    lines.push(opts.agentName);
    lines.push('Alsop and Associates Insurance Agency');
    lines.push('');
    lines.push('Notice: This draft is provided for informational purposes. Final coverage selection remains the responsibility of the policyholder.');
    return lines.join('\n');
}
