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
// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Strips parentheses, explicit term labels ("Term 1"), and trailing term/sequence suffixes
 * from a raw policy number string.
 */
export function cleanPolicyNumber(rawPolicy: string | null | undefined): string {
    if (!rawPolicy) return '';
    let s = rawPolicy.replace(/[()]/g, '').trim();
    s = s.replace(/\s*[-–—]?\s*term\s*\d*\b/gi, '').trim();
    s = s.replace(/(\d{6,})[-_\s]+(\d{1,2})$/, '$1').trim();
    return s;
}

function formatContextBlock(ctx: CoPilotPromptContext): string {
    const cleanPolicy = cleanPolicyNumber(ctx.policyNumber) || 'N/A';
    const lines = [
        `- Named Insured / Client Name: ${ctx.clientName || 'Valued Client'}`,
        `- Policy Number: ${cleanPolicy}`,
        `- Property Address: ${ctx.propertyAddress || 'N/A'}`,
    ];
    if (ctx.expirationDate) lines.push(`- Policy Expiration Date: ${ctx.expirationDate}`);
    if (ctx.effectiveDate) lines.push(`- Policy Effective Date: ${ctx.effectiveDate}`);
    if (ctx.annualPremium) lines.push(`- Annual Premium: ${ctx.annualPremium}`);
    if (ctx.paymentMethod) lines.push(`- Payment Method: ${ctx.paymentMethod}`);
    if (ctx.mortgageeName) lines.push(`- Mortgagee / Lender: ${ctx.mortgageeName}`);
    if (ctx.meetingUrl) lines.push(`- Calendly / Meeting Scheduling Link: ${ctx.meetingUrl}`);
    lines.push(`- Attached Files: Coverage Report & Replacement Cost Estimate (RCE) attached to email`);
    return lines.join('\n');
}

