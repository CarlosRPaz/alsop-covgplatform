'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, Download, Eye, AlertCircle, CheckCircle, XCircle, ChevronDown, CheckCircle2, Clock, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import {
    fetchDecPageFilesByPolicyId,
    getDecPageFileDownloadUrl,
    DecPageFileInfo,
    fetchPlatformDocumentsByPolicyId,
    getPlatformDocDownloadUrl,
    PlatformDocumentInfo,
    PlatformDocType,
    fetchDecPagesForPolicy,
    approveDecPage,
    deleteDocument,
    DecPageSummary,
} from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { insertActivityEvent } from '@/lib/notes';
import { useToast } from '@/components/ui/Toast/Toast';
import styles from './PolicyFiles.module.css';

interface PolicyFilesProps {
    policyId: string;
    onDecPageApproved?: () => void;
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
        case 'parsed': return { label: 'Complete', color: 'var(--status-success)', icon: <CheckCircle size={12} /> };
        case 'needs_review': return { label: 'Needs Review', color: 'var(--status-warning)', icon: <AlertCircle size={12} /> };
        case 'failed': return { label: 'Failed', color: 'var(--status-error)', icon: <XCircle size={12} /> };
        case 'processing': return { label: 'Processing', color: 'var(--accent-secondary, #6366f1)', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
        case 'queued': return { label: 'Queued', color: 'var(--accent-secondary, #8b5cf6)', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
        case 'manual': return { label: 'Complete', color: 'var(--status-success)', icon: <CheckCircle size={12} /> };
        case 'duplicate': return { label: 'Duplicate', color: 'var(--text-muted)', icon: <CheckCircle size={12} /> };
        default: return { label: 'Processing', color: 'var(--text-muted)', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> };
    }
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string; groupLabel: string }> = {
    dec_page: { label: 'DEC PAGE', color: '#3b82f6', groupLabel: 'Declaration Pages' },
    rce: { label: 'RCE', color: '#10b981', groupLabel: 'RCE Documents' },
    dic_dec_page: { label: 'DIC', color: '#f97316', groupLabel: 'DIC Documents' },
    invoice: { label: 'INVOICE', color: '#8b5cf6', groupLabel: 'Invoices' },
    inspection: { label: 'INSPECTION', color: '#ec4899', groupLabel: 'Inspections' },
    endorsement: { label: 'ENDORSEMENT', color: '#06b6d4', groupLabel: 'Endorsements' },
    questionnaire: { label: 'QUESTIONNAIRE', color: '#84cc16', groupLabel: 'Questionnaires' },
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

export function PolicyFiles({ policyId, onDecPageApproved }: PolicyFilesProps) {
    const [decFiles, setDecFiles] = useState<DecPageFileInfo[]>([]);
    const [platformDocs, setPlatformDocs] = useState<PlatformDocumentInfo[]>([]);
    const [decPages, setDecPages] = useState<DecPageSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadDocType, setUploadDocType] = useState<UploadDocType>('dec_page');
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const loadFiles = useCallback(async () => {
        try {
            const [decData, platformData, decPageData] = await Promise.all([
                fetchDecPageFilesByPolicyId(policyId),
                fetchPlatformDocumentsByPolicyId(policyId),
                fetchDecPagesForPolicy(policyId),
            ]);
            setDecFiles(decData);
            setPlatformDocs(platformData);
            setDecPages(decPageData);
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

    // Build dec page review status map (dec_page_id -> review_status)
    const decPageReviewMap = new Map<string, DecPageSummary>();
    decPages.forEach(dp => {
        // Match by policy_number or created_at proximity
        decPageReviewMap.set(dp.id, dp);
    });

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

    // Group files by doc_type
    const groupOrder = ['dec_page', 'dic_dec_page', 'rce', 'invoice', 'inspection', 'endorsement', 'questionnaire'];
    const grouped = new Map<string, UnifiedFile[]>();
    allFiles.forEach(f => {
        const key = f.doc_type;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(f);
    });
    // Sort groups by defined order, then any remaining
    const sortedGroupKeys = [...grouped.keys()].sort((a, b) => {
        const ai = groupOrder.indexOf(a);
        const bi = groupOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

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

    // ── View: opens signed URL in a new tab ──
    const handleView = useCallback(async (file: UnifiedFile) => {
        if (!file.storage_path) return;
        setActionId(file.id + '_view');
        try {
            let url: string | null = null;
            if (file.source === 'dec_page') {
                url = await getDecPageFileDownloadUrl(file.storage_path);
            } else {
                url = await getPlatformDocDownloadUrl(file.storage_path, file.bucket);
            }
            if (url) {
                window.open(url, '_blank');
            } else {
                toast.error('Could not generate preview link.');
            }
        } catch (err) {
            console.error('View failed:', err);
            toast.error('Failed to open file.');
        } finally {
            setActionId(null);
        }
    }, [toast]);

    // ── Download: forces an actual file download ──
    const handleDownload = useCallback(async (file: UnifiedFile) => {
        if (!file.storage_path) return;
        setActionId(file.id + '_dl');
        try {
            let url: string | null = null;
            if (file.source === 'dec_page') {
                url = await getDecPageFileDownloadUrl(file.storage_path);
            } else {
                url = await getPlatformDocDownloadUrl(file.storage_path, file.bucket);
            }
            if (url) {
                // Force download via a hidden anchor with download attribute
                const a = document.createElement('a');
                a.href = url;
                a.download = file.file_name || 'document.pdf';
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 100);
            } else {
                toast.error('Could not generate download link.');
            }
        } catch (err) {
            console.error('Download failed:', err);
            toast.error('Failed to download file.');
        } finally {
            setActionId(null);
        }
    }, [toast]);

    // ── Delete: Removes file from DB and Storage ──
    const handleDelete = useCallback(async (file: UnifiedFile) => {
        const confirmMsg = `Are you sure you want to delete ${file.file_name || 'this document'}?\nThis action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        setActionId(file.id + '_delete');
        try {
            const success = await deleteDocument(file.id, file.source);
            if (success) {
                toast.success('Document deleted successfully.');
                await loadFiles();
            } else {
                toast.error('Failed to delete document.');
            }
        } catch (err) {
            console.error('Delete failed:', err);
            toast.error('Failed to delete document.');
        } finally {
            setActionId(null);
        }
    }, [toast, loadFiles]);

    // ── Dec Page Approval (inline) ──
    const handleApproveDecPage = useCallback(async (decPageId: string) => {
        const confirmed = window.confirm(
            'Approving this dec page will:\n\n' +
            '• Overwrite the current policy term with this dec page\'s coverage data\n' +
            '• Mark any previously approved dec page as "Superseded"\n' +
            '• This becomes the source of truth for the Policy Review tab\n\n' +
            'Continue?'
        );
        if (!confirmed) return;

        setApprovingId(decPageId);
        try {
            const ok = await approveDecPage(decPageId, policyId);
            if (ok) {
                toast.success('Dec page approved — policy data updated');
                const dp = decPages.find(d => d.id === decPageId);
                await insertActivityEvent({
                    event_type: 'dec.approved',
                    title: 'Dec page approved',
                    detail: dp?.policy_number ? `Policy #${dp.policy_number}` : undefined,
                    policy_id: policyId,
                    meta: { dec_page_id: decPageId },
                });
                await loadFiles();
                onDecPageApproved?.();
            } else {
                toast.error('Failed to approve — check permissions');
            }
        } catch {
            toast.error('Error approving dec page');
        } finally {
            setApprovingId(null);
        }
    }, [policyId, decPages, toast, loadFiles, onDecPageApproved]);

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

    // Find dec page review status for a file
    const getDecPageReview = (file: UnifiedFile): DecPageSummary | undefined => {
        if (file.source !== 'dec_page') return undefined;
        // Match by ID — dec_pages and dec_page_files share the same ID root
        return decPages.find(dp => dp.id === file.id);
    };

    const REVIEW_STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
        approved: { icon: <CheckCircle2 size={12} />, label: 'Approved', color: 'var(--status-success)' },
        pending: { icon: <Clock size={12} />, label: 'Pending Review', color: 'var(--status-warning)' },
        rejected: { icon: <XCircle size={12} />, label: 'Rejected', color: 'var(--status-error)' },
        superseded: { icon: <RotateCcw size={12} />, label: 'Superseded', color: 'var(--text-muted)' },
    };

