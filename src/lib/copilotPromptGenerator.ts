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
        `- Named Insured / Client Name: ${ctx.clientName}`,
        `- Policy Number: ${ctx.policyNumber}`,
        `- Property Address: ${ctx.propertyAddress}`,
    ];
    if (ctx.expirationDate) lines.push(`- Policy Expiration Date: ${ctx.expirationDate}`);
    if (ctx.effectiveDate) lines.push(`- Policy Effective Date: ${ctx.effectiveDate}`);
    if (ctx.annualPremium) lines.push(`- Annual Premium: ${ctx.annualPremium}`);
    if (ctx.paymentMethod) lines.push(`- Payment Method: ${ctx.paymentMethod}`);
    if (ctx.mortgageeName) lines.push(`- Mortgagee / Lender: ${ctx.mortgageeName}`);
    if (ctx.carrierStatus) lines.push(`- Policy Status: ${ctx.carrierStatus}`);
    if (ctx.reportUrl) lines.push(`- Coverage Report URL: ${ctx.reportUrl}`);
    if (ctx.rceDownloadUrl) lines.push(`- RCE Estimate PDF URL: ${ctx.rceDownloadUrl}`);
    if (ctx.meetingUrl) lines.push(`- Meeting Scheduling Link: ${ctx.meetingUrl}`);
    return lines.join('\n');
}

