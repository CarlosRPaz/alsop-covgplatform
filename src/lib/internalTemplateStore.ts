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
// Storage Keys & Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cfp_internal_email_templates_v1';

export const AVAILABLE_VARIABLES = [
    { tag: '{{client_name}}', description: 'Named Insured / Client Full Name' },
    { tag: '{{first_name}}', description: 'Client First Name' },
    { tag: '{{client_email}}', description: 'Client Email Address' },
    { tag: '{{policy_number}}', description: 'Carrier Policy Number' },
    { tag: '{{property_address}}', description: 'Insured Property Location' },
    { tag: '{{expiration_date}}', description: 'Policy Expiration Date' },
    { tag: '{{effective_date}}', description: 'Policy Effective Date' },
    { tag: '{{annual_premium}}', description: 'Annual Policy Premium' },
    { tag: '{{payment_method}}', description: 'Payment Type (Insured / Mortgage)' },
    { tag: '{{agent_name}}', description: 'Agency / Agent Name' },
    { tag: '{{report_url}}', description: 'Link to Full Coverage Report' },
    { tag: '{{rce_download_url}}', description: 'Link to Download RCE PDF' },
    { tag: '{{meeting_url}}', description: 'Outlook Calendar Meeting Link' },
];

export const STANDARD_RULES: TemplateRule[] = [
    {
        id: 'request_permission',
        label: 'Request Permission Tone',
        instruction: 'Frame all coverage increases as recommendations and explicitly request permission from the client before making changes.',
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
        instruction: 'Never use words like "adequate", "inadequate", or "deficient". Simply explain coverage found on the previous policy versus available options.',
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
// Default System Templates
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATES: SystemEmailTemplate[] = [
    {
        id: 'renewal_review',
        name: 'Renewal Review Notice',
        category: 'renewal',
        description: 'Notice of upcoming renewal with attached Coverage Report and RCE, asking client to schedule an appointment.',
        subjectTemplate: 'Your California Fair Plan Renewal Is Approaching — Policy {{policy_number}}',
        draftBodyTemplate: `Hi {{client_name}},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your California Fair Plan policy ({{policy_number}}) is coming up for renewal on {{expiration_date}}, now is a great time to take a closer look.

As part of our renewal review process, we've reviewed the coverage on your current policy and prepared updated materials for your consideration:

• Coverage Report: {{report_url}}
• Updated Replacement Cost Estimate: {{rce_download_url}}

The review may highlight differences between your current coverage and updated replacement cost information or available options. Any changes would be recommendations only — we always request your permission before making updates.

To make the most of our conversation, please have handy any questions, concerns, or feedback you'd like to share.

I won't take too much of your time. In just a few minutes we can make sure your renewal is on track and your coverage continues to provide the protection that's right for you.

To speak with a licensed agent, please call our main office at (909) 626-5000. We're happy to help!

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Your time is certainly appreciated and I look forward to speaking with you soon!

Alsop and Associates Insurance Agency`,
        copilotPromptTemplate: `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a professional, warm, permission-based renewal review email for California Fair Plan policyholder {{client_name}} regarding policy {{policy_number}}, expiring on {{expiration_date}}.

CLIENT & POLICY DETAILS:
- Client Name: {{client_name}}
- Policy Number: {{policy_number}}
- Insured Property Address: {{property_address}}
- Expiration Date: {{expiration_date}}
- Effective Date: {{effective_date}}
- Annual Premium: {{annual_premium}}
- Payment Method: {{payment_method}}
- Coverage Report: {{report_url}}
- Replacement Cost Estimate (RCE): {{rce_download_url}}
- Meeting Link: {{meeting_url}}

REFERENCE EMAIL BLUEPRINT (Match structure, tone, and flow closely):
---
Subject: Your California Fair Plan Renewal Is Approaching — Policy {{policy_number}}

Hi {{client_name}},

Did you know that an annual policy review could help you avoid a lapse in coverage, close potential coverage gaps, and ensure your limits keep pace with current construction costs? Since your California Fair Plan policy ({{policy_number}}) is coming up for renewal on {{expiration_date}}, now is a great time to review your coverage.

As part of our annual review process, we have evaluated your current policy limits and prepared updated materials for your consideration:

• Coverage Report: {{report_url}}
• Updated Replacement Cost Estimate: {{rce_download_url}}

The review may highlight differences between your current coverage and updated replacement cost information. Any changes are recommendations only — we always request your permission before making updates to your policy.

To make the most of our review, please have handy any questions, concerns, or feedback you'd like to share.

We won't take too much of your time. To speak with a licensed agent, please call our main office at (909) 626-5000 or schedule a review online at {{meeting_url}}.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you for your time and trust,

Alsop and Associates Insurance Agency
(909) 626-5000 | support@coveragechecknow.com
---

STRICT AGENCY RULES & GUARDRAILS (YOU MUST FOLLOW ALL OF THESE):
1. AGENCY IDENTITY & SIGN-OFF: Do NOT include a personal agent name or introduction. Sign off ONLY as "Alsop and Associates Insurance Agency" with phone (909) 626-5000 and support@coveragechecknow.com.
2. PERMISSION-BASED FRAMING: Frame all coverage recommendations using permission-requesting language. Always request client permission before suggesting changes.
3. NON-JUDGMENTAL COMPARATIVE TONE (STRICT BAN): NEVER use words like "adequate", "inadequate", "deficient", "underinsured", "poor", or "lacking". Describe coverage neutrally by comparing current limits to updated replacement cost estimates.
4. CLIENT RESPONSIBILITY DISCLAIMER: Include the statement: "Please remember that final coverage selections and decisions remain the responsibility of the policyholder."
5. CONCISENESS & RESPECT FOR TIME: Keep the email concise — under 200 words — and reassure the client the review takes only a few minutes.
6. PREPARATION CHECKLIST: Encourage the client to have handy any questions, concerns, or feedback they would like to discuss. Do NOT ask for mortgage statements or other policy dec pages.
7. NO PHYSICAL ADDRESS IN EMAIL TEXT: Do NOT include the physical property address anywhere in the email subject line or body text. Identify the policy strictly by policy number.
8. OUTPUT FORMAT: Output ONLY the Subject line and the complete email body ready to send. Do NOT include conversational preamble or surrounding code block backticks.`,
        rules: [
            ...STANDARD_RULES,
            {
                id: 'include_office_phone',
                label: 'Include Office Phone Number',
                instruction: 'Direct clients to call the main office at (909) 626-5000 to speak with a licensed agent.',
                enabled: true,
            },
            {
                id: 'include_preparation_checklist',
                label: 'Include Preparation Checklist',
                instruction: 'Encourage the client to have ready any questions, concerns, or feedback for the review.',
                enabled: true,
            },
        ],
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{property_address}}', '{{expiration_date}}', '{{report_url}}', '{{rce_download_url}}', '{{meeting_url}}', '{{agent_name}}'],
        isSystemDefault: true,
    },
    {
        id: 'welcome_email',
        name: 'Welcome to CoverageCheckNow',
        category: 'custom',
        description: 'Welcome email introducing the client to the agency and the platform.',
        subjectTemplate: 'Welcome to CoverageCheckNow for {{property_address}}',
        draftBodyTemplate: `Hi {{first_name}},

Welcome to CoverageCheckNow, Alsop and Associates Insurance Agency’s new client portal designed to help you stay informed about your property coverage.

Your dedicated portal securely houses important property details, coverage insights, AI-supported review information, and Replacement Cost Estimates related to {{property_address}}. It is intended to give you easier access to the information we use when reviewing available coverage options with you.

You can access your CoverageCheckNow portal here: {{report_url}}.

Please note that any coverage updates or increases are recommendations only. We will always request your permission before making changes to your policy.

Final coverage selections and decisions remain the responsibility of the policyholder. If you have questions or would like to review your information with a licensed agent, please schedule a meeting here: {{meeting_url}}.

Thank you,
Alsop and Associates Insurance Agency`,
        copilotPromptTemplate: `Act as an expert insurance communications specialist writing on behalf of Alsop and Associates Insurance Agency.

TASK: Draft a customized welcome email introducing {{client_name}} to CoverageCheckNow for {{property_address}}.

CLIENT & POLICY DETAILS:
- Client Name: {{client_name}}
- Property Address: {{property_address}}
- Portal Access Link: {{report_url}}
- Meeting Booking Link: {{meeting_url}}

EMAIL INSTRUCTIONS:
Keep the tone warm, professional, and concise. Explain that the portal securely houses property details, coverage insights, AI-supported review information, and Replacement Cost Estimates. Direct the client to access the portal using {{report_url}}. Include permission-based language stating that any coverage updates are recommendations only and require client approval before changes are made. Include the disclaimer that final coverage decisions remain the policyholder’s responsibility, and invite them to schedule a meeting using {{meeting_url}}.

STRICT AGENCY RULES:
1. Sign off as "Alsop and Associates Insurance Agency".
2. Keep under 200 words.
3. Output ONLY the Subject line and email body ready to send.`,
        rules: STANDARD_RULES,
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{property_address}}', '{{report_url}}', '{{meeting_url}}'],
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
}

/** Reset templates to factory defaults */
export function resetInternalTemplates(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Interpolation & Rule Application
// ---------------------------------------------------------------------------

/** Interpolate variable tags in text */
export function interpolateText(text: string, ctx: TemplateContext): string {
    if (!text) return '';
    const firstName = ctx.clientName || '';
    const reportLink = ctx.reportUrl || '';
    const rceLink = ctx.rceDownloadUrl || '';
    const meetingLink = ctx.meetingUrl || '';

    const replacements: Record<string, string> = {
        '{{client_name}}': ctx.clientName || '',
        '{{first_name}}': firstName,
        '{{client_email}}': ctx.clientEmail || '',
        '{{policy_number}}': ctx.policyNumber || '',
        '{{property_address}}': ctx.propertyAddress || '',
        '{{expiration_date}}': ctx.expirationDate || '',
        '{{effective_date}}': ctx.effectiveDate || '',
        '{{annual_premium}}': ctx.annualPremium || '',
        '{{payment_method}}': ctx.paymentMethod || '',
        '{{agent_name}}': ctx.agentName || 'Alsop and Associates Insurance Agency',
        '{{report_url}}': reportLink,
        '{{rce_download_url}}': rceLink,
        '{{meeting_url}}': meetingLink,
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

