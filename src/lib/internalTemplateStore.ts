/**
 * Internal Email Template & Rule Store Engine
 *
 * Manages native agency templates and template rules locally.
 * Completely decoupled from external Postmark templates.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateRule {
    id: string;
    label: string;
    instruction: string;
    enabled: boolean;
}

export interface SystemEmailTemplate {
    id: string;
    name: string;
    category: 'rce' | 'recommendations' | 'renewal' | 'review' | 'custom';
    description: string;
    subjectTemplate: string;
    draftBodyTemplate: string;
    copilotPromptTemplate: string;
    rules: TemplateRule[];
    variables: string[];
    isSystemDefault?: boolean;
}

export interface TemplateContext {
    clientName: string;
    clientEmail?: string;
    policyNumber: string;
    propertyAddress: string;
    agentName: string;
    expirationDate?: string;
    effectiveDate?: string;
    annualPremium?: string;
    paymentMethod?: string;
    mortgageeName?: string;
    carrierStatus?: string;
    reportUrl?: string;
    rceDownloadUrl?: string;
    meetingUrl?: string;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Storage Keys & Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cfp_internal_email_templates_v5';

/**
 * Strips parentheses, explicit term labels ("Term 1"), and trailing term/sequence suffixes
 * from a raw policy number string.
 *
 * Examples:
 *  "(0102162693)" -> "0102162693"
 *  "CFP 0102162693 01" -> "CFP 0102162693"
 *  "0102162693-01" -> "0102162693"
 *  "0102162693 - Term 2" -> "0102162693"
 *  "CFP-9842104-1" -> "CFP-9842104"
 */
export function cleanPolicyNumber(rawPolicy: string | null | undefined): string {
    if (!rawPolicy) return '';
    let s = rawPolicy.replace(/[()]/g, '').trim();
    // Strip explicit "Term X" or "Term"
    s = s.replace(/\s*[-–—]?\s*term\s*\d*\b/gi, '').trim();
    // Strip trailing 1 or 2 digit term/sequence suffix after a hyphen, underscore, or space
    s = s.replace(/(\d{6,})[-_\s]+(\d{1,2})$/, '$1').trim();
    return s;
}

export const AVAILABLE_VARIABLES = [
    { tag: '{{first_name}}', description: 'Client First Name' },
    { tag: '{{client_name}}', description: 'Named Insured / Full Client Name' },
    { tag: '{{policy_number}}', description: 'Clean Policy Number (no parens/terms)' },
    { tag: '{{expiration_date}}', description: 'Policy Expiration Date' },
    { tag: '{{meeting_url}}', description: 'Calendly / Meeting Scheduling Link' },
    { tag: '{{property_address}}', description: 'Insured Property Location' },
    { tag: '{{effective_date}}', description: 'Policy Effective Date' },
    { tag: '{{annual_premium}}', description: 'Annual Policy Premium' },
    { tag: '{{payment_method}}', description: 'Payment Method (Direct / Mortgage)' },
    { tag: '{{agent_name}}', description: 'Agency / Agent Name' },
    { tag: '{{client_email}}', description: 'Client Email Address' },
];

export const STANDARD_RULES: TemplateRule[] = [
    {
        id: 'no_pre_review_changes',
        label: 'No Pre-Review Changes & Permission-Based Recommendations',
        instruction: 'Explicitly state that NO changes have been made to the client’s policy pre-review. Frame all coverage adjustments strictly as recommendations for their review, and emphasize that no updates are ever made without the client’s explicit permission.',
        enabled: true,
    },
    {
        id: 'clean_policy_number_format',
        label: 'Clean Policy Number (No Parentheses, No Terms)',
        instruction: 'Never enclose the policy number in parentheses in the email text or subject line. Never include term numbers or sequence suffixes (e.g. write "policy 0102162693" or "policy CFP 0102162693", never "policy (0102162693)" or "policy 0102162693-01").',
        enabled: true,
    },
    {
        id: 'prioritize_calendly',
        label: 'Prioritize Calendly Booking with Office Phone as Secondary',
        instruction: 'Prioritize the Calendly scheduling link as the primary call to action for booking a dedicated review appointment. Offer the office phone number (909) 626-5000 secondarily if the client requires immediate assistance.',
        enabled: true,
    },
    {
        id: 'client_responsibility',
        label: 'Client Responsibility Disclaimer',
        instruction: 'State clearly that final coverage selection and decisions remain the responsibility of the policyholder.',
        enabled: true,
    },
    {
        id: 'non_judgmental',
        label: 'Non-Judgmental Comparative Tone',
        instruction: 'Never use words like "adequate", "inadequate", "deficient", "underinsured", "poor", or "lacking". Simply explain coverage found on the previous policy versus available options and updated replacement cost estimates.',
        enabled: true,
    },
    {
        id: 'concise_length',
        label: 'Concise Length (Under 200 Words)',
        instruction: 'Keep the draft email direct, professional, and under 200 words.',
        enabled: true,
    },
];

