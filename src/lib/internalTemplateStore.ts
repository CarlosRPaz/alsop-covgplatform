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
        description: 'Notice of upcoming renewal with attached AI report and RCE, asking client to schedule an appointment.',
        subjectTemplate: 'Renewal Review for Policy {{policy_number}} at {{property_address}}',
        draftBodyTemplate: `Hi {{first_name}},

Your California Fair Plan policy, {{policy_number}}, for {{property_address}} is approaching renewal on {{expiration_date}}.

As part of our renewal review process, we reviewed the coverage information currently shown on your prior policy and prepared updated coverage materials for your consideration. You can view your AI coverage report here: {{report_url}}. You can also download your updated Replacement Cost Estimate here: {{rce_download_url}}.

The review may show differences between the coverage reflected on your current policy and updated replacement cost information or available coverage options. Any coverage changes would be recommendations only, and we would need your permission before making any updates.

We strongly encourage you to schedule a review with one of our licensed agents before renewal so we can walk through the findings together: {{meeting_url}}.

Please remember that final coverage selections and decisions remain the responsibility of the policyholder.

Thank you,
Alsop and Associates Insurance Agency`,
        copilotPromptTemplate: `Create a customized renewal review email for {{client_name}} regarding California Fair Plan policy {{policy_number}} at {{property_address}}, expiring on {{expiration_date}}. Keep the tone professional, concise, and permission-based. Mention that an AI coverage report and updated Replacement Cost Estimate are available using {{report_url}} and {{rce_download_url}}. Explain coverage findings in a neutral, non-judgmental way without using words like adequate, inadequate, or deficient. Strongly encourage scheduling with a licensed agent using {{meeting_url}}. Include a clear statement that final coverage decisions remain the policyholder’s responsibility.`,
        rules: [
            ...STANDARD_RULES,
            {
                id: 'include_meeting_link',
                label: 'Include Outlook Meeting Link',
                instruction: 'Provide a direct link to schedule an Outlook review appointment.',
                enabled: true,
            },
        ],
        variables: ['{{first_name}}', '{{client_name}}', '{{policy_number}}', '{{property_address}}', '{{expiration_date}}', '{{report_url}}', '{{rce_download_url}}', '{{meeting_url}}'],
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
        copilotPromptTemplate: `Create a customized welcome email introducing {{client_name}} to CoverageCheckNow for {{property_address}}. Keep the tone warm, professional, and concise. Explain that the portal securely houses property details, coverage insights, AI-supported review information, and Replacement Cost Estimates. Direct the client to access the portal using {{report_url}}. Include permission-based language stating that any coverage updates are recommendations only and require client approval before changes are made. Include the disclaimer that final coverage decisions remain the policyholder’s responsibility, and optionally invite them to schedule a meeting using {{meeting_url}}.`,
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
    const firstName = (ctx.clientName || '').split(' ')[0] || '';
    const reportLink = ctx.reportUrl ? `View Full Coverage Report: ${ctx.reportUrl}` : '';
    const rceLink = ctx.rceDownloadUrl ? `Download RCE PDF: ${ctx.rceDownloadUrl}` : '';
    const meetingLink = ctx.meetingUrl || 'https://outlook.office365.com/owa/calendar/alsopagency/bookings/';

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

    const rulesBlock = activeRules.map(r => `- ${r.label}: ${r.instruction}`).join('\n');

    return `Draft a professional email for an insurance client using the guidelines below.

${interpolatedPrompt}

Active Agency Rules & Guardrails:
${rulesBlock}

Requirements:
- Written as an insurance agent from Alsop and Associates Insurance Agency.
- Keep output clean, professional, and client-ready.`.trim();
}