const MASTER_GUARDRAIL_RULES = `
STRICT AGENCY RULES & GUARDRAILS (YOU MUST FOLLOW ALL OF THESE):
1. AGENCY IDENTITY & SIGN-OFF: Do NOT introduce a named individual agent or share personal stories. Sign off ONLY as:
   Alsop and Associates Insurance Agency
   (909) 626-5000 | support@coveragechecknow.com

2. NO PRE-REVIEW CHANGES & PERMISSION-BASED FRAMING: Explicitly state that NO changes have been made to the client's policy. Frame all coverage adjustments strictly as recommendations for their review, and emphasize that no updates are ever made without the client's explicit permission.

3. POLICY NUMBER FORMAT (NO PARENTHESES, NO TERMS): Do NOT enclose the policy number in parentheses in the email subject line or body text. Do NOT include term numbers or sequence suffixes (e.g. write "policy 0102162693" or "policy CFP 0102162693", never "policy (0102162693)" or "0102162693-01").

4. NON-JUDGMENTAL COMPARATIVE TONE (STRICT BAN):
   - NEVER use words like "adequate", "inadequate", "deficient", "underinsured", "poor", or "lacking".
   - Describe coverage differences neutrally by comparing current policy limits directly to updated replacement cost estimates and available options.

5. MANUAL ATTACHMENTS (NO DOWNLOAD LINKS): State that the Coverage Report and Replacement Cost Estimate (RCE) are attached directly to the email. Do NOT generate file URLs or download links.

6. CALENDLY & CONTACT PRIORITY: Prioritize the Calendly scheduling link as the primary call to action for booking a dedicated review appointment. Offer the office phone number (909) 626-5000 secondarily if the client requires immediate assistance.

7. CLIENT RESPONSIBILITY DISCLAIMER: You must include this notice near the end of the email:
   "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."

8. CONCISENESS & RESPECT FOR TIME: Keep the entire email concise (under 200 words). Reassure the client that an annual review takes only a few minutes.

9. PREPARATION CHECKLIST: Encourage the client to have handy any questions, concerns, or feedback they would like to discuss during the review. Do NOT ask for mortgage statements or other policy dec pages.

10. NO PHYSICAL ADDRESS IN EMAIL TEXT: Do NOT include the physical property address anywhere in the email subject line or body text. Identify the policy strictly by policy number.

11. OUTPUT FORMAT: Output ONLY the Subject line and the complete email body ready to send. Do NOT include conversational preambles, introductory filler ("Here is the email draft:"), or surrounding code block backticks.`.trim();

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const PROMPT_TEMPLATES: Record<PromptTemplateId, PromptTemplate> = {

    renewal_notice_insured: {
        id: 'renewal_notice_insured',
        name: 'Annual Renewal Notice',
        description: 'For clients with upcoming renewals. Prompts CoPilot to draft a permission-requesting review email.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            const contactSentence = ctx.meetingUrl
                ? `We encourage you to schedule a quick review at a time that works best for you on our calendar: ${ctx.meetingUrl}. If you need immediate assistance or prefer to reach us right away, you are also welcome to call our office directly at (909) 626-5000.`
                : `To schedule a review or speak with an agent, please call our main office at (909) 626-5000.`;

            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm renewal review email to a policyholder regarding policy ${cleanPolicy}, expiring on ${ctx.expirationDate || 'upcoming renewal date'}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Notify the client that their policy renewal is approaching. Explain the value of an annual review (preventing coverage lapses, closing coverage gaps, ensuring limits keep pace with construction costs). Explicitly clarify that NO changes have been made to their policy pre-review and ask permission to review coverage recommendations. Prioritize scheduling via Calendly, with the office phone number offered for immediate assistance.

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow):
---
Subject: Your Policy Renewal Is Approaching — Policy ${cleanPolicy}

Hi ${ctx.clientName ? ctx.clientName.trim().split(/\s+/)[0] : 'Valued Client'},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your policy ${cleanPolicy} is coming up for renewal on ${ctx.expirationDate || 'your renewal date'}, now is a great time to review your coverage.

As part of our annual review process, we have evaluated your current policy limits and attached your updated Coverage Report and Replacement Cost Estimate (RCE) to this email for your review.

The review may highlight differences between your current coverage and updated replacement cost estimates. Please note that no changes have been made to your policy — all coverage adjustments are strictly recommendations for your review, and we will never make updates without your explicit permission.

To make the most of our review, please have handy any questions, concerns, or feedback you would like to discuss.

We won't take too much of your time. ${contactSentence}

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

${MASTER_GUARDRAIL_RULES}`;
        },
    },

    rce_verification: {
        id: 'rce_verification',
        name: 'Verify Replacement Cost Estimate',
        description: 'Ask client to verify property specs (sq ft, features) from the attached Replacement Cost Estimate.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm, permission-based email requesting that policyholder ${ctx.clientName || 'Valued Client'} review and verify the property specifications on their attached Replacement Cost Estimate (RCE) for policy ${cleanPolicy}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Ask the client to review and verify their property details (square footage, year built, construction quality, roof age) shown on their attached Replacement Cost Estimate (RCE). Explain that accurate property data ensures their replacement cost calculation properly reflects current construction costs. Explicitly state that NO changes have been made to their policy pre-review. Prioritize scheduling via Calendly${ctx.meetingUrl ? ` (${ctx.meetingUrl})` : ''}, with office phone (909) 626-5000 for immediate assistance.

${MASTER_GUARDRAIL_RULES}`;
        },
    },

    coverage_recommendations_meeting: {
        id: 'coverage_recommendations_meeting',
        name: 'Coverage Recommendations & Consultation',
        description: 'Present coverage findings, request permission to apply increases, and invite to Calendly meeting.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email presenting annual coverage recommendations and requesting client permission to review and update coverage for policy ${cleanPolicy}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Highlight key coverage differences identified during our annual review when comparing current policy limits against updated replacement cost estimates. Explicitly clarify that NO changes have been made to their policy pre-review. Request permission from the client to review recommended adjustments, and invite them to schedule a brief appointment via Calendly${ctx.meetingUrl ? ` (${ctx.meetingUrl})` : ''} as primary, or call our office at (909) 626-5000 for immediate assistance.

${MASTER_GUARDRAIL_RULES}`;
        },
    },

    renewal_notice_mortgage: {
        id: 'renewal_notice_mortgage',
        name: 'Renewal Notice — Mortgage Escrow',
        description: 'For clients whose lender pays premium through escrow.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            const contactSentence = ctx.meetingUrl
                ? `We encourage you to schedule a convenient review on our calendar: ${ctx.meetingUrl}. If you require immediate assistance, you can also reach our office directly at (909) 626-5000.`
                : `To schedule a review or speak with an agent, please call our main office at (909) 626-5000.`;

            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm renewal review email to a policyholder whose renewal premium is paid through mortgage escrow regarding policy ${cleanPolicy}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Inform the client that their policy renewal is approaching. Clarify that while their mortgage escrow account (${ctx.mortgageeName || 'mortgage escrow'}) handles premium payments, conducting an annual coverage review ensures their property remains fully protected against current rebuilding costs. Explicitly state that NO changes have been made to their policy pre-review. Request permission to review potential coverage recommendations. Prioritize scheduling via Calendly, with office phone for immediate assistance.

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow):
---
Subject: Important Renewal Review Notice — Policy ${cleanPolicy}

Hi ${ctx.clientName ? ctx.clientName.trim().split(/\s+/)[0] : 'Valued Client'},

Your policy ${cleanPolicy} is approaching its upcoming renewal on ${ctx.expirationDate || 'your renewal date'}. While your mortgage lender (${ctx.mortgageeName || 'your mortgage escrow account'}) handles premium payments, conducting an annual review ensures your coverage limits align with current rebuilding costs.

As part of our annual review process, we have attached your updated Coverage Report and Replacement Cost Estimate (RCE) to this email for your review.

Please note that no changes have been made to your policy. Any suggested adjustments are recommendations only for your consideration — we always request your explicit permission before making updates to your policy.

To assist with our review, please have handy any questions, concerns, or feedback you would like to share.

We respect your time and this quick review will ensure your renewal stays on track. ${contactSentence}

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and continued trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

${MASTER_GUARDRAIL_RULES}`;
        },
    },

    schedule_review: {
        id: 'schedule_review',
        name: 'Schedule Coverage Review',
        description: 'Invite the client to schedule a coverage review appointment.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email inviting a policyholder to schedule a policy review appointment for policy ${cleanPolicy}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE:
Invite the client to schedule a brief appointment on our calendar${ctx.meetingUrl ? ` (${ctx.meetingUrl})` : ''} to review their coverage options and discuss recommended policy updates. Reassure them that no changes have been made pre-review, the review is quick and permission-based, and designed to protect their property investment. Offer office phone (909) 626-5000 for immediate needs.

${MASTER_GUARDRAIL_RULES}`;
        },
    },

    custom: {
        id: 'custom',
        name: 'Custom Prompt',
        description: 'Provide your own purpose — CoPilot drafts based on the context you supply.',
        generate: (ctx) => {
            const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
            return `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email to a policyholder regarding policy ${cleanPolicy}.

CLIENT & POLICY DETAILS:
${formatContextBlock(ctx)}

EMAIL PURPOSE: [Describe the purpose of this email — note that no changes have been made to the policy pre-review]

${MASTER_GUARDRAIL_RULES}`;
        },
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
