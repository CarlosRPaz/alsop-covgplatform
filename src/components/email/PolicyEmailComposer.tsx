'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Mail, Send, AlertTriangle, CheckCircle2, Loader2,
    ChevronDown, ChevronUp, Eye, FileText, Shield, ExternalLink,
    User, RotateCcw, Copy, Check, Info, UserX,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAST_TEMPLATE_KEY = 'cfp_email_last_template';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase / snake_case variable names → "Title Case" readable labels */
function normalizeVarLabel(key: string): string {
    return key
        .replace(/_/g, ' ')              // snake_case → spaces
        .replace(/([A-Z])/g, ' $1')      // camelCase → spaces
        .replace(/^./, s => s.toUpperCase())
        .trim();
}

/** Basic email format validation */
function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Auto-fill template variables from policy/client context.
 * Maps each Postmark template variable name to the best available value.
 * Returns the variables the template uses PLUS always-included policy context.
 */
function getAutoFillVars(
    templateId: string,
    vars: string[],
    ctx: {
        clientName: string;
        clientEmail: string;
        policyNumber: string;
        propertyAddress: string;
        agentName: string;
        reportUrl: string;
    }
): Record<string, string> {
    const firstName = ctx.clientName.split(' ')[0] || '';
    const reportLink = ctx.reportUrl;

    // Master mapping: Postmark variable name → value from context
    const masterMap: Record<string, string> = {
        // Client identity
        first_name: firstName,
        name: ctx.clientName,
        username: ctx.clientEmail,

        // Product / company
        product_name: 'CoverageCheckNow',
        invite_sender_name: ctx.agentName,
        invite_sender_organization_name: 'Alsop and Associates Insurance Agency',
        sender_name: ctx.agentName,

        // URLs
        login_url: 'https://coveragechecknow.com/login',
        action_url: reportLink || 'https://coveragechecknow.com',
        support_url: 'https://coveragechecknow.com/support',
        support_email: 'support@coveragechecknow.com',
        help_url: 'https://coveragechecknow.com/help',
        live_chat_url: '',

        // Trial (not used but expected by welcome template)
        trial_length: '',
        trial_start_date: '',
        trial_end_date: '',

        // Browser / system (password reset — cannot pre-fill)
        operating_system: '',
        browser_name: '',

        // Policy context (for custom_outreach / any future templates)
        policyNumber: ctx.policyNumber,
        propertyAddress: ctx.propertyAddress,
        clientName: ctx.clientName,
        agentName: ctx.agentName,
        reportUrl: reportLink,
    };

    // Return the keys this specific template uses
    const result: Record<string, string> = {};
    for (const v of vars) {
        result[v] = masterMap[v] ?? '';
    }

    // Always include policy context variables — Postmark ignores extras silently,
    // but they're available if the template HTML references them
    const alwaysInclude = ['policyNumber', 'propertyAddress', 'agentName'];
    for (const key of alwaysInclude) {
        if (masterMap[key] && !result[key]) {
            result[key] = masterMap[key];
        }
    }

    return result;
}

/**
 * Render the subject line for preview by substituting {{variable}} placeholders.
 */
