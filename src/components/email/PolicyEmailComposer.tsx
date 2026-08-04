'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Mail, Check, Sparkles, FileText, ExternalLink,
    Copy, Sliders, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, Send
} from 'lucide-react';
import {
    SystemEmailTemplate,
    TemplateContext,
    getInternalTemplates,
    getInternalTemplate,
    renderInternalDraft,
    renderInternalCopilotPrompt,
} from '@/lib/internalTemplateStore';
import { RenewalEmailLogEntry } from '@/lib/api';

// Re-export for consumers
export type { RenewalEmailLogEntry };

// Stable empty array to avoid re-render loops when no emailLog is passed
const EMPTY_LOG: RenewalEmailLogEntry[] = [];

export interface PolicyEmailComposerProps {
    isOpen: boolean;
    onClose: () => void;
    policyId?: string | null;
    clientId?: string | null;
    reportId?: string | null;
    clientEmail?: string | null;
    clientName?: string | null;
    policyNumber?: string | null;
    propertyAddress?: string | null;
    agentName?: string | null;
    reportUrl?: string | null;
    defaultTemplateId?: string | null;
    rceDownloadUrl?: string | null;
    /** Pre-fetched email log entries for this policy */
    emailLog?: RenewalEmailLogEntry[];
    /** Callback after marking a template as sent */
    onMarkSent?: (entry: RenewalEmailLogEntry) => void;
}

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
    rceDownloadUrl,
    emailLog,
    onMarkSent,
}: PolicyEmailComposerProps) {

    const safeClientEmail = clientEmail || '';
    const safeClientName = clientName || '';
    const safePolicyNumber = policyNumber || '';
    const safePropertyAddress = propertyAddress || '';
    const safeAgentName = agentName || 'Alsop and Associates Insurance Agency';

    // Stable default for emailLog
    const stableEmailLog = emailLog ?? EMPTY_LOG;

    // State
    const [templates, setTemplates] = useState<SystemEmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('rce_verification');
    const [outputMode, setOutputMode] = useState<'draft' | 'copilot'>('copilot');
    const [copied, setCopied] = useState(false);
    const [markingSent, setMarkingSent] = useState(false);
    const [justMarkedSent, setJustMarkedSent] = useState(false);
    const [localLog, setLocalLog] = useState<RenewalEmailLogEntry[]>(stableEmailLog);

    // Sync external log when it actually changes (by length, not reference)
    useEffect(() => {
        setLocalLog(stableEmailLog);
    }, [stableEmailLog.length]);

    // Context object
    const templateContext: TemplateContext = useMemo(() => ({
        clientName: safeClientName,
        clientEmail: safeClientEmail,
        policyNumber: safePolicyNumber,
        propertyAddress: safePropertyAddress,
        agentName: safeAgentName,
        expirationDate: '07/27/2026',
        annualPremium: '$1,850.00',
        reportUrl: reportUrl || (reportId ? `https://coveragechecknow.com/report/${reportId}` : undefined),
        rceDownloadUrl: rceDownloadUrl || undefined,
        meetingUrl: 'https://outlook.office365.com/owa/calendar/alsopagency/bookings/',
    }), [safeClientName, safeClientEmail, safePolicyNumber, safePropertyAddress, safeAgentName, reportUrl, reportId, rceDownloadUrl]);

    // Load templates
    useEffect(() => {
        if (!isOpen) return;
        const loaded = getInternalTemplates();
        setTemplates(loaded);
        if (defaultTemplateId && loaded.some(t => t.id === defaultTemplateId)) {
            setSelectedTemplateId(defaultTemplateId);
        } else if (loaded.length > 0) {
            setSelectedTemplateId(loaded[0].id);
        }
        // Reset marked state when reopening
        setJustMarkedSent(false);
    }, [isOpen, defaultTemplateId]);

    const activeTemplate = useMemo(() => {
        return templates.find(t => t.id === selectedTemplateId) || templates[0] || null;
    }, [templates, selectedTemplateId]);

    // Per-template sent status
    const getTemplateSentInfo = useCallback((templateId: string): RenewalEmailLogEntry | undefined => {
        return localLog.find(e => e.template_id === templateId);
    }, [localLog]);

    const activeTemplateSentInfo = useMemo(() => {
        return activeTemplate ? getTemplateSentInfo(activeTemplate.id) : undefined;
    }, [activeTemplate, getTemplateSentInfo]);

    // Rendered Outputs
    const renderedDraft = useMemo(() => {
        if (!activeTemplate) return { subject: '', body: '' };
        return renderInternalDraft(activeTemplate, templateContext);
    }, [activeTemplate, templateContext]);

    const renderedPrompt = useMemo(() => {
        if (!activeTemplate) return '';
        return renderInternalCopilotPrompt(activeTemplate, templateContext);
    }, [activeTemplate, templateContext]);

    // Copy handler
    const handleCopy = useCallback(async () => {
        if (outputMode === 'draft') {
            const fullText = `Subject: ${renderedDraft.subject}\n\n${renderedDraft.body}`;
            await navigator.clipboard.writeText(fullText);
        } else {
            await navigator.clipboard.writeText(renderedPrompt);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [outputMode, renderedDraft, renderedPrompt]);

    // Mark as Emailed handler
    const handleMarkSent = useCallback(async () => {
        if (!policyId || !activeTemplate || markingSent) return;
        setMarkingSent(true);
        try {
            const { supabase } = await import('@/lib/supabaseClient');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                alert('Session expired. Please refresh and sign in again.');
                return;
            }

            const res = await fetch('/api/email/mark-sent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    policyId,
                    clientId: clientId || null,
                    templateId: activeTemplate.id,
                    templateName: activeTemplate.name,
                }),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setJustMarkedSent(true);
                setTimeout(() => setJustMarkedSent(false), 3000);
                // Add to local log
                if (json.entry) {
                    setLocalLog(prev => [json.entry, ...prev]);
                    onMarkSent?.(json.entry);
                }
            } else {
                alert(json.error || 'Failed to mark as sent');
            }
        } catch (err) {
            console.error('Mark sent failed:', err);
            alert('Error marking email as sent.');
        } finally {
            setMarkingSent(false);
        }
    }, [policyId, clientId, activeTemplate, markingSent, onMarkSent]);

    if (!isOpen) return null;

    // Format date for sent badges
    const formatSentDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
            });
        } catch { return dateStr; }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
            <div style={{
                width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-surface)', borderRadius: '14px', border: '1px solid var(--border-default)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', color: 'var(--text-high)'
            }}>
                
                {/* ── Modal Header ── */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-default)',
                    background: 'var(--bg-surface-raised)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: '34px', height: '34px', borderRadius: '8px',
                            background: outputMode === 'draft' ? 'rgba(34,197,94,0.15)' : 'var(--accent-secondary-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: outputMode === 'draft' ? 'var(--semantic-success)' : 'var(--accent-secondary)'
                        }}>
                            {outputMode === 'draft' ? <Mail size={18} /> : <Sparkles size={18} />}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-high)' }}>
                                {outputMode === 'draft' ? 'Email Draft Composer' : 'CoPilot Prompt Generator'}
                            </h2>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-mid)', margin: '0.1rem 0 0 0' }}>
                                Native agency templates & permission-requesting rules
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── Modal Content Body ── */}
                <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Policy Context Pill Bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
                        padding: '0.75rem 1rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '9px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>CLIENT</span>
                                <strong style={{ color: 'var(--text-high)' }}>{safeClientName || 'N/A'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>POLICY #</span>
                                <strong style={{ color: 'var(--accent-primary)' }}>{safePolicyNumber || 'N/A'}</strong>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>PROPERTY</span>
                                <span style={{ color: 'var(--text-mid)' }}>{safePropertyAddress || 'N/A'}</span>
                            </div>
                        </div>
                        {rceDownloadUrl ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: 'var(--semantic-success)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                <Check size={12} /> RCE Ready
                            </span>
                        ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 500, background: 'rgba(239,68,68,0.08)', color: 'var(--semantic-error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                RCE Missing
                            </span>
                        )}
                    </div>

                    {/* Mode Toggle & Template Select */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
                        
                        {/* Segmented Mode Selector */}
                        <div style={{ display: 'flex', background: 'var(--border-subtle)', padding: '3px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setOutputMode('draft')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                                    cursor: 'pointer', border: 'none',
                                    background: outputMode === 'draft' ? 'var(--bg-surface-raised)' : 'transparent',
                                    color: outputMode === 'draft' ? 'var(--semantic-success)' : 'var(--text-mid)',
                                    boxShadow: outputMode === 'draft' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                }}
                            >
                                <Mail size={14} /> Email Draft
                            </button>
                            <button
                                onClick={() => setOutputMode('copilot')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                                    cursor: 'pointer', border: 'none',
                                    background: outputMode === 'copilot' ? 'var(--bg-surface-raised)' : 'transparent',
                                    color: outputMode === 'copilot' ? 'var(--accent-secondary)' : 'var(--text-mid)',
                                    boxShadow: outputMode === 'copilot' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                }}
                            >
                                <Sparkles size={14} /> CoPilot Prompt
                            </button>
                        </div>

                        {/* Template Select with Sent Badges */}
                        <div style={{ position: 'relative' }}>
                            <select
                                value={selectedTemplateId}
                                onChange={e => {
                                    setSelectedTemplateId(e.target.value);
                                    setJustMarkedSent(false);
                                }}
                                style={{
                                    width: '100%', padding: '0.55rem 0.85rem', background: 'var(--bg-surface-raised)',
                                    border: '1px solid var(--border-default)', borderRadius: '8px',
                                    color: 'var(--text-high)', fontSize: '0.84rem', cursor: 'pointer'
                                }}
                            >
                                {templates.map(t => {
                                    const sentInfo = getTemplateSentInfo(t.id);
                                    return (
                                        <option key={t.id} value={t.id}>
                                            {t.name}{sentInfo ? ` ✓ Sent ${formatSentDate(sentInfo.sent_at)}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Per-template sent indicator */}
                    {activeTemplateSentInfo && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 0.85rem', borderRadius: '7px',
                            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                            fontSize: '0.78rem', color: 'var(--semantic-success, #16a34a)',
                        }}>
                            <CheckCircle2 size={14} />
                            <span>
                                <strong>This template was sent</strong> on {formatSentDate(activeTemplateSentInfo.sent_at)}
                            </span>
                        </div>
                    )}

                    {/* Active Rules Pill Bar */}
                    {activeTemplate && activeTemplate.rules.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-low)', textTransform: 'uppercase' }}>Active Rules:</span>
                            {activeTemplate.rules.filter(r => r.enabled).map(r => (
                                <span key={r.id} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--accent-secondary-muted)', color: 'var(--accent-secondary)', border: '1px solid var(--border-default)' }}>
                                    ✓ {r.label}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* ── Preview Sheet with Copy Button ── */}
                    <div style={{ position: 'relative' }}>
                        {/* Inline Copy Button */}
                        <button
                            onClick={handleCopy}
                            title={outputMode === 'draft' ? 'Copy entire email draft' : 'Copy entire CoPilot prompt'}
                            style={{
                                position: 'absolute', top: '0.6rem', right: '0.6rem', zIndex: 2,
                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                padding: '0.35rem 0.65rem', borderRadius: '6px',
                                background: copied ? 'var(--semantic-success, #16a34a)' : 'var(--bg-surface)',
                                color: copied ? '#fff' : 'var(--text-mid)',
                                border: copied ? 'none' : '1px solid var(--border-default)',
                                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                                transition: 'all 0.15s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copied!' : 'Copy All'}
                        </button>

                        {outputMode === 'draft' ? (
                            <div style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-high)', padding: '1.25rem', borderRadius: '10px', fontSize: '0.84rem', lineHeight: 1.65, minHeight: '260px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-default)' }}>
                                <div style={{ fontWeight: 700, borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-high)' }}>
                                    Subject: {renderedDraft.subject}
                                </div>
                                {renderedDraft.body}
                            </div>
                        ) : (
                            <div style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-high)', padding: '1.25rem', borderRadius: '10px', fontSize: '0.84rem', fontFamily: 'monospace', lineHeight: 1.65, minHeight: '260px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-default)' }}>
                                {renderedPrompt}
                            </div>
                        )}
                    </div>

                </div>

                {/* ── Modal Footer Bar ── */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)',
                    background: 'var(--bg-surface-raised)'
                }}>
                    <div>
                        {rceDownloadUrl && (
                            <a
                                href={rceDownloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.45rem 0.85rem', borderRadius: '7px', fontSize: '0.76rem', fontWeight: 600,
                                    background: 'var(--accent-secondary-muted)', color: 'var(--accent-secondary)', border: '1px solid var(--border-default)',
                                    textDecoration: 'none'
                                }}
                            >
                                <FileText size={14} /> Download RCE PDF Attachment
                            </a>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.55rem 1rem', borderRadius: '7px', background: 'transparent',
                                color: 'var(--text-mid)', border: '1px solid var(--border-default)', cursor: 'pointer',
                                fontSize: '0.82rem', fontWeight: 500
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCopy}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.55rem 1.25rem', borderRadius: '7px', cursor: 'pointer',
                                fontSize: '0.84rem', fontWeight: 600, border: 'none',
                                background: copied ? 'var(--semantic-success)' : (outputMode === 'draft' ? 'var(--semantic-success)' : 'var(--accent-secondary)'),
                                color: '#ffffff',
                                transition: 'all 0.15s'
                            }}
                        >
                            {copied ? <Check size={16} /> : (outputMode === 'draft' ? <Copy size={16} /> : <Sparkles size={16} />)}
                            {copied ? 'Copied to Clipboard!' : (outputMode === 'draft' ? 'Copy Email Draft' : 'Copy CoPilot Prompt')}
                        </button>

                        {/* Mark as Emailed Button */}
                        {policyId && (
                            <button
                                onClick={handleMarkSent}
                                disabled={markingSent}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.55rem 1.25rem', borderRadius: '7px', cursor: markingSent ? 'wait' : 'pointer',
                                    fontSize: '0.84rem', fontWeight: 600,
                                    border: justMarkedSent ? 'none' : '1px solid var(--border-default)',
                                    background: justMarkedSent ? 'var(--semantic-success, #16a34a)' : 'var(--bg-surface)',
                                    color: justMarkedSent ? '#ffffff' : 'var(--text-high)',
                                    transition: 'all 0.2s',
                                    opacity: markingSent ? 0.7 : 1,
                                }}
                            >
                                {markingSent ? (
                                    <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Marking…</>
                                ) : justMarkedSent ? (
                                    <><CheckCircle2 size={15} /> Marked as Sent!</>
                                ) : (
                                    <><Send size={15} /> Mark as Emailed</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