// ---------------------------------------------------------------------------
// Default System Templates (Refreshed with Calendly & Manual Attachments)
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATES: SystemEmailTemplate[] = [
    {
        id: 'renewal_review',
        name: 'Annual Renewal Review Notice',
        category: 'renewal',
        description: 'Notice of upcoming policy renewal with attached Replacement Cost Estimate (RCE) & generated Coverage Report, offering a Calendly review appointment.',
        subjectTemplate: 'Your Policy Renewal Is Approaching — Policy {{policy_number}}',
        draftBodyTemplate: `Hi {{first_name}},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your policy {{policy_number}} is coming up for renewal on {{expiration_date}}, now is a great time to review your coverage.

As part of our annual review process, we have evaluated your current policy limits and attached your Replacement Cost Estimate (RCE) along with a generated Coverage Report to this email for your review.

The review may highlight differences between your current coverage and updated replacement cost estimates. Please note that no changes have been made to your policy — all coverage adjustments are strictly recommendations for your review, and we will never make updates without your explicit permission.

To make the most of our conversation, please have handy any questions, concerns, or feedback you'd like to share.

We won't take too much of your time. We encourage you to schedule a quick review on our calendar at a time that works best for you: {{meeting_url}}. If you need immediate assistance or prefer to reach us right away, you are also welcome to call our office directly at (909) 626-5000.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com`,
        copilotPromptTemplate: `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm, permission-based renewal review email for policyholder {{client_name}} regarding policy {{policy_number}}, expiring on {{expiration_date}}.

CLIENT & POLICY DETAILS:
- Client Name: {{client_name}}
- Policy Number: {{policy_number}}
- Insured Property Address: {{property_address}}
- Expiration Date: {{expiration_date}}
- Effective Date: {{effective_date}}
- Annual Premium: {{annual_premium}}
- Payment Method: {{payment_method}}
- Calendly Scheduling Link: {{meeting_url}}
- Attachments: Replacement Cost Estimate (RCE) and generated Coverage Report attached directly to the email

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow closely):
---
Subject: Your Policy Renewal Is Approaching — Policy {{policy_number}}

Hi {{first_name}},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your policy {{policy_number}} is coming up for renewal on {{expiration_date}}, now is a great time to review your coverage.

As part of our annual review process, we have evaluated your current policy limits and attached your Replacement Cost Estimate (RCE) along with a generated Coverage Report to this email for your review.

The review may highlight differences between your current coverage and updated replacement cost estimates. Please note that no changes have been made to your policy — all coverage adjustments are strictly recommendations for your review, and we will never make updates without your explicit permission.

To make the most of our review, please have handy any questions, concerns, or feedback you'd like to share.

We won't take too much of your time. We encourage you to schedule a quick review on our calendar at a time that works best for you: {{meeting_url}}. If you need immediate assistance, you are also welcome to call our office directly at (909) 626-5000.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

STRICT AGENCY RULES & GUARDRAILS (YOU MUST FOLLOW ALL OF THESE):
1. AGENCY IDENTITY & SIGN-OFF: Do NOT include a personal agent name or introduction. Sign off ONLY as "Alsop and Associates Insurance Agency" with phone (909) 626-5000 and support@coveragechecknow.com.
2. NO PRE-REVIEW CHANGES & PERMISSION-BASED FRAMING: Explicitly state that NO changes have been made to the client's policy. Frame all coverage adjustments strictly as recommendations for their review, and emphasize that no updates are ever made without the client's explicit permission.
3. POLICY NUMBER FORMAT (NO PARENTHESES, NO TERMS): Do NOT enclose the policy number in parentheses in the email text or subject. Do NOT include term numbers or sequence suffixes (e.g. write "policy {{policy_number}}", never "policy ({{policy_number}})" or "{{policy_number}}-01").
4. CALENDLY & CONTACT PRIORITY: Prioritize the Calendly scheduling link ({{meeting_url}}) as the primary call to action for booking a dedicated review appointment. Offer the office phone number (909) 626-5000 secondarily if the client requires immediate assistance.
5. NON-JUDGMENTAL COMPARATIVE TONE (STRICT BAN): NEVER use words like "adequate", "inadequate", "deficient", "underinsured", "poor", or "lacking". Describe coverage neutrally by comparing current limits to updated replacement cost estimates.
6. ATTACHMENT REFERENCING (RCE FIRST, GENERATED COVERAGE REPORT): State that the Replacement Cost Estimate (RCE) and a generated Coverage Report are attached directly to the email (always list the RCE first, and refer to the report as a generated coverage report rather than an 'updated' report). Do NOT output file URLs or download links.
7. CLIENT RESPONSIBILITY DISCLAIMER: Include the statement: "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."
8. CONCISENESS & RESPECT FOR TIME: Keep the email concise — under 200 words — and reassure the client the review takes only a few minutes.
9. PREPARATION CHECKLIST: Encourage the client to have handy any questions, concerns, or feedback they would like to discuss. Do NOT ask for mortgage statements or other policy dec pages.
10. NO PHYSICAL ADDRESS IN EMAIL TEXT: Do NOT include the physical property address anywhere in the email subject line or body text. Identify the policy strictly by policy number.
11. OUTPUT FORMAT: Output ONLY the Subject line and the complete email body ready to send. Do NOT include conversational preamble or surrounding code block backticks.`,
        rules: [
            ...STANDARD_RULES,
            {
                id: 'include_preparation_checklist',
                label: 'Include Preparation Checklist',
                instruction: 'Encourage the client to have ready any questions, concerns, or feedback for the review.',
                enabled: true,
            },
        ],
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{expiration_date}}', '{{meeting_url}}', '{{property_address}}', '{{agent_name}}'],
        isSystemDefault: true,
    },
    {
        id: 'rce_verification',
        name: 'Verify Replacement Cost Estimate',
        category: 'rce',
        description: 'Ask client to verify property specs on their attached Replacement Cost Estimate (RCE).',
        subjectTemplate: 'Please Verify Your Property Details — Policy {{policy_number}}',
        draftBodyTemplate: `Hi {{first_name}},

As part of your upcoming policy review for policy {{policy_number}}, we have attached an updated Replacement Cost Estimate (RCE) to help ensure your home is properly valued against current construction and labor costs.

Please take a moment to review the attached estimate, specifically:
• Living area square footage
• Year built & construction details
• Any recent renovations or additions

Please note that no changes have been made to your policy. Any coverage adjustments discussed during our review are strictly recommendations for your consideration, and updates are only made with your explicit permission.

If any specifications need updating, or if you have questions, we encourage you to schedule a quick review on our calendar: {{meeting_url}}. If you need immediate assistance, you are also welcome to call our office directly at (909) 626-5000.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com`,
        copilotPromptTemplate: `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email requesting that policyholder {{client_name}} review and verify the property specifications on their attached Replacement Cost Estimate (RCE) for policy {{policy_number}}.

CLIENT & POLICY DETAILS:
- Client Name: {{client_name}}
- Policy Number: {{policy_number}}
- Expiration Date: {{expiration_date}}
- Calendly Scheduling Link: {{meeting_url}}
- Attachment: Replacement Cost Estimate (RCE) attached directly to the email

EMAIL PURPOSE:
Ask the client to review and verify their property details (square footage, year built, renovations) shown on their attached Replacement Cost Estimate (RCE). Explain that accurate property data ensures their replacement cost calculation properly reflects current construction costs. Explicitly state that NO changes have been made to their policy pre-review and adjustments are recommendations only. Prioritize scheduling via Calendly, with office phone for immediate needs.

STRICT AGENCY RULES:
1. State that the RCE is attached directly to the email. Do not output download links.
2. Explicitly state that no changes have been made to the policy pre-review; all adjustments are recommendations only requiring client permission.
3. Do NOT enclose policy numbers in parentheses or include term suffixes.
4. Prioritize the Calendly link {{meeting_url}} for scheduling, offering the office phone (909) 626-5000 secondarily for immediate needs.
5. Sign off as "Alsop and Associates Insurance Agency" with phone (909) 626-5000.
6. Include disclaimer: "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."
7. Output ONLY Subject and Email Body ready to send.`,
        rules: STANDARD_RULES,
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{meeting_url}}', '{{expiration_date}}'],
        isSystemDefault: true,
    },
    {
        id: 'coverage_recommendations_meeting',
        name: 'Coverage Recommendations & Consultation',
        category: 'recommendations',
        description: 'Present coverage review findings and invite client to schedule a consultation.',
        subjectTemplate: 'Coverage Review & Recommendations — Policy {{policy_number}}',
        draftBodyTemplate: `Hi {{first_name}},

We recently completed an annual review of your property coverage under policy {{policy_number}} and have attached your Replacement Cost Estimate (RCE) along with a generated Coverage Report for your review.

Our review highlights comparative options between your current policy limits and updated rebuilding cost estimates. Please note that no changes have been made to your policy — all adjustments are strictly recommendations for your review, and we will always discuss available options and request your explicit permission before making any updates.

To review these recommendations together, please schedule a convenient time on our calendar: {{meeting_url}}. If you need immediate assistance or prefer to speak with us right away, you are also welcome to call our office at (909) 626-5000.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Best regards,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com`,
        copilotPromptTemplate: `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm email presenting annual coverage recommendations and requesting client permission to review and update coverage for policy {{policy_number}}.

CLIENT & POLICY DETAILS:
- Client Name: {{client_name}}
- Policy Number: {{policy_number}}
- Calendly Scheduling Link: {{meeting_url}}
- Attachments: Replacement Cost Estimate (RCE) and generated Coverage Report attached directly to the email

EMAIL PURPOSE:
Highlight key coverage differences identified during our annual review when comparing current policy limits against updated replacement cost estimates. Explicitly clarify that NO changes have been made to the policy pre-review. Request permission from the client to discuss recommended adjustments, and invite them to schedule a review via Calendly {{meeting_url}}, or call our office at (909) 626-5000 for immediate assistance.

STRICT AGENCY RULES:
1. State that the Replacement Cost Estimate (RCE) and generated Coverage Report are attached directly to the email (do NOT refer to it as an 'updated' report).
2. Explicitly state that NO changes have been made pre-review; all adjustments are recommendations requiring client permission.
3. Do NOT enclose policy numbers in parentheses or include term numbers.
4. Prioritize the Calendly link {{meeting_url}} for scheduling, offering office phone (909) 626-5000 secondarily for immediate needs.
5. Sign off as "Alsop and Associates Insurance Agency".
6. Include disclaimer: "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."
7. Output ONLY Subject and Email Body ready to send.`,
        rules: STANDARD_RULES,
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{meeting_url}}'],
        isSystemDefault: true,
    }
];

