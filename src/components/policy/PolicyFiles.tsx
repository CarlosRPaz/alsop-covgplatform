'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, Download, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import {
    fetchDecPageFilesByPolicyId,
    getDecPageFileDownloadUrl,
    DecPageFileInfo,
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

export function PolicyFiles({ policyId }: PolicyFilesProps) {
    const [files, setFiles] = useState<DecPageFileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const loadFiles = useCallback(() => {
        fetchDecPageFilesByPolicyId(policyId)
            .then(setFiles)
            .catch(err => console.error('Failed to fetch policy files:', err))
            .finally(() => setLoading(false));
    }, [policyId]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    // Auto-refresh when a dec page finishes processing in the background
    useEffect(() => {
        const handleDecPageParsed = () => {
            loadFiles();
        };
        window.addEventListener('decPageParsed', handleDecPageParsed);
        return () => window.removeEventListener('decPageParsed', handleDecPageParsed);
    }, [loadFiles]);

    // ── Upload handler (proper pipeline) ──
    const handleUploadFile = useCallback(async (file: File) => {
        // Validate
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

                // Track for DecPageObserver global toast notifications
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

                // Reload file list immediately (it may show as "Processing")
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
    }, [policyId, toast, loadFiles]);

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

    const handleDownload = useCallback(async (file: DecPageFileInfo) => {
        if (!file.storage_path) return;
        setDownloadingId(file.id);
        try {
            const url = await getDecPageFileDownloadUrl(file.storage_path);
            if (url) {
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloadingId(null);
        }
    }, []);

    const handlePreview = useCallback(async (file: DecPageFileInfo) => {
        if (!file.storage_path) return;
        setDownloadingId(file.id);
        try {
            const url = await getDecPageFileDownloadUrl(file.storage_path);
            if (url) {
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('Preview failed:', err);
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

    return (
        <div className={styles.container}>
            {/* ── Inline Upload Zone ── */}
            <div className={styles.uploadSection}>
                <h3 className={styles.sectionTitle}>Upload Declaration Page</h3>
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
                            <p className={styles.dropzoneText}>Uploading…</p>
                            <p className={styles.dropzoneHint}>File is being sent to the processing pipeline</p>
                        </>
                    ) : (
                        <>
                            <Upload className={styles.uploadIcon} />
                            <p className={styles.dropzoneText}>
                                {isDragOver ? (
                                    <strong style={{ color: 'var(--accent-primary)' }}>Drop PDF here</strong>
                                ) : (
                                    <>Drop a PDF here or <strong style={{ color: 'var(--accent-primary)' }}>click to browse</strong></>
                                )}
                            </p>
                            <p className={styles.dropzoneHint}>
                                PDF only, max 10MB · Uploaded files are processed automatically
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* ── Declaration Pages List ── */}
            <div className={styles.filesSection}>
                <h3 className={styles.sectionTitle}>
                    Declaration Pages
                    <span className={styles.fileCount}>({files.length})</span>
                </h3>

                {files.length === 0 ? (
                    <div className={styles.emptyState}>
                        <AlertCircle className={styles.emptyIcon} />
                        <p>No declaration pages linked to this policy yet.</p>
                        <p className={styles.emptyHint}>
                            Drag & drop a PDF above to start processing.
                        </p>
                    </div>
                ) : (
                    <div className={styles.fileList}>
                        {files.map(file => {
                            const parseStatus = getParseStatusBadge(file.parse_status);
                            return (
                                <div key={file.id} className={styles.fileItem}>
                                    <div className={styles.fileInfo}>
                                        <FileText className={styles.fileIcon} />
                                        <div>
                                            <div className={styles.fileName}>
                                                {file.file_name || 'Declaration Page'}
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
                                                <span>{formatFileSize(file.file_size)}</span>
                                                <span>{formatDate(file.uploaded_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fileActions}>
                                        <button
                                            className={styles.iconButton}
                                            title="Preview"
                                            onClick={() => handlePreview(file)}
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
                                            onClick={() => handleDownload(file)}
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
