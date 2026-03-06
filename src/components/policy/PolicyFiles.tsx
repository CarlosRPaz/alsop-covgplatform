'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Download, Eye, AlertCircle } from 'lucide-react';
import {
    fetchDecPageFilesByPolicyId,
    getDecPageFileDownloadUrl,
    DecPageFileInfo,
} from '@/lib/api';
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

function getParseStatusBadge(status: string | null): { label: string; color: string } {
    switch (status) {
        case 'parsed': return { label: 'Parsed', color: '#10b981' };
        case 'needs_review': return { label: 'Needs Review', color: '#f59e0b' };
        case 'failed': return { label: 'Failed', color: '#ef4444' };
        default: return { label: 'Processing', color: '#6b7280' };
    }
}

export function PolicyFiles({ policyId }: PolicyFilesProps) {
    const [files, setFiles] = useState<DecPageFileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        fetchDecPageFilesByPolicyId(policyId)
            .then(setFiles)
            .catch(err => console.error('Failed to fetch policy files:', err))
            .finally(() => setLoading(false));
    }, [policyId]);

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
            {/* Upload Section */}
            <div className={styles.uploadSection}>
                <h3 className={styles.sectionTitle}>Upload Files</h3>
                <div className={styles.dropzone}>
                    <Upload className={styles.uploadIcon} />
                    <p className={styles.dropzoneText}>
                        To upload declaration pages, use the{' '}
                        <a href="/submit-declaration" className={styles.browseLink}>
                            Submit Declaration
                        </a>{' '}
                        form.
                    </p>
                    <p className={styles.dropzoneHint}>Submitted files will appear here once processed.</p>
                </div>
            </div>

            {/* Declaration Pages */}
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
                            Upload a declaration via "Submit Declaration" and the worker will process and link it here.
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
                                                    {parseStatus.label}
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
        </div>
    );
}