// ---------------------------------------------------------------------------
// Store Operations
// ---------------------------------------------------------------------------

/** Get all templates (merged localStorage custom templates + system defaults) */
export function getInternalTemplates(): SystemEmailTemplate[] {
    if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_TEMPLATES;
        const saved: SystemEmailTemplate[] = JSON.parse(raw);
        
        // Merge system defaults with saved custom templates
        const savedMap = new Map(saved.map(t => [t.id, t]));
        const merged: SystemEmailTemplate[] = DEFAULT_TEMPLATES.map(dt => savedMap.get(dt.id) || dt);
        
        // Append user-created custom templates
        for (const s of saved) {
            if (!DEFAULT_TEMPLATES.some(dt => dt.id === s.id)) {
                merged.push(s);
            }
        }
        return merged;
    } catch {
        return DEFAULT_TEMPLATES;
    }
}

/** Get a single template by ID */
export function getInternalTemplate(id: string): SystemEmailTemplate | null {
    const templates = getInternalTemplates();
    return templates.find(t => t.id === id) || null;
}

/** Save or update a template in local storage */
export function saveInternalTemplate(template: SystemEmailTemplate): void {
    if (typeof window === 'undefined') return;
    const current = getInternalTemplates();
    const idx = current.findIndex(t => t.id === template.id);
    let updated: SystemEmailTemplate[];
    if (idx >= 0) {
        updated = [...current];
        updated[idx] = template;
    } else {
        updated = [...current, template];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('cfp-templates-updated', { detail: updated }));
    window.dispatchEvent(new Event('storage'));
}