const MASTER_GUARDRAIL_RULES = `
STRICT AGENCY RULES & GUARDRAILS (YOU MUST FOLLOW ALL OF THESE):
1. AGENCY IDENTITY & SIGN-OFF: Do NOT introduce a named individual agent or share personal stories. Sign off ONLY as:
   Alsop and Associates Insurance Agency
   (909) 626-5000 | support@coveragechecknow.com

2. PERMISSION-BASED FRAMING: Frame all coverage increases or adjustments as recommendations only. Explicitly state that we request client permission before making any changes to their policy.

3. NON-JUDGMENTAL COMPARATIVE TONE (STRICT BAN):
   - NEVER use words like "adequate", "inadequate", "deficient", "underinsured", "poor", or "lacking".
   - Describe coverage differences neutrally by comparing current policy limits directly to updated replacement cost estimates and available options.

4. CLIENT RESPONSIBILITY DISCLAIMER: You must include this exact notice near the end of the email:
   "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."

5. CONCISENESS & RESPECT FOR TIME: Keep the entire email concise (under 200 words). Reassure the client that an annual review takes only a few minutes.

6. OFFICE PHONE & CONTACT: Direct the client to call our main office at (909) 626-5000 to speak with a licensed agent or use the meeting link if provided.

7. PREPARATION CHECKLIST: Encourage the client to have handy any questions, concerns, or feedback they would like to discuss during the review. Do NOT ask for mortgage statements or other policy dec pages.

8. OUTPUT FORMAT: Output ONLY the Subject line and the complete email body ready to send. Do NOT include conversational preambles, introductory filler ("Here is the email draft:"), or surrounding code block backticks.`.trim();

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const PROMPT_TEMPLATES: Record<PromptTemplateId, PromptTemplate> = {

    rce_verification: {
        id: 'rce_verification',
        name: 'Campaign 1: Verify RCE Property Data',
        description: 'Ask client to verify property specs (sq ft, features) from the Replacement Cost Estimate.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm, permission-based email requesting that a policyholder review and verify the property specifications on their Replacement Cost Estimate (RCE).

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Ask the client to review and verify their property details (square footage, year built, construction quality, roof age) shown on their attached Replacement Cost Estimate (RCE). Explain that accurate property data ensures their replacement cost calculation properly reflects current construction costs.

${MASTER_GUARDRAIL_RULES}`,
    },

    coverage_recommendations_meeting: {
        id: 'coverage_recommendations_meeting',
        name: 'Campaign 2: Coverage Recommendations & Meeting',
        description: 'Present coverage findings, request permission to apply increases, and invite to Outlook meeting.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email presenting annual coverage recommendations and requesting client permission to review and update coverage.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Highlight key coverage differences identified during our annual review when comparing current policy limits against updated replacement cost estimates. Request permission from the client to apply recommended adjustments, and invite them to schedule a brief appointment or call our office.

${MASTER_GUARDRAIL_RULES}`,
    },

    renewal_notice_insured: {
        id: 'renewal_notice_insured',
        name: 'Renewal Notice — Insured Billed',
        description: 'For clients who pay their own CFP bill. Prompts CoPilot to draft a payment-due notification.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm renewal review email to a California Fair Plan policyholder who pays their renewal premium directly.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Notify the client that their California Fair Plan policy renewal is approaching. Explain the value of an annual review (preventing coverage lapses, closing coverage gaps, ensuring limits keep pace with construction costs). Ask permission to review coverage recommendations prior to finalizing payment.

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow):
---
Subject: Your California Fair Plan Renewal Is Approaching — Policy ${ctx.policyNumber}

Hi ${ctx.clientName || 'Valued Client'},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your California Fair Plan policy (${ctx.policyNumber}) for ${ctx.propertyAddress} is coming up for renewal on ${ctx.expirationDate || 'your renewal date'}, now is a great time to review your coverage.

As part of our annual review process, we have prepared updated materials for your consideration:

${ctx.reportUrl ? `• Coverage Report: ${ctx.reportUrl}\n` : ''}${ctx.rceDownloadUrl ? `• Updated Replacement Cost Estimate: ${ctx.rceDownloadUrl}\n` : ''}
The review may highlight differences between your current coverage and updated replacement cost information. Any changes are recommendations only — we always request your permission before making updates to your policy.

To make the most of our review, please have handy any questions, concerns, or feedback you would like to discuss.

We won't take too much of your time. To speak with a licensed agent, please call our main office at (909) 626-5000${ctx.meetingUrl ? ` or schedule a review online at ${ctx.meetingUrl}` : ''}.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

${MASTER_GUARDRAIL_RULES}`,
    },

    renewal_notice_mortgage: {
        id: 'renewal_notice_mortgage',
        name: 'Renewal Notice — Mortgage Billed',
        description: 'For clients whose lender pays CFP. Prompts CoPilot to draft a mortgage-billed renewal notice.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm renewal review email to a California Fair Plan policyholder whose renewal premium is paid through mortgage escrow.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Inform the client that their California Fair Plan renewal is approaching. Clarify that while their mortgage escrow account handles the premium payment, conducting an annual coverage review ensures their property remains fully protected against current rebuilding costs. Request permission to review potential coverage updates.

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow):
---
Subject: Important Renewal Review Notice — Policy ${ctx.policyNumber}

Hi ${ctx.clientName || 'Valued Client'},

Your California Fair Plan policy (${ctx.policyNumber}) for ${ctx.propertyAddress} is approaching its upcoming renewal on ${ctx.expirationDate || 'your renewal date'}. While your mortgage lender (${ctx.mortgageeName || 'your mortgage escrow account'}) handles premium payments, conducting an annual review ensures your coverage limits align with current rebuilding costs.

As part of our annual review process, we have prepared updated materials for your consideration:

${ctx.reportUrl ? `• Coverage Report: ${ctx.reportUrl}\n` : ''}${ctx.rceDownloadUrl ? `• Updated Replacement Cost Estimate: ${ctx.rceDownloadUrl}\n` : ''}
Any suggested adjustments are recommendations only — we always request your permission before making any changes to your policy.

To assist with our review, please have handy any questions, concerns, or feedback you would like to share.

We respect your time and this quick review will ensure your renewal stays on track. Call our office at (909) 626-5000${ctx.meetingUrl ? ` or schedule a review at ${ctx.meetingUrl}` : ''}.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and continued trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

${MASTER_GUARDRAIL_RULES}`,
    },

    schedule_review: {
        id: 'schedule_review',
        name: 'Schedule Coverage Review',
        description: 'Invite the client to schedule a coverage review appointment.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email inviting a policyholder to schedule a policy review appointment.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Invite the client to schedule a brief appointment to review their coverage options and discuss recommended policy updates. Reassure them that the review is quick, permission-based, and designed to protect their property investment.

${MASTER_GUARDRAIL_RULES}`,
    },

    custom: {
        id: 'custom',
        name: 'Custom Prompt',
        description: 'Provide your own purpose — CoPilot drafts based on the context you supply.',
        generate: (ctx) => `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email to a California Fair Plan policyholder.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE: [Describe the purpose of this email]

${MASTER_GUARDRAIL_RULES}`,
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
