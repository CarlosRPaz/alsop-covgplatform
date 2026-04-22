'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ArrowLeft,
    FileUp,
    ExternalLink,
    Clock,
    User,
    MapPin,
    Shield,
    FileText,
    Zap,
    ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';
import Link from 'next/link';

/* ── Constants ──────────────────────────────────────────────────────── */

const DOC_TYPES = [
    {
        key: 'rce',
        label: 'RCE',
        fullLabel: 'Replacement Cost Estimator',
        description: '360Value or similar replacement cost valuation PDFs',
        color: '#10b981',
        icon: '📊',
    },
    {
        key: 'dic_dec_page',
        label: 'DIC Dec Page',
        fullLabel: 'DIC Carrier Declaration Page',
        description: 'Declaration pages from PSIC, Bamboo, Aegis, or other DIC carriers',
        color: '#f97316',
        icon: '📄',
    },
] as const;

type DocTypeKey = typeof DOC_TYPES[number]['key'];

const PIPELINE_STEPS = [
    { key: 'queued', label: 'Queued', description: 'Waiting for worker to pick up' },
    { key: 'extracting_text', label: 'Extracting Text', description: 'Reading PDF content with OCR fallback' },
    { key: 'parsing_fields', label: 'Parsing Fields', description: 'AI-powered field extraction' },
    { key: 'matching_policy', label: 'Matching Policy', description: 'Finding matching policy by owner & address' },
    { key: 'saving_data', label: 'Saving Data', description: 'Persisting extracted data' },
    { key: 'writing_policy_data', label: 'Updating Policy', description: 'Writing enrichments to policy records' },
    { key: 'complete', label: 'Complete', description: 'Processing finished' },
] as const;

/* ── Types ──────────────────────────────────────────────────────────── */

