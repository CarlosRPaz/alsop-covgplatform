'use client';

import React, { useState, useEffect } from 'react';
import {
    Mail, Send, AlertTriangle, CheckCircle2, Loader2,
    ChevronDown, Eye, RotateCcw, Shield, ShieldAlert, ShieldCheck, Info, Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplate {
    id: string;
    name: string;
    description: string;
    variables: string[];
}

interface EmailSystemStatus {
    mode: 'disabled' | 'redirect' | 'live';
    redirectTarget: string | null;
    forceRedirectEnabled?: boolean;
    forceRedirectTarget?: string | null;
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
    error?: string;
    timestamp: string;
}

// ---------------------------------------------------------------------------
// Platform constants — auto-fill values
// ---------------------------------------------------------------------------

const PLATFORM_CONSTANTS: Record<string, string> = {
    product_name: 'CoverageCheckNow',
    support_email: 'support@coveragechecknow.com',
    support_url: 'https://coveragechecknow.com/support',
    help_url: 'https://coveragechecknow.com/support',
    login_url: 'https://coveragechecknow.com/login',
    action_url: 'https://coveragechecknow.com',
    live_chat_url: '',
    invite_sender_organization_name: 'Alsop and Associates Insurance Agency',
    sender_name: 'Alsop and Associates Insurance Agency',
    invite_sender_name: 'Alsop and Associates Insurance Agency',
    trial_length: '',
    trial_start_date: '',
    trial_end_date: '',
    operating_system: '',
    browser_name: '',
};

function autoFill(vars: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const v of vars) out[v] = PLATFORM_CONSTANTS[v] ?? '';
    return out;
}

function varLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ---------------------------------------------------------------------------
// Safety Banner — uses theme tokens
// ---------------------------------------------------------------------------