    return (
        <div className={styles.container}>
            {/* ── Upload Zone with Doc Type Selector ── */}
            <div className={styles.uploadSection}>
                <div className={styles.uploadHeader}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Upload Document</h3>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowTypeSelector(!showTypeSelector)}
                            className={styles.typeSelectBtn}
                            style={{
                                '--type-color': DOC_TYPE_LABELS[uploadDocType]?.color || '#3b82f6',
                            } as React.CSSProperties}
                        >
                            {selectedTypeLabel}
                            <ChevronDown size={14} />
                        </button>
                        {showTypeSelector && (
                            <div className={styles.typeDropdown}>
                                {Object.entries(DOC_TYPE_LABELS).filter(([key]) =>
                                    ['dec_page', 'rce', 'dic_dec_page'].includes(key)
                                ).map(([key, { label, color }]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setUploadDocType(key as UploadDocType); setShowTypeSelector(false); }}
                                        className={styles.typeDropdownItem}
                                        data-active={uploadDocType === key || undefined}
                                        style={{ '--type-color': color } as React.CSSProperties}
                                    >
                                        <span className={styles.typeDropdownDot} style={{ background: color }} />
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

            {/* ── Files List — Grouped by Document Type ── */}
            <div className={styles.filesSection}>
                <h3 className={styles.sectionTitle}>
                    Policy Documents
                    <span className={styles.fileCount}>({allFiles.length})</span>
                </h3>

                {allFiles.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FileText className={styles.emptyIcon} />
                        <p>No documents linked to this policy yet.</p>
                        <p className={styles.emptyHint}>
                            Drag & drop a PDF above to start processing.
                        </p>
                    </div>
                ) : (
                    <div className={styles.fileGroups}>
                        {sortedGroupKeys.map(groupKey => {
                            const files = grouped.get(groupKey)!;
                            const typeInfo = DOC_TYPE_LABELS[groupKey] || { label: groupKey.toUpperCase(), color: 'var(--text-muted)', groupLabel: groupKey };
                            return (
                                <div key={groupKey} className={styles.fileGroup}>
                                    <div className={styles.fileGroupHeader}>
                                        <span
                                            className={styles.fileGroupDot}
                                            style={{ background: typeInfo.color }}
                                        />
                                        <span className={styles.fileGroupTitle}>{typeInfo.groupLabel}</span>
                                        <span className={styles.fileGroupCount}>{files.length}</span>
                                    </div>
                                    <div className={styles.fileList}>
                                        {files.map(file => {
                                            const parseStatus = getParseStatusBadge(file.parse_status);
                                            const docTypeInfo = DOC_TYPE_LABELS[file.doc_type] || { label: file.doc_type.toUpperCase(), color: 'var(--text-muted)' };
                                            const decPageReview = getDecPageReview(file);

                                            return (
                                                <div key={`${file.source}-${file.id}`} className={styles.fileItem}>
                                                    <div className={styles.fileInfo}>
                                                        <div className={styles.fileIconWrap} style={{ '--doc-color': docTypeInfo.color } as React.CSSProperties}>
                                                            <FileText size={18} />
                                                        </div>
                                                        <div className={styles.fileDetails}>
                                                            <div className={styles.fileName}>
                                                                <span
                                                                    className={styles.docTypeBadge}
                                                                    style={{
                                                                        backgroundColor: `${docTypeInfo.color}18`,
                                                                        color: docTypeInfo.color,
                                                                        borderColor: `${docTypeInfo.color}30`,
                                                                    }}
                                                                >
                                                                    {docTypeInfo.label}
                                                                </span>
                                                                <span className={styles.fileNameText}>{file.file_name || 'Document'}</span>
                                                            </div>
                                                            <div className={styles.fileMeta}>
                                                                <span
                                                                    className={styles.statusBadge}
                                                                    style={{
                                                                        backgroundColor: `color-mix(in srgb, ${parseStatus.color} 12%, transparent)`,
                                                                        color: parseStatus.color,
                                                                    }}
                                                                >
                                                                    {parseStatus.icon}
                                                                    <span>{parseStatus.label}</span>
                                                                </span>
                                                                {file.processing_step && file.parse_status === 'processing' && (
                                                                    <span className={styles.processingStep}>
                                                                        {file.processing_step.replace(/_/g, ' ')}
                                                                    </span>
                                                                )}
                                                                {/* Dec page review status */}
                                                                {decPageReview && (
                                                                    <span
                                                                        className={styles.statusBadge}
                                                                        style={{
                                                                            backgroundColor: `color-mix(in srgb, ${REVIEW_STATUS_CONFIG[decPageReview.review_status]?.color || 'var(--text-muted)'} 12%, transparent)`,
                                                                            color: REVIEW_STATUS_CONFIG[decPageReview.review_status]?.color || 'var(--text-muted)',
                                                                        }}
                                                                    >
                                                                        {REVIEW_STATUS_CONFIG[decPageReview.review_status]?.icon}
                                                                        <span>{REVIEW_STATUS_CONFIG[decPageReview.review_status]?.label || 'Unknown'}</span>
                                                                    </span>
                                                                )}
                                                                <span>{formatFileSize(file.file_size)}</span>
                                                                <span>{formatDate(file.uploaded_at)}</span>
                                                            </div>
                                                            {file.error_message && file.parse_status !== 'parsed' && (
                                                                <div className={styles.errorMessage}>
                                                                    {file.error_message}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={styles.fileActions}>
                                                        {/* Inline approve for pending dec pages */}
                                                        {decPageReview && (decPageReview.review_status === 'pending' || decPageReview.review_status === 'superseded') && (
                                                            <button
                                                                className={styles.approveBtn}
                                                                onClick={() => handleApproveDecPage(decPageReview.id)}
                                                                disabled={approvingId === decPageReview.id}
                                                                title={decPageReview.review_status === 'pending' ? 'Approve this dec page' : 'Re-approve this dec page'}
                                                            >
                                                                {approvingId === decPageReview.id ? (
                                                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                                ) : (
                                                                    <CheckCircle2 size={14} />
                                                                )}
                                                                <span>{decPageReview.review_status === 'pending' ? 'Approve' : 'Re-approve'}</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            className={styles.actionBtn}
                                                            title="View in new tab"
                                                            onClick={() => handleView(file)}
                                                            disabled={!file.storage_path || actionId === file.id + '_view'}
                                                        >
                                                            {actionId === file.id + '_view'
                                                                ? <Loader2 size={16} className={styles.spinnerSmall} />
                                                                : <Eye size={16} />
                                                            }
                                                        </button>
                                                        <button
                                                            className={styles.actionBtn}
                                                            title="Download file"
                                                            onClick={() => handleDownload(file)}
                                                            disabled={!file.storage_path || actionId === file.id + '_dl'}
                                                        >
                                                            {actionId === file.id + '_dl'
                                                                ? <Loader2 size={16} className={styles.spinnerSmall} />
                                                                : <Download size={16} />
                                                            }
                                                        </button>
                                                        <button
                                                            className={styles.actionBtn}
                                                            title="Delete file"
                                                            onClick={() => handleDelete(file)}
                                                            disabled={actionId === file.id + '_delete'}
                                                        >
                                                            {actionId === file.id + '_delete'
                                                                ? <Loader2 size={16} className={styles.spinnerSmall} />
                                                                : <Trash2 size={16} style={{ color: 'var(--status-error)' }} />
                                                            }
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