/** Reset templates to factory defaults */
export function resetInternalTemplates(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cfp-templates-updated', { detail: DEFAULT_TEMPLATES }));
    window.dispatchEvent(new Event('storage'));
}

// ---------------------------------------------------------------------------
// Interpolation & Rule Application
// ---------------------------------------------------------------------------

/** Interpolate variable tags in text */
export function interpolateText(text: string, ctx: TemplateContext): string {
    if (!text) return '';
    
    // Automatically extract first name from client name if possible
    const rawClientName = ctx.clientName || '';
    const firstName = rawClientName.trim() ? rawClientName.trim().split(/\s+/)[0] : 'Valued Client';
    
    const cleanPolicy = cleanPolicyNumber(ctx.policyNumber);
    const reportLink = ctx.reportUrl || '';
    const rceLink = ctx.rceDownloadUrl || '';
    const meetingLink = ctx.meetingUrl || '';

    const replacements: Record<string, string> = {
        '{{client_name}}': rawClientName || 'Valued Client',
        '{{first_name}}': firstName,
        '{{client_email}}': ctx.clientEmail || '',
        '{{policy_number}}': cleanPolicy,
        '{{property_address}}': ctx.propertyAddress || '',
        '{{expiration_date}}': ctx.expirationDate || '',
        '{{effective_date}}': ctx.effectiveDate || '',
        '{{annual_premium}}': ctx.annualPremium || '',
        '{{payment_method}}': ctx.paymentMethod || '',
        '{{agent_name}}': ctx.agentName || 'Alsop and Associates Insurance Agency',
        '{{meeting_url}}': meetingLink,
        '{{report_url}}': reportLink,
        '{{rce_download_url}}': rceLink,
    };

    let result = text;
    for (const [tag, val] of Object.entries(replacements)) {
        result = result.replaceAll(tag, val);
    }
    return result;
}