function SafetyBanner({ status }: { status: EmailSystemStatus }) {
    const effectiveTarget = status.forceRedirectTarget || status.redirectTarget;

    if (status.mode === 'live' && !status.forceRedirectEnabled) {
        return (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--bg-success-subtle)', border: '1px solid rgba(43,155,75,0.2)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <ShieldCheck size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--status-success)' }}>Live Sending Active — emails deliver to real recipients</span>
            </div>
        );
    }

    if (status.mode === 'disabled') {
        return (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--bg-error-subtle)', border: '1px solid rgba(191,25,50,0.18)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <ShieldAlert size={16} style={{ color: 'var(--status-error)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--status-error)' }}>Email Disabled — messages are logged but never delivered</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: 'var(--bg-warning-subtle)', border: '1px solid rgba(255,159,0,0.22)', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Shield size={16} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.83rem', color: '#92570a' }}>
                    {status.forceRedirectEnabled ? 'Safe Mode — Force Redirect Active' : 'Dev Redirect Mode'}
                </span>
            </div>
            <div style={{ paddingLeft: '1.5rem', fontSize: '0.78rem', color: 'var(--text-mid)' }}>
                All outbound email is delivered to{' '}
                <span style={{ background: 'rgba(255,159,0,0.12)', border: '1px solid rgba(255,159,0,0.25)', borderRadius: '4px', padding: '0.1rem 0.45rem', color: '#92570a', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.79rem' }}>
                    {effectiveTarget}
                </span>
                {' '}regardless of the intended recipient.
            </div>
            <div style={{ paddingLeft: '1.5rem', marginTop: '0.4rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Postmark:{' '}
                    <strong style={{ color: status.postmarkConfigured ? 'var(--status-success)' : 'var(--status-error)' }}>
                        {status.postmarkConfigured ? 'Connected ✓' : 'Not configured ✗'}
                    </strong>
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    From: <strong style={{ color: 'var(--text-mid)' }}>{status.fromDefault}</strong>
                </span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Compose Panel
// ---------------------------------------------------------------------------

function ComposePanel({ status }: { status: EmailSystemStatus }) {
    const [templateId, setTemplateId] = useState('');
    const [to, setTo] = useState('');
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [customSubject, setCustomSubject] = useState('');
    const [customBody, setCustomBody] = useState('');
    const [showVars, setShowVars] = useState(true);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const effectiveTarget = status.forceRedirectTarget || status.redirectTarget;
    const selectedTemplate = status.templates.find(t => t.id === templateId) || null;
    const isSafeMode = status.forceRedirectEnabled || status.mode !== 'live';

    const handleTemplateChange = (newId: string) => {
        setTemplateId(newId);
        const tpl = status.templates.find(t => t.id === newId);
        setVariables(tpl ? autoFill(tpl.variables) : {});
    };

    const resetForm = () => {
        setTemplateId(''); setTo(''); setVariables({});
        setCustomSubject(''); setCustomBody('');
        setResult(null); setError(null);
    };

    const handleSend = async () => {
        if (!to.trim()) { setError('Recipient email is required.'); return; }
        setSending(true); setError(null); setResult(null);
        try {
            const payload: Record<string, unknown> = { to };
            if (templateId) {
                payload.templateId = templateId;
                payload.variables = variables;
            } else {
                if (!customSubject.trim() || !customBody.trim()) {
                    setError('Subject and body are required for freeform emails.');
                    setSending(false); return;
                }
                payload.subject = customSubject;
                payload.htmlBody = `<div style="font-family:sans-serif;line-height:1.7;color:#1a1a2e;">${customBody.replace(/\n/g, '<br/>')}</div>`;
            }
            const res = await fetch('/api/email/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Send failed');
            else setResult(data);
        } catch (e: any) { setError(e.message); }
        finally { setSending(false); }
    };

    // Shared field label style
    const L: React.CSSProperties = {
        display: 'block', fontSize: '0.67rem', fontWeight: 700,
        color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: '0.3rem',
    };

    return (
        <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.9rem 1.2rem',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--bg-surface-raised)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-high)' }}>
                        Compose Email
                    </span>
                </div>
                <button
                    onClick={resetForm}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.28rem 0.65rem', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 500 }}
                >
                    <RotateCcw size={11} /> Reset
                </button>
            </div>

            {result ? (
                /* Success state */
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                    <CheckCircle2 size={40} style={{ color: 'var(--status-success)', margin: '0 auto 0.85rem', display: 'block' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.4rem' }}>
                        {result.mode === 'disabled' ? 'Email Logged' : 'Email Sent'}
                    </h3>
                    {result.redirectedFrom && (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left', background: 'var(--bg-warning-subtle)', border: '1px solid rgba(255,159,0,0.2)', borderRadius: '7px', padding: '0.6rem 1rem', marginBottom: '0.85rem' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-mid)' }}>Intended: <strong style={{ color: 'var(--text-high)' }}>{result.redirectedFrom}</strong></span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-mid)' }}>Delivered to: <strong style={{ color: '#92570a' }}>{effectiveTarget}</strong></span>
                        </div>
                    )}
                    {result.messageId && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>ID: <code>{result.messageId}</code></div>}
                    <button onClick={resetForm} style={{ padding: '0.5rem 1.35rem', borderRadius: '7px', background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)', border: '1px solid rgba(34,67,182,0.2)', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}>
                        Send Another
                    </button>
                </div>
            ) : (
                <div style={{ padding: '1.25rem' }}>
                    {/* Safe mode notice */}
                    {isSafeMode && effectiveTarget && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.75rem', borderRadius: '6px', background: 'var(--bg-warning-subtle)', border: '1px solid rgba(255,159,0,0.2)', marginBottom: '1rem', fontSize: '0.72rem', color: '#92570a' }}>
                            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                            &quot;To&quot; is for display only — actual delivery goes to <strong style={{ marginLeft: 3 }}>{effectiveTarget}</strong>
                        </div>
                    )}

                    {/* Template */}
                    <div style={{ marginBottom: '0.9rem' }}>
                        <label style={L}>Template</label>
                        <div style={{ position: 'relative' }}>
                            <select value={templateId} onChange={e => handleTemplateChange(e.target.value)} className="cfp-input" style={{ paddingRight: '2rem', cursor: 'pointer' }}>
                                <option value="">— Custom (freeform) —</option>
                                {status.templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={13} style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        </div>
                        {selectedTemplate && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{selectedTemplate.description}</div>
                        )}
                    </div>

                    {/* Recipient */}
                    <div style={{ marginBottom: '0.9rem' }}>
                        <label style={L}>
                            To (Intended Recipient)
                            {isSafeMode && (
                                <span style={{ marginLeft: '0.4rem', color: 'var(--status-warning)', fontSize: '0.61rem', fontWeight: 400, textTransform: 'none' }}>
                                    ← display only, redirected in safe mode
                                </span>
                            )}
                        </label>
                        <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com" className="cfp-input" />
                    </div>

                    {/* Template Variables */}
                    {selectedTemplate && selectedTemplate.variables.length > 0 && (
                        <div style={{ marginBottom: '0.9rem' }}>
                            <button onClick={() => setShowVars(!showVars)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showVars ? '0.5rem' : 0 }}>
                                <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: showVars ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                <span style={{ ...L, marginBottom: 0 }}>Template Variables ({selectedTemplate.variables.length})</span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--status-success)', background: 'var(--bg-success-subtle)', border: '1px solid rgba(43,155,75,0.2)', borderRadius: '4px', padding: '0.05rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <Zap size={9} /> auto-filled
                                </span>
                            </button>
                            {showVars && (
                                <div style={{ padding: '0.85rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    {selectedTemplate.variables.map(v => {
                                        const isKnown = v in PLATFORM_CONSTANTS && PLATFORM_CONSTANTS[v] !== '';
                                        return (
                                            <div key={v}>
                                                <label style={{ ...L, color: isKnown ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    {varLabel(v)}
                                                    {isKnown && <span style={{ fontSize: '0.55rem', color: 'var(--status-success)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>auto</span>}
                                                </label>
                                                <input
                                                    value={variables[v] || ''}
                                                    onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                                                    placeholder={`Enter ${varLabel(v).toLowerCase()}…`}
                                                    className="cfp-input"
                                                    style={{ fontSize: '0.8rem', padding: '0.38rem 0.65rem' }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Subject / Body */}
                    {!templateId && (
                        <>
                            <div style={{ marginBottom: '0.9rem' }}>
                                <label style={L}>Subject</label>
                                <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Email subject line" className="cfp-input" />
                            </div>
                            <div style={{ marginBottom: '0.9rem' }}>
                                <label style={L}>Body</label>
                                <textarea value={customBody} onChange={e => setCustomBody(e.target.value)} placeholder="Write your message here…" rows={8} className="cfp-input" style={{ fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65 }} />
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.85rem', padding: '0.55rem 0.8rem', borderRadius: '7px', background: 'var(--bg-error-subtle)', border: '1px solid rgba(191,25,50,0.18)', fontSize: '0.78rem', color: 'var(--status-error)', lineHeight: 1.5 }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.9rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Info size={11} />
                            {status.mode === 'disabled' ? 'Will log only' : `Delivers to ${effectiveTarget || to || 'recipient'}`}
                        </div>
                        <button
                            onClick={handleSend} disabled={sending || !to}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.25rem', borderRadius: '7px', fontSize: '0.84rem', fontWeight: 600, cursor: sending || !to ? 'not-allowed' : 'pointer', opacity: sending || !to ? 0.45 : 1, background: isSafeMode ? 'rgba(255,159,0,0.1)' : 'var(--accent-primary)', color: isSafeMode ? '#92570a' : '#fff', border: `1.5px solid ${isSafeMode ? 'rgba(255,159,0,0.3)' : 'transparent'}`, transition: 'all 0.15s' }}
                        >
                            {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                            {sending ? 'Sending…' : status.mode === 'disabled' ? 'Log Email' : isSafeMode ? 'Send (Safe Mode)' : 'Send Email'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Template Library Panel
// ---------------------------------------------------------------------------

function TemplateLibrary({ templates }: { templates: EmailTemplate[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface-raised)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={15} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-high)' }}>Template Library</span>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.1rem' }}>({templates.length})</span>
            </div>
            <div style={{ padding: '0.6rem' }}>
                {templates.map(t => (
                    <div key={t.id} style={{ marginBottom: '0.3rem' }}>
                        <button
                            onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: '7px', cursor: 'pointer', background: expanded === t.id ? 'var(--accent-primary-muted)' : 'transparent', border: `1px solid ${expanded === t.id ? 'rgba(34,67,182,0.15)' : 'transparent'}`, color: 'var(--text-high)', textAlign: 'left', transition: 'all 0.14s' }}
                        >
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-high)' }}>{t.name}</div>
                                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.1rem', lineHeight: 1.4 }}>{t.description}</div>
                            </div>
                            <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem', marginTop: '0.15rem', transform: expanded === t.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.14s' }} />
                        </button>
                        {expanded === t.id && (
                            <div style={{ padding: '0.55rem 0.8rem', background: 'var(--bg-surface-raised)', borderRadius: '0 0 7px 7px', border: '1px solid var(--border-default)', borderTop: 'none' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Variables</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                    {t.variables.map(v => {
                                        const isKnown = v in PLATFORM_CONSTANTS && PLATFORM_CONSTANTS[v] !== '';
                                        return (
                                            <code key={v} style={{ fontSize: '0.67rem', background: isKnown ? 'var(--bg-success-subtle)' : 'var(--accent-primary-subtle)', color: isKnown ? 'var(--status-success)' : 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: `1px solid ${isKnown ? 'rgba(43,155,75,0.2)' : 'rgba(34,67,182,0.12)'}` }}>
                                                {v}
                                            </code>
                                        );
                                    })}
                                    {t.variables.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>None — compose freely</span>}
                                </div>
                                {t.variables.some(v => PLATFORM_CONSTANTS[v]) && (
                                    <div style={{ marginTop: '0.4rem', fontSize: '0.62rem', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Zap size={9} /> Green = auto-filled when template is selected
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmailCenterPage() {
    const [status, setStatus] = useState<EmailSystemStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/email/status')
            .then(r => r.json())
            .then(d => { setStatus(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }

                /*
                 * CFP Input System — matches the app's light theme
                 * Uses --bg-surface-raised (#fff) as input bg so it lifts off the
                 * #FAFAF7 panel surface. Border uses --border-default. Focus uses
                 * --accent-primary ring.
                 */
                .cfp-input {
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0.55rem 0.8rem;
                    font-size: 0.84rem;
                    font-family: inherit;
                    line-height: 1.5;
                    background: var(--bg-surface-raised);
                    color: var(--text-high);
                    border: 1.5px solid var(--border-strong);
                    border-radius: 7px;
                    outline: none;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    appearance: none;
                    -webkit-appearance: none;
                }
                .cfp-input::placeholder { color: var(--text-muted); }
                .cfp-input:hover { border-color: rgba(34, 67, 182, 0.3); }
                .cfp-input:focus {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 3px var(--accent-primary-muted);
                }
                .cfp-input option {
                    background: #fff;
                    color: var(--text-high);
                }
            `}</style>

            <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                {/* Page header */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-high)', margin: 0, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={20} style={{ color: 'var(--accent-primary)' }} />
                        Email Center
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                        Send templated or custom emails. All sending is governed by the active safety gate.
                    </p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                        <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem', display: 'block', color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '0.84rem' }}>Loading email system…</span>
                    </div>
                ) : !status ? (
                    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--status-error)' }}>
                        <AlertTriangle size={26} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                        <span style={{ fontSize: '0.84rem' }}>Failed to load email system status.</span>
                    </div>
                ) : (
                    <>
                        <SafetyBanner status={status} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
                            <ComposePanel status={status} />
                            <TemplateLibrary templates={status.templates} />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
