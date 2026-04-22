'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, Download, Eye, AlertCircle, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import {
    fetchDecPageFilesByPolicyId,
    getDecPageFileDownloadUrl,
    DecPageFileInfo,
    fetchPlatformDocumentsByPolicyId,
    getPlatformDocDownloadUrl,
    PlatformDocumentInfo,
    PlatformDocType,
} from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/Toast/Toast';
import styles from './PolicyFiles.module.css';

interface PolicyFilesProps {
    policyId: string;
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function getParseStatusBadge(status: string | null): { label: string; color: string; icon: React.ReactNode } {
    switch (status) {
        case 'parsed': return { label: 'Complete', color: '#10b981', icon: <CheckCircle size={12} /> };
        case 'needs_review': return { label: 'Needs Review', color: '#f59e0b', icon: <AlertCircle size={12} /> };
        case 'failed': return { label: 'Failed', color: '#ef4444', icon: <XCircle size={12} /> };
        case 'processing': return { label: 'Processing', color: '#6366f1', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
        case 'queued': return { label: 'Queued', color: '#8b5cf6', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
        default: return { label: 'Processing', color: '#6b7280', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
    }
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    dec_page: { label: 'DEC PAGE', color: '#3b82f6' },
    rce: { label: 'RCE', color: '#10b981' },
    dic_dec_page: { label: 'DIC', color: '#f97316' },
    invoice: { label: 'INVOICE', color: '#8b5cf6' },
    inspection: { label: 'INSPECTION', color: '#ec4899' },
    endorsement: { label: 'ENDORSEMENT', color: '#06b6d4' },
    questionnaire: { label: 'QUESTIONNAIRE', color: '#84cc16' },
};

type UploadDocType = 'dec_page' | PlatformDocType;

interface UnifiedFile {
    id: string;
    source: 'dec_page' | 'platform';
    doc_type: string;
    file_name: string | null;
    file_size: number | null;
    storage_path: string | null;
    parse_status: string | null;
    processing_step?: string | null;
    match_status?: string;
    error_message?: string | null;
    uploaded_at: string;
    bucket?: string;
}

export function PolicyFiles({ policyId }: PolicyFilesProps) {
    const [decFiles, setDecFiles] = useState<DecPageFileInfo[]>([]);
    const [platformDocs, setPlatformDocs] = useState<PlatformDocumentInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadDocType, setUploadDocType] = useState<UploadDocType>('dec_page');
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const loadFiles = useCallback(async () => {
        try {
            const [decData, platformData] = await Promise.all([
                fetchDecPageFilesByPolicyId(policyId),
                fetchPlatformDocumentsByPolicyId(policyId),
            ]);
            setDecFiles(decData);
            setPlatformDocs(platformData);
        } catch (err) {
            console.error('Failed to fetch policy files:', err);
        } finally {
            setLoading(false);
        }
    }, [policyId]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        const handleDecPageParsed = () => { loadFiles(); };
        window.addEventListener('decPageParsed', handleDecPageParsed);
        return () => window.removeEventListener('decPageParsed', handleDecPageParsed);
    }, [loadFiles]);

    // Unify files into a single sorted list
    const allFiles: UnifiedFile[] = [
        ...decFiles.map(f => ({
            id: f.id,
            source: 'dec_page' as const,
            doc_type: 'dec_page',
            file_name: f.file_name,
            file_size: f.file_size,
            storage_path: f.storage_path,
            parse_status: f.parse_status,
            uploaded_at: f.uploaded_at,
        })),
        ...platformDocs.map(d => ({
            id: d.id,
            source: 'platform' as const,
            doc_type: d.doc_type,
            file_name: d.file_name,
            file_size: d.file_size,
            storage_path: d.storage_path,
            parse_status: d.parse_status,
            processing_step: d.processing_step,
            match_status: d.match_status,
            error_message: d.error_message,
            uploaded_at: d.created_at,
            bucket: 'cfp-platform-documents',
        })),
    ].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    // ── Dec page upload (existing pipeline, untouched) ──
    const handleDecPageUpload = useCallback(async (file: File) => {
        setIsUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                toast.error('Session expired. Please refresh and sign in again.');
                return;
            }

            const formData = new FormData();
            formData.set('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });

            const json = await res.json();

            if (res.ok && json.success) {
                const submissionId = json.data?.submissionId;
                toast.success(`Uploaded: ${json.data?.fileName || file.name}`);

                if (submissionId) {
                    try {
                        const key = 'cfp_pending_dec_uploads';
                        const stored = sessionStorage.getItem(key);
                        const pending = stored ? JSON.parse(stored) : [];
                        if (!pending.includes(submissionId)) {
                            pending.push(submissionId);
                            sessionStorage.setItem(key, JSON.stringify(pending));
                        }
                    } catch { /* non-critical */ }
                    window.dispatchEvent(new CustomEvent('decPageUploaded'));
                }
                loadFiles();
            } else {
                toast.error(json.message || 'Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Network error during upload. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [toast, loadFiles]);

    // ── Platform document upload (new pipeline) ──
    const handlePlatformDocUpload = useCallback(async (file: File, docType: PlatformDocType) => {
        setIsUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                toast.error('Session expired. Please refresh and sign in again.');
                return;
            }

            const formData = new FormData();
            formData.set('file', file);
            formData.set('doc_type', docType);
            formData.set('policy_id', policyId);

            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });

            const json = await res.json();

            if (res.ok && json.success) {
                toast.success(`${DOC_TYPE_LABELS[docType]?.label || docType} uploaded: ${file.name}`);
                loadFiles();
            } else {
                toast.error(json.message || 'Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Document upload error:', err);
            toast.error('Network error during upload. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [policyId, toast, loadFiles]);

    // ── Unified upload router ──
    const handleUploadFile = useCallback(async (file: File) => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (ext !== '.pdf') {
            toast.error(`Unsupported file type "${ext}". Only PDF files are accepted.`);
            return;
        }
        if (file.size === 0) {
            toast.error('The selected file is empty (0 bytes).');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error(`File size (${formatFileSize(file.size)}) exceeds the 10MB limit.`);
            return;
        }

        if (uploadDocType === 'dec_page') {
            await handleDecPageUpload(file);
        } else {
            await handlePlatformDocUpload(file, uploadDocType);
        }
    }, [uploadDocType, handleDecPageUpload, handlePlatformDocUpload, toast]);

    // ── Drag & drop handlers ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUploadFile(e.dataTransfer.files[0]);
        }
    }, [handleUploadFile]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUploadFile(e.target.files[0]);
        }
    }, [handleUploadFile]);

    // ── Download / Preview (route to correct bucket) ──
    const handleFileAction = useCallback(async (file: UnifiedFile) => {
        if (!file.storage_path) return;
        setDownloadingId(file.id);
        try {
            let url: string | null = null;
            if (file.source === 'dec_page') {
                url = await getDecPageFileDownloadUrl(file.storage_path);
            } else {
                url = await getPlatformDocDownloadUrl(file.storage_path, file.bucket);
            }
            if (url) {
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('File action failed:', err);
        } finally {
            setDownloadingId(null);
        }
    }, []);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Loader2 className={styles.spinner} />
                    <span>Loading files...</span>
                </div>
            </div>
        );
    }