function renderPreviewSubject(subjectTemplate: string, variables: Record<string, string>): string {
    let subject = subjectTemplate;
    for (const [key, value] of Object.entries(variables)) {
        const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        subject = subject.replace(pattern, value || `(${normalizeVarLabel(key)})`);
    }
    return subject;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplate {
    id: string;
    name: string;
    description: string;
    variables: string[];
    subject?: string;
}

interface EmailSystemStatus {
    mode: 'disabled' | 'redirect' | 'live';
    forceRedirectEnabled: boolean;
    forceRedirectTarget: string | null;
    redirectTarget: string | null;
    postmarkConfigured: boolean;
    fromDefault: string;
    replyToDefault: string;
    templates: EmailTemplate[];
}

interface SendResult {
    success: boolean;
    mode: string;
    messageId?: string;
    redirectedFrom?: string;
    forceRedirected?: boolean;
    error?: string;
    timestamp: string;
}

export interface PolicyEmailComposerProps {
    isOpen: boolean;
    onClose: () => void;
    policyId?: string;
    clientId?: string;
    reportId?: string;
    clientEmail?: string;
    clientName?: string;
    policyNumber?: string;
    propertyAddress?: string;
    agentName?: string;
    reportUrl?: string;
    defaultTemplateId?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SafeModeBanner({ status }: { status: EmailSystemStatus }) {
    const target = status.forceRedirectTarget || status.redirectTarget;
    const isDisabled = status.mode === 'disabled';
    const isActive = status.forceRedirectEnabled || status.mode === 'redirect' || isDisabled;
    if (!isActive) return null;

    return (
        <div style={{
            padding: '0.7rem 1rem',
            borderRadius: '8px',
            background: isDisabled ? 'rgba(239,68,68,0.07)' : 'rgba(234,179,8,0.07)',
            border: `1.5px solid ${isDisabled ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.3)'}`,
            marginBottom: '1.1rem',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.3rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Shield size={13} style={{ color: isDisabled ? '#f87171' : '#fbbf24', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isDisabled ? '#f87171' : '#fbbf24', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                    {isDisabled ? 'Email Sending Disabled' : '🔒 Development Mode Active'}
                </span>
            </div>
            {target && !isDisabled && (
                <div style={{ paddingLeft: '1.35rem', fontSize: '0.71rem', color: '#94a3b8' }}>
                    All emails are redirected to{' '}
                    <span style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>{target}</span>
                    {' '}for testing. <strong style={{ color: '#fbbf24' }}>The client will NOT receive this email.</strong>
                </div>
            )}
            {isDisabled && (
                <div style={{ paddingLeft: '1.35rem', fontSize: '0.71rem', color: '#94a3b8' }}>
                    Email is currently disabled. Messages will be logged but not delivered.
                </div>
            )}
        </div>
    );
}

function NoEmailWarning() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.6rem 0.8rem',
            borderRadius: '7px',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.22)',
            marginTop: '0.4rem',
        }}>
            <UserX size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f87171', marginBottom: '0.1rem' }}>
                    No client email on file
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    This client doesn&apos;t have an email address saved. Enter one manually below or update it in the client profile first.
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Preview Body Renderer — High-fidelity local preview per template
// ---------------------------------------------------------------------------

function TemplatePreviewBody({
    templateId,
    variables,
    includeReportLink,
    reportUrl,
    reportId,
    customBody,
    agentName,
    policyNumber,
    propertyAddress,
}: {
    templateId: string;
    variables: Record<string, string>;
    includeReportLink: boolean;
    reportUrl?: string;
    reportId?: string;
    customBody: string;
    agentName: string;
    policyNumber: string;
    propertyAddress: string;
}) {
    const firstName = variables.first_name || variables.name || '(Client Name)';
    const policyNum = variables.policyNumber || policyNumber || '(Policy Number)';
    const address = variables.propertyAddress || propertyAddress || '(Property Address)';
    const agent = variables.agentName || agentName;
    const reportLink = reportUrl || (reportId ? `/report/${reportId}` : '');

    const signatureBlock = (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{agent}</p>
            <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '13px' }}>
                Alsop and Associates Insurance Agency
            </p>
        </div>
    );

    const reportLinkBlock = includeReportLink && reportLink ? (
        <div style={{
            margin: '18px 0',
            textAlign: 'center' as const,
        }}>
            <a
                href={reportLink}
                style={{
                    display: 'inline-block',
                    padding: '12px 28px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '14px',
                }}
            >
                View Full Report →
            </a>
        </div>
    ) : null;

    switch (templateId) {
        case 'payment_due_insured':
            return (
                <div>
                    <p>Dear {firstName},</p>
                    <p>
                        Your <strong>California Fair Plan</strong> policy is approaching its renewal date.
                        A payment is required to maintain continuous coverage on your property.
                    </p>
                    <p>
                        Please contact our office at your earliest convenience to arrange payment
                        or discuss your renewal options.
                    </p>
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                    }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                            Policy Details
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            <strong>Policy #:</strong> {policyNum}<br />
                            <strong>Property:</strong> {address}
                        </div>
                    </div>
                    <p>
                        We appreciate your prompt attention to this matter and are here to help
                        with any questions about your coverage.
                    </p>
                    {signatureBlock}
                </div>
            );

        case 'payment_due_mortgage':
            return (
                <div>
                    <p>Dear {firstName},</p>
                    <p>
                        This is a notice regarding the <strong>California Fair Plan</strong> policy
                        associated with your mortgaged property. The renewal payment is approaching.
                    </p>
                    <p>
                        Your mortgage company or lender typically handles this payment through your
                        escrow account. However, we wanted to ensure you&apos;re aware of the upcoming
                        renewal so there are no gaps in coverage.
                    </p>
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                    }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                            Policy Details
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            <strong>Policy #:</strong> {policyNum}<br />
                            <strong>Property:</strong> {address}
                        </div>
                    </div>
                    <p>
                        Please confirm with your lender that the payment will be processed, or
                        contact our office if you have any questions.
                    </p>
                    {signatureBlock}
                </div>
            );

        case 'schedule_appt':
            return (
                <div>
                    <p>Dear {firstName},</p>
                    <p>
                        We&apos;d like to schedule a time to review your insurance coverage and discuss
                        any updates to your <strong>California Fair Plan</strong> policy.
                    </p>
                    <p>
                        A periodic review helps ensure you have the right level of protection
                        for your property and that your coverage keeps pace with current conditions.
                    </p>
                    {reportLinkBlock}
                    <p>
                        Please reply to this email or call our office to set up a convenient time
                        for your coverage review.
                    </p>
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                    }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                            Policy Details
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            <strong>Policy #:</strong> {policyNum}<br />
                            <strong>Property:</strong> {address}
                        </div>
                    </div>
                    {signatureBlock}
                </div>
            );

        case 'custom_outreach':
            return (
                <div>
                    {customBody ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{customBody}</div>
                    ) : (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingTop: '2rem' }}>
                            Enter your custom message in the Compose tab to preview it here.
                        </div>
                    )}
                </div>
            );

        // Non-client-facing templates (welcome, password_reset, user_invitation)
        default:
            return (
                <div>
                    <div style={{
                        padding: '12px 16px',
                        background: '#f0f4ff',
                        borderRadius: '8px',
                        border: '1px solid #c7d2fe',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, marginBottom: '4px' }}>
                            System Template
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>
                            This is a system/internal template. The email content is managed in Postmark
                            and will be rendered server-side with the variable values shown in the Compose tab.
                        </div>
                    </div>
                    {Object.entries(variables).length > 0 && (
                        <div style={{
                            padding: '12px 16px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                        }}>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                Variables Being Sent
                            </div>
                            {Object.entries(variables).map(([key, value]) => (
                                <div key={key} style={{ fontSize: '13px', marginBottom: '4px' }}>
                                    <span style={{ color: '#6366f1', fontWeight: 600 }}>{normalizeVarLabel(key)}:</span>{' '}
                                    <span style={{ color: '#1e293b' }}>{value || <em style={{ color: '#94a3b8' }}>(empty)</em>}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
    }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PolicyEmailComposer({
    isOpen,
    onClose,
    policyId,
    clientId,
    reportId,
    clientEmail = '',
    clientName = '',
    policyNumber = '',
    propertyAddress = '',
    agentName = 'Alsop and Associates Insurance Agency',
    reportUrl,
    defaultTemplateId,
}: PolicyEmailComposerProps) {

    const [status, setStatus] = useState<EmailSystemStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');

    // MRU: read the last-used template from localStorage
    const getInitialTemplate = useCallback(() => {
        if (defaultTemplateId) return defaultTemplateId;
        if (typeof window !== 'undefined') {
            return localStorage.getItem(LAST_TEMPLATE_KEY) || '';
        }
        return '';
    }, [defaultTemplateId]);

    // Form state
    const [templateId, setTemplateId] = useState(getInitialTemplate);
    const [to, setTo] = useState(clientEmail);
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [customSubject, setCustomSubject] = useState('');
    const [customBody, setCustomBody] = useState('');
    const [includeReportLink, setIncludeReportLink] = useState(!!reportId);
    const [showVars, setShowVars] = useState(true);

    // Send state
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Validation
    const hasClientEmail = !!clientEmail.trim();
    const emailValid = to.trim().length === 0 || isValidEmail(to);
    const canSend = to.trim().length > 0 && isValidEmail(to) && (
        !!templateId || (customSubject.trim().length > 0 && customBody.trim().length > 0)
    );

    useEffect(() => {
        if (!isOpen) return;
        setLoadingStatus(true);
        fetch('/api/email/status')
            .then(r => r.json())
            .then(d => { setStatus(d); setLoadingStatus(false); })
            .catch(() => setLoadingStatus(false));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setTo(clientEmail);
        const tid = getInitialTemplate();
        setTemplateId(tid);
        setResult(null);
        setError(null);
        setActiveTab('compose');
        setIncludeReportLink(tid === 'schedule_appt' && !!(reportId || reportUrl));
        // Best-effort auto-fill before status loads
        setVariables(getAutoFillVars(tid, [], {
            clientName, clientEmail, policyNumber, propertyAddress, agentName,
            reportUrl: reportUrl || (reportId ? `/report/${reportId}` : ''),
        }));
    }, [isOpen, clientEmail, clientName, policyNumber, propertyAddress, agentName, reportId, reportUrl, getInitialTemplate]);

    // When status loads (templates available), re-fill vars for the current template
    useEffect(() => {
        if (!status || !isOpen) return;
        const template = status.templates.find(t => t.id === templateId);
        if (!template) return;
        setVariables(getAutoFillVars(templateId, template.variables, {
            clientName, clientEmail, policyNumber, propertyAddress, agentName,
            reportUrl: reportUrl || (reportId ? `/report/${reportId}` : ''),
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, templateId]);

    // MRU: persist template selection to localStorage
    const handleTemplateChange = useCallback((newId: string) => {
        setTemplateId(newId);
        if (newId && typeof window !== 'undefined') {
            localStorage.setItem(LAST_TEMPLATE_KEY, newId);
        }
        // Auto-fill variables for the newly selected template
        const tpl = status?.templates.find(t => t.id === newId);
        setVariables(getAutoFillVars(newId, tpl?.variables ?? [], {
            clientName, clientEmail, policyNumber, propertyAddress, agentName,
            reportUrl: reportUrl || (reportId ? `/report/${reportId}` : ''),
        }));
        // Report link only for schedule_appt
        setIncludeReportLink(newId === 'schedule_appt' && !!(reportId || reportUrl));
    }, [status, clientName, clientEmail, policyNumber, propertyAddress, agentName, reportUrl, reportId]);

    if (!isOpen) return null;

    const selectedTemplate = status?.templates.find(t => t.id === templateId) ?? null;
    const actualTarget = status?.forceRedirectTarget || status?.redirectTarget || to;
    const isSafeMode = !!(status?.forceRedirectEnabled || (status?.mode && status.mode !== 'live'));

    // Build the preview subject line
    const previewSubject = (() => {
        if (selectedTemplate) {
            const subjectTemplate = selectedTemplate.subject || selectedTemplate.name;
            return renderPreviewSubject(subjectTemplate, variables);
        }
        return customSubject || '';
    })();

    const handleSend = async () => {
        if (!to.trim()) { setError('Recipient email address is required.'); return; }
        if (!isValidEmail(to)) { setError('Please enter a valid email address.'); return; }
        setSending(true);
        setError(null);
        try {
            const payload: Record<string, unknown> = { to, policyId, clientId, reportId };
            if (templateId) {
                payload.templateId = templateId;
                payload.variables = {
                    ...variables,
                    ...(includeReportLink && reportUrl ? { reportUrl } : {}),
                };
            } else {
                if (!customSubject.trim() || !customBody.trim()) {
                    setError('Subject and body are required for custom emails.');
                    setSending(false);
                    return;
                }
                const bodyContent = includeReportLink && reportUrl
                    ? `${customBody}\n\nView Report: ${reportUrl}`
                    : customBody;
                payload.subject = customSubject;
                payload.htmlBody = `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;">${bodyContent.replace(/\n/g, '<br/>')}</div>`;
            }
            // Get auth token for the API call
            const { supabase } = await import('@/lib/supabaseClient');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Session expired. Please refresh the page and sign in again.');
                setSending(false);
                return;
            }

            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Send failed');
            } else {
                setResult(data);
                // Persist MRU on successful send
                if (templateId && typeof window !== 'undefined') {
                    localStorage.setItem(LAST_TEMPLATE_KEY, templateId);
                }
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    // Shared input style — ensures readable text in both inputs and selects
    const inputBase: React.CSSProperties = {
        width: '100%',
        padding: '0.55rem 0.75rem',
        fontSize: '0.84rem',
        background: '#1e293b',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '7px',
        color: '#f1f5f9',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        appearance: 'none' as any,
        WebkitAppearance: 'none' as any,
    };

    const fieldLabel: React.CSSProperties = {
        fontSize: '0.65rem',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'block',
        marginBottom: '0.3rem',
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.72)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9990,
                }}
            />

            {/* Centered Modal */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(740px, 96vw)',
                maxHeight: '92vh',
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
                zIndex: 9991,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>

                {/* ── Modal Header ── */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.025)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: '9px',
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Mail size={16} style={{ color: '#818cf8' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>Email Composer</div>
                            {(policyNumber || clientName) && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                    {policyNumber ? `Policy #${policyNumber}` : ''}
                                    {policyNumber && clientName ? ' · ' : ''}
                                    {clientName}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '7px', color: '#94a3b8', cursor: 'pointer',
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* ── Compose / Preview Tab Bar ── */}
                {!result && (
                    <div style={{
                        display: 'flex',
                        gap: '0',
                        padding: '0.75rem 1.25rem',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.015)',
                        flexShrink: 0,
                    }}>
                        {([
                            { key: 'compose', label: 'Compose', icon: FileText },
                            { key: 'preview', label: 'Preview', icon: Eye },
                        ] as const).map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        flex: 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                        padding: '0.65rem 1rem',
                                        borderRadius: tab.key === 'compose' ? '8px 0 0 8px' : '0 8px 8px 0',
                                        cursor: 'pointer',
                                        fontSize: '0.84rem',
                                        fontWeight: isActive ? 700 : 500,
                                        background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                        color: isActive ? '#a5b4fc' : '#64748b',
                                        border: isActive ? '1.5px solid rgba(99,102,241,0.4)' : '1.5px solid rgba(255,255,255,0.07)',
                                        transition: 'all 0.15s',
                                        letterSpacing: '0.01em',
                                    }}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Body ── */}
                {loadingStatus ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '0.5rem' }}>
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '0.83rem' }}>Loading email system…</span>
                    </div>
                ) : result ? (
                    /* ── Success ── */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '1rem',
                        }}>
                            <CheckCircle2 size={30} style={{ color: '#4ade80' }} />
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.45rem' }}>
                            {result.mode === 'disabled' ? 'Email Logged' : 'Email Sent'}
                        </h3>
                        {result.redirectedFrom && (
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start',
                                background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
                                borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '0.9rem', textAlign: 'left',
                            }}>
                                <div style={{ fontSize: '0.71rem', color: '#94a3b8' }}>
                                    <span style={{ color: '#64748b' }}>Intended: </span>
                                    <strong style={{ color: '#e2e8f0' }}>{result.redirectedFrom}</strong>
                                </div>
                                <div style={{ fontSize: '0.71rem', color: '#94a3b8' }}>
                                    <span style={{ color: '#64748b' }}>Delivered to: </span>
                                    <strong style={{ color: '#fbbf24' }}>{actualTarget}</strong>
                                    {result.forceRedirected && (
                                        <span style={{ marginLeft: 6, fontSize: '0.62rem', color: '#f59e0b', background: 'rgba(234,179,8,0.12)', padding: '1px 5px', borderRadius: 3 }}>FORCE REDIRECT</span>
                                    )}
                                </div>
                            </div>
                        )}
                        {result.messageId && (
                            <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '1rem' }}>
                                Message ID: <code style={{ color: '#94a3b8' }}>{result.messageId}</code>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setResult(null)} style={{
                                padding: '0.5rem 1.25rem', borderRadius: '7px',
                                background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                                border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
                                fontSize: '0.82rem', fontWeight: 600,
                            }}>Send Another</button>
                            <button onClick={onClose} style={{
                                padding: '0.5rem 1.25rem', borderRadius: '7px',
                                background: 'transparent', color: '#64748b',
                                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                                fontSize: '0.82rem',
                            }}>Close</button>
                        </div>
                    </div>
                ) : activeTab === 'compose' ? (
                    /* ── Compose Tab ── */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                        {status && <SafeModeBanner status={status} />}

                        {/* ── Sender Identity ── */}
                        <div style={{
                            marginBottom: '1rem',
                            padding: '0.7rem 0.9rem',
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '9px',
                        }}>
                            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                Sender Identity
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {[
                                    { label: 'From', value: status?.fromDefault || 'reports@coveragechecknow.com' },
                                    { label: 'Reply-To', value: status?.replyToDefault || 'support@coveragechecknow.com' },
                                ].map(row => (
                                    <div key={row.label}>
                                        <div style={{ fontSize: '0.6rem', color: '#475569', marginBottom: '0.1rem' }}>{row.label}</div>
                                        <div style={{ fontSize: '0.79rem', color: '#e2e8f0', fontWeight: 500 }}>{row.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Recipient ── */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={fieldLabel}>
                                Recipient Email
                                {isSafeMode && (
                                    <span style={{ marginLeft: '0.4rem', color: '#fbbf24', fontWeight: 400, textTransform: 'none', fontSize: '0.62rem' }}>
                                        (redirected to {actualTarget} in safe mode)
                                    </span>
                                )}
                            </label>
                            <input
                                type="email"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                placeholder="Enter client email address…"
                                style={{
                                    ...inputBase,
                                    borderColor: to.trim() && !emailValid
                                        ? 'rgba(239,68,68,0.6)'
                                        : !hasClientEmail && !to.trim()
                                            ? 'rgba(239,68,68,0.35)'
                                            : 'rgba(255,255,255,0.12)',
                                }}
                            />
                            {to.trim() && !emailValid && (
                                <div style={{ fontSize: '0.68rem', color: '#f87171', marginTop: '0.25rem', paddingLeft: '0.1rem' }}>
                                    Please enter a valid email address
                                </div>
                            )}
                            {!hasClientEmail && <NoEmailWarning />}
                            {isSafeMode && to.trim() && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginTop: '0.35rem', padding: '0.35rem 0.6rem',
                                    background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.18)',
                                    borderRadius: '5px',
                                }}>
                                    <div style={{ fontSize: '0.67rem', color: '#94a3b8' }}>
                                        <span style={{ color: '#64748b' }}>Intended: </span>
                                        <span style={{ color: '#e2e8f0' }}>{to}</span>
                                        <span style={{ margin: '0 0.35rem', color: '#475569' }}>→</span>
                                        <span style={{ color: '#64748b' }}>Will deliver to: </span>
                                        <strong style={{ color: '#fbbf24' }}>{actualTarget}</strong>
                                    </div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(actualTarget); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '2px' }}
                                    >
                                        {copied ? <Check size={11} style={{ color: '#4ade80' }} /> : <Copy size={11} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Template ── */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={fieldLabel}>Template</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={templateId}
                                    onChange={e => handleTemplateChange(e.target.value)}
                                    style={{
                                        ...inputBase,
                                        paddingRight: '2.2rem',
                                        cursor: 'pointer',
                                        color: templateId ? '#f1f5f9' : '#64748b',
                                    }}
                                >
                                    <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>
                                        Select a template…
                                    </option>
                                    {status?.templates.map(t => (
                                        <option key={t.id} value={t.id} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                                            {t.name}{t.subject ? ` — ${t.subject}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} style={{
                                    position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)',
                                    color: '#64748b', pointerEvents: 'none',
                                }} />
                            </div>
                            {selectedTemplate && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.25rem', paddingLeft: '0.1rem' }}>
                                    {selectedTemplate.description}
                                </div>
                            )}
                            {!templateId && (
                                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.25rem', paddingLeft: '0.1rem', fontStyle: 'italic' }}>
                                    Choose a template above, or leave empty to compose a custom email.
                                </div>
                            )}
                        </div>

                        {/* ── Template Variables ── */}
                        {selectedTemplate && selectedTemplate.variables.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <button
                                    onClick={() => setShowVars(!showVars)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: '#64748b', padding: 0, marginBottom: showVars ? '0.5rem' : 0,
                                    }}
                                >
                                    {showVars ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Template Variables ({selectedTemplate.variables.length})
                                    </span>
                                </button>
                                {showVars && (
                                    <div style={{
                                        padding: '0.85rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        borderRadius: '9px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '0.65rem',
                                    }}>
                                        {selectedTemplate.variables.map(v => (
                                            <div key={v}>
                                                <label style={{
                                                    fontSize: '0.64rem',
                                                    color: '#818cf8',
                                                    fontWeight: 600,
                                                    display: 'block',
                                                    marginBottom: '0.2rem',
                                                }}>
                                                    {normalizeVarLabel(v)}
                                                </label>
                                                <input
                                                    value={variables[v] || ''}
                                                    onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                                                    placeholder={`Enter ${normalizeVarLabel(v).toLowerCase()}…`}
                                                    style={{ ...inputBase, fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Custom Subject / Body ── */}
                        {!templateId && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={fieldLabel}>Subject Line</label>
                                    <input
                                        value={customSubject}
                                        onChange={e => setCustomSubject(e.target.value)}
                                        placeholder="Email subject"
                                        style={inputBase}
                                    />
                                </div>
                                <div>
                                    <label style={fieldLabel}>Message Body</label>
                                    <textarea
                                        value={customBody}
                                        onChange={e => setCustomBody(e.target.value)}
                                        placeholder="Write your message here…"
                                        rows={7}
                                        style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Report Link — only for Schedule Appointment template ── */}
                        {templateId === 'schedule_appt' && (reportId || reportUrl) && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '0.75rem 0.9rem',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '9px',
                            }}>
                                <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <ExternalLink size={11} />
                                    Report Link
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.74rem', color: '#818cf8', marginBottom: '0.15rem', wordBreak: 'break-all' }}>
                                            {reportUrl || `/report/${reportId}`}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#475569' }}>
                                            Included in email as a clickable link
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIncludeReportLink(!includeReportLink)}
                                        style={{
                                            flexShrink: 0, padding: '0.35rem 0.75rem', borderRadius: '6px',
                                            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                                            background: includeReportLink ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                                            color: includeReportLink ? '#4ade80' : '#64748b',
                                            border: `1px solid ${includeReportLink ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                        }}
                                    >
                                        {includeReportLink ? '✓ Included' : 'Include'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Error ── */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.5rem 0.75rem', borderRadius: '7px', marginBottom: '0.5rem',
                                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                                fontSize: '0.77rem', color: '#f87171',
                            }}>
                                <AlertTriangle size={13} />
                                {error}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Preview Tab ── */
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

                        {/* No template selected — empty state */}
                        {!templateId && !customSubject && !customBody ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '280px',
                                gap: '0.75rem',
                                color: '#475569',
                            }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'rgba(99,102,241,0.08)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Eye size={24} style={{ color: '#6366f1' }} />
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
                                    Nothing to preview yet
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#475569', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
                                    Select a template or write a custom email in the Compose tab to see a preview here.
                                </div>
                                <button
                                    onClick={() => setActiveTab('compose')}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.45rem 1rem', borderRadius: '7px',
                                        background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                                        border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer',
                                        fontSize: '0.8rem', fontWeight: 600,
                                    }}
                                >
                                    Go to Compose
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Email Header Info */}
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem 0.9rem',
                                    background: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: '9px',
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '0.4rem', fontSize: '0.78rem' }}>
                                        <span style={{ color: '#475569', fontWeight: 600 }}>From:</span>
                                        <span style={{ color: '#e2e8f0' }}>{status?.fromDefault || 'reports@coveragechecknow.com'}</span>
                                        <span style={{ color: '#475569', fontWeight: 600 }}>To:</span>
                                        <span style={{ color: '#e2e8f0' }}>
                                            {to || '(no recipient)'}
                                            {isSafeMode && (
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: '#fbbf24' }}>
                                                    → redirected to {actualTarget}
                                                </span>
                                            )}
                                        </span>
                                        <span style={{ color: '#475569', fontWeight: 600 }}>Subject:</span>
                                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                                            {previewSubject || <span style={{ color: '#475569', fontStyle: 'italic' }}>No subject</span>}
                                        </span>
                                    </div>
                                </div>

                                {/* Body preview */}
                                <div>
                                    <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                                        Email Body Preview
                                    </div>
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '9px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        minHeight: 240,
                                        padding: '1.5rem',
                                        color: '#1e293b',
                                        fontSize: '14px',
                                        lineHeight: 1.65,
                                    }}>
                                        {selectedTemplate ? (
                                            <TemplatePreviewBody
                                                templateId={selectedTemplate.id}
                                                variables={variables}
                                                includeReportLink={includeReportLink}
                                                reportUrl={reportUrl}
                                                reportId={reportId}
                                                customBody={customBody}
                                                agentName={agentName}
                                                policyNumber={policyNumber}
                                                propertyAddress={propertyAddress}
                                            />
                                        ) : customBody ? (
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{customBody}</div>
                                        ) : (
                                            <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingTop: '2rem' }}>
                                                Enter your message in the Compose tab to preview it here.
                                            </div>
                                        )}
                                    </div>

                                    {/* Preview disclaimer */}
                                    <div style={{
                                        marginTop: '0.5rem',
                                        fontSize: '0.65rem',
                                        color: '#475569',
                                        fontStyle: 'italic',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                    }}>
                                        <Info size={10} />
                                        Preview approximation. The actual email uses your Postmark template styling.
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Footer ── */}
                {!result && (
                    <div style={{
                        padding: '0.9rem 1.25rem',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.015)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexShrink: 0,
                        gap: '0.75rem',
                    }}>
                        <div style={{ fontSize: '0.67rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                            <Info size={11} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {status?.mode === 'disabled'
                                    ? 'Email will be logged only'
                                    : isSafeMode
                                        ? `Delivers to ${actualTarget}`
                                        : `Delivers to ${to || 'recipient'}`}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button onClick={onClose} style={{
                                padding: '0.5rem 1rem', borderRadius: '7px',
                                background: 'transparent', color: '#94a3b8',
                                border: '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer', fontSize: '0.82rem',
                            }}>
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending || !canSend}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.5rem 1.25rem', borderRadius: '7px',
                                    fontSize: '0.84rem', fontWeight: 600,
                                    cursor: sending || !canSend ? 'not-allowed' : 'pointer',
                                    opacity: sending || !canSend ? 0.5 : 1,
                                    background: status?.mode === 'disabled'
                                        ? 'rgba(100,116,139,0.15)'
                                        : isSafeMode
                                            ? 'rgba(234,179,8,0.15)'
                                            : 'rgba(99,102,241,0.25)',
                                    color: status?.mode === 'disabled'
                                        ? '#94a3b8'
                                        : isSafeMode
                                            ? '#fbbf24'
                                            : '#c7d2fe',
                                    border: `1px solid ${status?.mode === 'disabled'
                                        ? 'rgba(100,116,139,0.2)'
                                        : isSafeMode
                                            ? 'rgba(234,179,8,0.3)'
                                            : 'rgba(99,102,241,0.4)'}`,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {sending
                                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Sending…</>
                                    : status?.mode === 'disabled'
                                        ? <><Mail size={14} />Log Email</>
                                        : isSafeMode
                                            ? <><Send size={14} />Send (Safe Mode)</>
                                            : <><Send size={14} />Send Email</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
    );
}