interface DocumentStatus {
    id: string;
    doc_type: string;
    file_name: string;
    parse_status: string;
    processing_step: string;
    match_status: string;
    match_confidence: number | null;
    match_log: Array<{ step: string; result: string; candidates?: number; reason?: string }> | null;
    error_message: string | null;
    policy_id: string | null;
    client_id: string | null;
    policy_term_id: string | null;
    extracted_owner_name: string | null;
    extracted_address: string | null;
    writeback_status: string | null;
    writeback_log: Array<{ field: string; action: string; old_value?: string; new_value?: string }> | null;
    created_at: string;
    updated_at: string;
    policies: { id: string; policy_number: string; carrier: string } | null;
    clients: { id: string; full_name: string } | null;
    status_message: string;
    action_required: string | null;
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function UploadDocumentPage() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<DocTypeKey | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Processing tracker state
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [docStatus, setDocStatus] = useState<DocumentStatus | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [uploadDoneAt, setUploadDoneAt] = useState<number | null>(null);
    const [processingTime, setProcessingTime] = useState<string>('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Clean up polling on unmount
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Timer display
    useEffect(() => {
        if (!uploadDoneAt || !isPolling) return;
        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - uploadDoneAt) / 1000);
            const m = Math.floor(elapsed / 60);
            const s = elapsed % 60;
            setProcessingTime(m > 0 ? `${m}m ${s}s` : `${s}s`);
        }, 250);
        return () => clearInterval(timer);
    }, [uploadDoneAt, isPolling]);

    // Polling function
    const startPolling = useCallback(async (docId: string) => {
        setIsPolling(true);
        setUploadDoneAt(Date.now());

        const fetchStatus = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const res = await fetch(`/api/documents/upload/status?ids=${docId}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                });
                if (!res.ok) return;

                const json = await res.json();
                const doc = json.documents?.[0];
                if (!doc) return;

                setDocStatus(doc);

                // Stop polling when terminal state reached
                const terminal = ['parsed', 'needs_review', 'failed'].includes(doc.parse_status);
                const noMatchComplete = doc.match_status === 'no_match' && doc.processing_step === 'complete';
                if (terminal || noMatchComplete) {
                    setIsPolling(false);
                    if (pollRef.current) clearInterval(pollRef.current);
                    // Final time snapshot
                    const elapsed = Math.floor((Date.now() - (uploadDoneAt || Date.now())) / 1000);
                    const m = Math.floor(elapsed / 60);
                    const s = elapsed % 60;
                    setProcessingTime(m > 0 ? `${m}m ${s}s` : `${s}s`);
                }
            } catch { /* swallow */ }
        };

        // Immediate fetch + polling every 2s
        await fetchStatus();
        pollRef.current = setInterval(fetchStatus, 2000);
    }, [uploadDoneAt]);

    const handleUpload = useCallback(async (file: File) => {
        if (!selectedType) return;

        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (ext !== '.pdf') { setUploadError(`Unsupported file type "${ext}". Only PDF files are accepted.`); return; }
        if (file.size === 0) { setUploadError('The selected file is empty (0 bytes).'); return; }
        if (file.size > 10 * 1024 * 1024) { setUploadError(`File (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.`); return; }

        setIsUploading(true);
        setUploadError(null);
        setDocumentId(null);
        setDocStatus(null);
        setProcessingTime('');
        setUploadProgress('Authenticating...');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) { setUploadError('Session expired.'); return; }

            setUploadProgress('Uploading...');
            const formData = new FormData();
            formData.set('file', file);
            formData.set('doc_type', selectedType);

            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });

            const json = await res.json();
            if (res.status === 409) {
                setUploadError(json.message || 'Duplicate detected.');
            } else if (res.ok && json.success) {
                const newDocId = json.data?.documentId;
                setDocumentId(newDocId);
                if (newDocId) startPolling(newDocId);
            } else {
                setUploadError(json.message || 'Upload failed.');
            }
        } catch {
            setUploadError('Network error. Please try again.');
        } finally {
            setIsUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [selectedType, startPolling]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); };

    const selectedTypeInfo = DOC_TYPES.find(t => t.key === selectedType);
    const showTracker = documentId && docStatus;
    const isTerminal = docStatus && ['parsed', 'needs_review', 'failed'].includes(docStatus.parse_status);
    const isSuccess = docStatus?.parse_status === 'parsed' && docStatus?.match_status === 'matched';
    const needsReview = docStatus?.parse_status === 'needs_review' || docStatus?.match_status === 'needs_review' || docStatus?.match_status === 'no_match';

    const resetForNewUpload = () => {
        setDocumentId(null);
        setDocStatus(null);
        setUploadError(null);
        setProcessingTime('');
        setSelectedType(null);
        if (pollRef.current) clearInterval(pollRef.current);
    };

    return (
        <main style={{ padding: '2rem', maxWidth: '48rem', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.15rem' }}>
                        Upload Document
                    </h1>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Upload RCE, DIC, or other policy documents for automatic processing
                    </p>
                </div>
            </div>

            {/* ── Step 1: Select Document Type ── */}
            {!showTracker && (
                <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    marginBottom: '1.25rem',
                }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '0.5rem' }}>1.</span>
                        Select Document Type
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {DOC_TYPES.map(type => (
                            <button
                                key={type.key}
                                onClick={() => { setSelectedType(type.key); setUploadError(null); }}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                    padding: '1rem 1.25rem',
                                    borderRadius: '0.75rem',
                                    border: selectedType === type.key ? `2px solid ${type.color}` : '2px solid var(--border-default)',
                                    background: selectedType === type.key ? `${type.color}08` : 'var(--bg-surface-raised)',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                    <span style={{ fontSize: '1.4rem' }}>{type.icon}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: `${type.color}20`, color: type.color }}>
                                        {type.label}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.2rem' }}>
                                    {type.fullLabel}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                    {type.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Step 2: Upload (hidden when tracking) ── */}
            {!showTracker && (
                <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    marginBottom: '1.25rem',
                    opacity: selectedType ? 1 : 0.5,
                    pointerEvents: selectedType ? 'auto' : 'none',
                    transition: 'opacity 0.2s',
                }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '0.5rem' }}>2.</span>
                        Upload PDF
                        {selectedTypeInfo && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: `${selectedTypeInfo.color}20`, color: selectedTypeInfo.color }}>
                                {selectedTypeInfo.label}
                            </span>
                        )}
                    </h2>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        style={{
                            border: isDragOver ? `2px dashed ${selectedTypeInfo?.color || 'var(--accent-primary)'}` : '2px dashed var(--border-default)',
                            borderRadius: '0.75rem',
                            padding: '2.5rem 2rem',
                            textAlign: 'center',
                            cursor: isUploading ? 'wait' : 'pointer',
                            background: isDragOver ? `${selectedTypeInfo?.color || 'var(--accent-primary)'}08` : 'var(--bg-surface-raised)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <input type="file" ref={fileInputRef} accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
                        {isUploading ? (
                            <>
                                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: selectedTypeInfo?.color || 'var(--accent-primary)', marginBottom: '0.75rem' }} />
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)' }}>Uploading {selectedTypeInfo?.label}…</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{uploadProgress}</p>
                            </>
                        ) : (
                            <>
                                <FileUp size={36} style={{ color: selectedTypeInfo?.color || 'var(--text-muted)', marginBottom: '0.75rem' }} />
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)' }}>
                                    {isDragOver ? <span style={{ color: selectedTypeInfo?.color }}>Drop PDF here</span> : <>Drop a {selectedTypeInfo?.label || 'document'} PDF here or <span style={{ color: 'var(--accent-primary)' }}>click to browse</span></>}
                                </p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>PDF only · Max 10MB</p>
                            </>
                        )}
                    </div>
                    {uploadError && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: '#ef444410', border: '1px solid #ef444430', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>{uploadError}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                 LIVE PROCESSING TRACKER — Step 3
                 ═══════════════════════════════════════════════════════════════ */}
            {showTracker && (
                <div style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${isSuccess ? '#10b98140' : needsReview ? '#f59e0b40' : docStatus.parse_status === 'failed' ? '#ef444440' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    marginBottom: '1.25rem',
                }}>
                    {/* Header bar */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-default)',
                        background: isSuccess ? '#10b98108' : needsReview ? '#f59e0b08' : docStatus.parse_status === 'failed' ? '#ef444408' : 'transparent',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {isPolling && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />}
                            {isSuccess && <CheckCircle size={18} style={{ color: '#10b981' }} />}
                            {needsReview && <AlertTriangle size={18} style={{ color: '#f59e0b' }} />}
                            {docStatus.parse_status === 'failed' && <XCircle size={18} style={{ color: '#ef4444' }} />}
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-high)' }}>
                                {isPolling ? 'Processing Document…' :
                                 isSuccess ? 'Processing Complete' :
                                 needsReview ? 'Review Required' : 'Processing Failed'}
                            </span>
                            {selectedTypeInfo && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: `${selectedTypeInfo.color}20`, color: selectedTypeInfo.color }}>
                                    {selectedTypeInfo.label}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {processingTime || '0s'}
                            </span>
                        </div>
                    </div>

                    {/* Pipeline Steps */}
                    <div style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {PIPELINE_STEPS.map((step, i) => {
                                const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === docStatus.processing_step);
                                const stepIdx = i;
                                const isDone = stepIdx < currentIdx || (stepIdx === currentIdx && isTerminal);
                                const isCurrent = stepIdx === currentIdx && !isTerminal;
                                const isFailed = docStatus.parse_status === 'failed' && stepIdx === currentIdx;
                                const isPending = stepIdx > currentIdx;

                                // Skip 'writing_policy_data' if match wasn't successful
                                if (step.key === 'writing_policy_data' && docStatus.match_status !== 'matched' && !isDone) return null;

                                return (
                                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.4rem 0' }}>
                                        {/* Indicator */}
                                        <div style={{
                                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginTop: '0.05rem',
                                            background: isDone ? '#10b981' : isFailed ? '#ef4444' : isCurrent ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                                            border: isPending ? '2px solid var(--border-default)' : 'none',
                                        }}>
                                            {isDone && <CheckCircle size={13} style={{ color: '#fff' }} />}
                                            {isCurrent && <Loader2 size={13} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />}
                                            {isFailed && <XCircle size={13} style={{ color: '#fff' }} />}
                                        </div>
                                        {/* Label */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.82rem',
                                                fontWeight: isDone || isCurrent ? 600 : 400,
                                                color: isDone ? '#10b981' : isFailed ? '#ef4444' : isCurrent ? 'var(--text-high)' : 'var(--text-muted)',
                                            }}>
                                                {step.label}
                                            </div>
                                            {(isCurrent || isFailed) && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                    {isFailed ? (docStatus.error_message || 'An error occurred') : step.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Post-processing Report ── */}
                    {isTerminal && (
                        <div style={{ borderTop: '1px solid var(--border-default)', padding: '1.25rem 1.5rem' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '1rem' }}>
                                Processing Report
                            </h3>

                            {/* File Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1rem' }}>
                                <ReportField icon={<FileText size={14} />} label="File" value={docStatus.file_name} />
                                <ReportField icon={<Clock size={14} />} label="Processing Time" value={processingTime} />
                                {docStatus.extracted_owner_name && (
                                    <ReportField icon={<User size={14} />} label="Extracted Owner" value={docStatus.extracted_owner_name} />
                                )}
                                {docStatus.extracted_address && (
                                    <ReportField icon={<MapPin size={14} />} label="Extracted Address" value={docStatus.extracted_address} />
                                )}
                            </div>

                            {/* Match Result */}
                            <div style={{
                                padding: '0.85rem 1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1rem',
                                background: isSuccess ? '#10b98108' : needsReview ? '#f59e0b08' : '#ef444408',
                                border: `1px solid ${isSuccess ? '#10b98130' : needsReview ? '#f59e0b30' : '#ef444430'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <span style={{
                                        fontSize: '0.82rem', fontWeight: 700,
                                        color: isSuccess ? '#10b981' : needsReview ? '#f59e0b' : '#ef4444',
                                    }}>
                                        {isSuccess ? '✓ Policy Matched' : needsReview ? '⚠ Review Needed' : '✕ Processing Failed'}
                                    </span>
                                    {docStatus.match_confidence !== null && docStatus.match_confidence > 0 && (
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 600,
                                            padding: '0.1rem 0.5rem', borderRadius: '999px',
                                            background: docStatus.match_confidence > 0.8 ? '#10b98120' : '#f59e0b20',
                                            color: docStatus.match_confidence > 0.8 ? '#10b981' : '#f59e0b',
                                        }}>
                                            {Math.round(docStatus.match_confidence * 100)}% confidence
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>
                                    {docStatus.status_message}
                                </p>
                            </div>

                            {/* Matched Policy & Client — Actionable Links */}
                            {isSuccess && docStatus.policy_id && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
                                    marginBottom: '1rem',
                                }}>
                                    {/* Policy Card */}
                                    <Link href={`/policy/${docStatus.policy_id}`} style={{ textDecoration: 'none' }}>
                                        <div style={{
                                            padding: '0.85rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border-default)',
                                            background: 'var(--bg-surface-raised)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                                                <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Matched Policy</span>
                                                <ExternalLink size={11} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-high)' }}>
                                                {docStatus.policies?.policy_number || 'View Policy'}
                                            </div>
                                            {docStatus.policies?.carrier && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                    {docStatus.policies.carrier}
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    {/* Client Card */}
                                    {docStatus.clients && (
                                        <div style={{
                                            padding: '0.85rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border-default)',
                                            background: 'var(--bg-surface-raised)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                                                <User size={14} style={{ color: '#8b5cf6' }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Client</span>
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-high)' }}>
                                                {docStatus.clients.full_name}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Writeback Summary */}
                            {docStatus.writeback_log && docStatus.writeback_log.length > 0 && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '0.5rem' }}>
                                        <Zap size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem', color: '#10b981' }} />
                                        Data Written to Policy
                                    </h4>
                                    <div style={{
                                        borderRadius: '0.5rem',
                                        border: '1px solid var(--border-default)',
                                        overflow: 'hidden',
                                        fontSize: '0.75rem',
                                    }}>
                                        {docStatus.writeback_log.map((entry, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.4rem 0.75rem',
                                                borderBottom: i < docStatus.writeback_log!.length - 1 ? '1px solid var(--border-default)' : 'none',
                                                background: entry.action === 'conflict' ? '#ef444408' : 'transparent',
                                            }}>
                                                {entry.action === 'written' && <CheckCircle size={12} style={{ color: '#10b981', flexShrink: 0 }} />}
                                                {entry.action === 'skipped' && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}
                                                {entry.action === 'conflict' && <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />}
                                                <span style={{ fontWeight: 600, color: 'var(--text-mid)', minWidth: '10rem' }}>
                                                    {formatFieldName(entry.field)}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    {entry.action === 'written' ? `→ ${entry.new_value}` :
                                                     entry.action === 'skipped' ? 'Already correct' :
                                                     `Conflict: existing "${entry.old_value}" vs new "${entry.new_value}"`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action bar */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                {isSuccess && docStatus.policy_id && (
                                    <Link href={`/policy/${docStatus.policy_id}`}>
                                        <Button size="sm" variant="primary">
                                            <ChevronRight style={{ width: 13, height: 13, marginRight: 4 }} />
                                            View Policy
                                        </Button>
                                    </Link>
                                )}
                                <Button size="sm" variant="outline" onClick={resetForNewUpload}>
                                    <FileUp style={{ width: 13, height: 13, marginRight: 5 }} />
                                    Upload Another
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
                                    Back to Dashboard
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
    );
}

/* ── Helper components ────────────────────────────────────────────── */

function ReportField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ color: 'var(--text-muted)', marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-high)', marginTop: '0.1rem' }}>{value}</div>
            </div>
        </div>
    );
}

function formatFieldName(field: string): string {
    return field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