    const selectedTypeLabel = DOC_TYPE_LABELS[uploadDocType]?.label || 'DEC PAGE';

    return (
        <div className={styles.container}>
            {/* ── Upload Zone with Doc Type Selector ── */}
            <div className={styles.uploadSection}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Upload Document</h3>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowTypeSelector(!showTypeSelector)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                padding: '0.35rem 0.75rem', borderRadius: '0.5rem',
                                background: `${DOC_TYPE_LABELS[uploadDocType]?.color || '#3b82f6'}18`,
                                color: DOC_TYPE_LABELS[uploadDocType]?.color || '#3b82f6',
                                border: `1px solid ${DOC_TYPE_LABELS[uploadDocType]?.color || '#3b82f6'}40`,
                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                letterSpacing: '0.03em',
                            }}
                        >
                            {selectedTypeLabel}
                            <ChevronDown size={14} />
                        </button>
                        {showTypeSelector && (
                            <div style={{
                                position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem',
                                background: 'var(--card-bg, #1e1e2e)', border: '1px solid var(--border-color, #333)',
                                borderRadius: '0.5rem', overflow: 'hidden', zIndex: 50,
                                minWidth: '10rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            }}>
                                {Object.entries(DOC_TYPE_LABELS).filter(([key]) =>
                                    ['dec_page', 'rce', 'dic_dec_page'].includes(key)
                                ).map(([key, { label, color }]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setUploadDocType(key as UploadDocType); setShowTypeSelector(false); }}
                                        style={{
                                            display: 'block', width: '100%', padding: '0.5rem 0.75rem',
                                            border: 'none', background: uploadDocType === key ? `${color}15` : 'transparent',
                                            color: uploadDocType === key ? color : 'var(--text-secondary, #999)',
                                            textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem',
                                            fontWeight: uploadDocType === key ? 600 : 400,
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div
                    className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    style={{ cursor: isUploading ? 'wait' : 'pointer' }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={handleFileInputChange}
                    />
                    {isUploading ? (
                        <>
                            <Loader2 className={styles.uploadIcon} style={{ animation: 'spin 1s linear infinite' }} />
                            <p className={styles.dropzoneText}>Uploading {selectedTypeLabel}…</p>
                            <p className={styles.dropzoneHint}>File is being sent to the processing pipeline</p>
                        </>
                    ) : (
                        <>
                            <Upload className={styles.uploadIcon} />
                            <p className={styles.dropzoneText}>
                                {isDragOver ? (
                                    <strong style={{ color: DOC_TYPE_LABELS[uploadDocType]?.color || 'var(--accent-primary)' }}>Drop PDF here</strong>
                                ) : (
                                    <>Drop a {selectedTypeLabel} PDF here or <strong style={{ color: 'var(--accent-primary)' }}>click to browse</strong></>
                                )}
                            </p>
                            <p className={styles.dropzoneHint}>
                                PDF only, max 10MB · Uploaded files are processed automatically
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* ── Unified Files List ── */}
            <div className={styles.filesSection}>
                <h3 className={styles.sectionTitle}>
                    Policy Documents
                    <span className={styles.fileCount}>({allFiles.length})</span>
                </h3>

                {allFiles.length === 0 ? (
                    <div className={styles.emptyState}>
                        <AlertCircle className={styles.emptyIcon} />
                        <p>No documents linked to this policy yet.</p>
                        <p className={styles.emptyHint}>
                            Drag & drop a PDF above to start processing.
                        </p>
                    </div>
                ) : (
                    <div className={styles.fileList}>
                        {allFiles.map(file => {
                            const parseStatus = getParseStatusBadge(file.parse_status);
                            const docTypeInfo = DOC_TYPE_LABELS[file.doc_type] || { label: file.doc_type.toUpperCase(), color: '#6b7280' };
                            return (
                                <div key={`${file.source}-${file.id}`} className={styles.fileItem}>
                                    <div className={styles.fileInfo}>
                                        <FileText className={styles.fileIcon} />
                                        <div>
                                            <div className={styles.fileName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span
                                                    style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.05em',
                                                        padding: '0.15rem 0.4rem',
                                                        borderRadius: '0.25rem',
                                                        backgroundColor: `${docTypeInfo.color}20`,
                                                        color: docTypeInfo.color,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {docTypeInfo.label}
                                                </span>
                                                {file.file_name || 'Document'}
                                            </div>
                                            <div className={styles.fileMeta}>
                                                <span
                                                    className={styles.statusBadge}
                                                    style={{
                                                        backgroundColor: `${parseStatus.color}18`,
                                                        color: parseStatus.color,
                                                    }}
                                                >
                                                    {parseStatus.icon}
                                                    <span style={{ marginLeft: '0.25rem' }}>{parseStatus.label}</span>
                                                </span>
                                                {file.processing_step && file.parse_status === 'processing' && (
                                                    <span style={{ fontSize: '0.7rem', color: '#6366f1' }}>
                                                        {file.processing_step.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {file.match_status === 'needs_review' && (
                                                    <span style={{
                                                        fontSize: '0.65rem', padding: '0.1rem 0.3rem',
                                                        borderRadius: '0.2rem', backgroundColor: '#f59e0b18',
                                                        color: '#f59e0b', fontWeight: 600,
                                                    }}>
                                                        Review Required
                                                    </span>
                                                )}
                                                <span>{formatFileSize(file.file_size)}</span>
                                                <span>{formatDate(file.uploaded_at)}</span>
                                            </div>
                                            {file.error_message && file.parse_status !== 'parsed' && (
                                                <div style={{
                                                    fontSize: '0.7rem', color: '#ef4444', marginTop: '0.25rem',
                                                    padding: '0.25rem 0.5rem', background: '#ef444410',
                                                    borderRadius: '0.3rem', lineHeight: 1.4,
                                                }}>
                                                    {file.error_message}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.fileActions}>
                                        <button
                                            className={styles.iconButton}
                                            title="Preview"
                                            onClick={() => handleFileAction(file)}
                                            disabled={!file.storage_path || downloadingId === file.id}
                                        >
                                            {downloadingId === file.id
                                                ? <Loader2 size={16} className={styles.spinnerSmall} />
                                                : <Eye size={16} />
                                            }
                                        </button>
                                        <button
                                            className={styles.iconButton}
                                            title="Download"
                                            onClick={() => handleFileAction(file)}
                                            disabled={!file.storage_path || downloadingId === file.id}
                                        >
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