/** Render full email draft text with applied rules and disclaimers */
export function renderInternalDraft(template: SystemEmailTemplate, ctx: TemplateContext): { subject: string; body: string } {
    const subject = interpolateText(template.subjectTemplate, ctx);
    let body = interpolateText(template.draftBodyTemplate, ctx);

    // Append safety disclaimer if enabled in rules
    const hasDisclaimerRule = template.rules.some(r => r.enabled && r.id === 'client_responsibility');
    if (hasDisclaimerRule && !body.includes('Notice & Client Responsibility')) {
        body += `\n\n---\nNotice & Client Responsibility: This draft is provided for informational and comparative purposes. Final coverage selection and policy adjustments remain solely the responsibility of the policyholder.`;
    }

    return { subject, body };
}

/** Render full CoPilot prompt incorporating active rules, instructions, and context */
export function renderInternalCopilotPrompt(template: SystemEmailTemplate, ctx: TemplateContext): string {
    const interpolatedPrompt = interpolateText(template.copilotPromptTemplate, ctx);
    const activeRules = template.rules.filter(r => r.enabled);

    // Only append rules if they are not already integrated into the template
    const customRules = activeRules.filter(r => !interpolatedPrompt.toLowerCase().includes(r.label.toLowerCase()));
    
    if (customRules.length > 0) {
        const rulesBlock = customRules.map(r => `- ${r.label}: ${r.instruction}`).join('\n');
        return `${interpolatedPrompt}\n\nAdditional Agency Custom Rules:\n${rulesBlock}`;
    }

    return interpolatedPrompt.trim();
}
