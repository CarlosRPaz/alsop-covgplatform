'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import styles from './CFPForm.module.scss';
import { Upload, CheckCircle, AlertCircle, ArrowRight, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf']);

type SubmitState = 'idle' | 'loading' | 'success' | 'error';
type ProcessingStatus = 'uploading' | 'queued' | 'processing' | 'parsed' | 'failed' | null;
type ProcessingStep = 'extracting_text' | 'parsing_fields' | 'creating_records' | 'enriching_property' | 'evaluating_flags' | 'generating_report' | 'complete' | null;

interface UploadResult {
    message: string;
    fileName?: string;
    submittedAt?: string;
    submissionId?: string;
}

interface CFPFormProps {
    /** Authenticated user ID (required — this component should only render for authed users) */
    userId: string;
    /** User role — determines T&C visibility and post-submit routing */
    userRole?: 'admin' | 'service' | 'agent' | 'user' | 'customer';
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CFPForm({ userId, userRole }: CFPFormProps) {
    const router = useRouter();
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(null);
    const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isAgent = userRole === 'admin' || userRole === 'service';

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current) abortRef.current.abort();
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    const validateFile = (selectedFile: File): string | null => {
        const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return `Unsupported file type "${ext}". Please upload a PDF file.`;
        }
        if (selectedFile.size === 0) {
            return 'The selected file is empty (0 bytes). Please select a valid PDF.';
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            return `File size (${formatFileSize(selectedFile.size)}) exceeds the 10MB limit.`;
        }
        return null;
    };

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFileError(null);
        const error = validateFile(selectedFile);
        if (error) {
            setFileError(error);
            setFile(null);
            return;
        }
        setFile(selectedFile);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    // Drag and drop handlers
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
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, [handleFileSelect]);

    // Poll for processing status after successful upload
    const startPolling = useCallback((submissionId: string) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        const checkStatus = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch(`/api/upload/status?ids=${submissionId}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                });
                if (!res.ok) return;

                const json = await res.json();
                if (!json.success || !json.data?.[0]) return;

                const status = json.data[0].status as ProcessingStatus;
                const step = json.data[0].processing_step as ProcessingStep;
                setProcessingStatus(status);
                setProcessingStep(step);

                if (status === 'parsed') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    window.dispatchEvent(new CustomEvent('decPageParsed'));
                    // Auto-redirect agents after parse completes
                    if (isAgent) {
                        setTimeout(() => router.push('/dashboard'), 2000);
                    }
                } else if (status === 'failed') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                }
            } catch {
                // Polling error — non-fatal, keep trying
            }
        };

        // Check immediately, then every 3 seconds
        checkStatus();
        pollIntervalRef.current = setInterval(checkStatus, 3000);
    }, [isAgent, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        // Cancel any in-flight upload
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setSubmitState('loading');
        setUploadResult(null);
        setUploadProgress(0);
        setProcessingStatus('uploading');
        setProcessingStep(null);

        try {
            const formData = new FormData();
            formData.set('file', file);

            // Auth token is required — user is always authenticated at this point
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setSubmitState('error');
                setProcessingStatus(null);
                setUploadResult({ message: 'Session expired. Please refresh the page and sign in again.' });
                return;
            }

            // Use XMLHttpRequest for upload progress tracking
            const result = await new Promise<{ ok: boolean; data: Record<string, unknown> }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const pct = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(pct);
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        resolve({ ok: xhr.status >= 200 && xhr.status < 300, data: json });
                    } catch {
                        reject(new Error('Invalid server response'));
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
                xhr.addEventListener('timeout', () => reject(new Error('Upload timed out. The server took too long to respond. Please try again.')));

                // Listen for abort signal
                abortRef.current?.signal.addEventListener('abort', () => xhr.abort());

                xhr.timeout = 90000; // 90 seconds
                xhr.open('POST', '/api/upload');
                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
                xhr.send(formData);
            });

            if (!result.ok || !result.data.success) {
                setSubmitState('error');
                setProcessingStatus(null);
                setUploadResult({
                    message: (result.data.message as string) || 'Upload failed. Please try again.',
                });
                return;
            }

            const responseData = result.data.data as Record<string, unknown> | undefined;
            const submissionId = responseData?.submissionId as string | undefined;

            setSubmitState('success');
            setProcessingStatus('queued');
            setUploadResult({
                message: result.data.message as string,
                fileName: responseData?.fileName as string | undefined,
                submittedAt: responseData?.submittedAt as string | undefined,
                submissionId,
            });

            // Track pending uploads globally for toast notifications
            if (submissionId) {
                try {
                    const key = 'cfp_pending_dec_uploads';
                    const stored = sessionStorage.getItem(key);
                    const pending = stored ? JSON.parse(stored) : [];
                    if (!pending.includes(submissionId)) {
                        pending.push(submissionId);
                        sessionStorage.setItem(key, JSON.stringify(pending));
                    }
                } catch (e) {
                    console.error('Failed to update session storage for dec page tracking', e);
                }

                // Start inline status polling
                startPolling(submissionId);
            }

            // Reset file after successful upload
            setFile(null);
            if (formRef.current) formRef.current.reset();
        } catch (err) {
            if (err instanceof Error && err.message === 'Upload cancelled') {
                setSubmitState('idle');
                setProcessingStatus(null);
                return;
            }
            setSubmitState('error');
            setProcessingStatus(null);
            setUploadResult({
                message: err instanceof Error
                    ? `Network error: ${err.message}`
                    : 'An unexpected error occurred. Please check your connection and try again.',
            });
        }
    };

    // Processing status label for success state (with granular step awareness)
    const getProcessingLabel = (): { text: string; color: string; icon: React.ReactNode } => {
        const spinIcon = <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />;

        // If we have a granular processing_step and status is 'processing', show the step
        if (processingStatus === 'processing' && processingStep) {
            const stepLabels: Record<string, { text: string; color: string }> = {
                extracting_text: { text: 'Extracting text from PDF…', color: 'var(--accent-primary, #6366f1)' },
                parsing_fields: { text: 'Parsing declaration fields…', color: 'var(--accent-primary, #6366f1)' },
                creating_records: { text: 'Creating policy records…', color: 'var(--accent-primary, #6366f1)' },
                enriching_property: { text: 'Enriching property data (ATTOM, satellite, AI)…', color: 'var(--accent-info, #3b82f6)' },
                evaluating_flags: { text: 'Running flag evaluation…', color: 'var(--accent-info, #3b82f6)' },
                generating_report: { text: 'Generating AI report…', color: 'var(--accent-info, #3b82f6)' },
                complete: { text: 'Finalizing…', color: 'var(--status-success, #22c55e)' },
            };
            const step = stepLabels[processingStep] || { text: 'Processing…', color: 'var(--accent-primary, #6366f1)' };
            return { ...step, icon: spinIcon };
        }

        switch (processingStatus) {
            case 'uploading':
                return { text: 'Uploading…', color: 'var(--accent-primary, #6366f1)', icon: spinIcon };
            case 'queued':
                return { text: 'Queued for processing…', color: 'var(--accent-warning, #f59e0b)', icon: spinIcon };
            case 'processing':
                return { text: 'Processing declaration page…', color: 'var(--accent-primary, #6366f1)', icon: spinIcon };
            case 'parsed':
                return { text: 'Successfully processed!', color: 'var(--status-success, #22c55e)', icon: <CheckCircle size={16} /> };
            case 'failed':
                return { text: 'Processing failed', color: 'var(--status-error, #ef4444)', icon: <AlertCircle size={16} /> };
            default:
                return { text: 'Processing…', color: 'var(--text-muted)', icon: spinIcon };
        }
    };

    return (
        <Card className={styles.formContainer} variant="glass">
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {isAgent ? 'Upload Declaration Page' : 'Submit for Coverage Review'}
                </h2>
                {!isAgent && (
                    <p className={styles.description}>
                        Upload your current Declarations Page for a comprehensive professional review.
                        We&apos;ll analyze your policy and identify any coverage gaps.
                    </p>
                )}
            </div>

            {submitState === 'success' && uploadResult ? (
                /* ─── Inline Success State ─── */
                <div style={{
                    textAlign: 'center',
                    padding: '2.5rem 1.5rem',
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--bg-success-subtle, rgba(34, 197, 94, 0.15))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem',
                    }}>
                        <CheckCircle size={28} style={{ color: 'var(--status-success, #22c55e)' }} />
                    </div>

                    <h3 style={{ color: 'var(--status-success, #22c55e)', fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Declaration Submitted Successfully
                    </h3>

                    {uploadResult.fileName && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            {uploadResult.fileName}
                        </p>
                    )}

                    {/* ─── Inline Processing Status ─── */}
                    {(() => {
                        const status = getProcessingLabel();
                        return (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                color: status.color,
                                fontSize: '0.85rem',
                                marginTop: '1rem',
                                padding: '0.625rem 1rem',
                                background: 'var(--bg-surface-raised, rgba(255,255,255,0.03))',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md, 0.5rem)',
                            }}>
                                {status.icon}
                                {status.text}
                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                        );
                    })()}

                    {isAgent && processingStatus === 'parsed' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem',
                            marginTop: '0.75rem',
                        }}>
                            <div style={{
                                width: '16px', height: '16px',
                                border: '2px solid var(--border-default)',
                                borderTopColor: 'var(--accent-primary, #3b82f6)',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            Returning to dashboard...
                        </div>
                    )}

                    {!isAgent && processingStatus === 'parsed' && (
                        /* Client: what happens next */
                        <div style={{
                            background: 'var(--bg-info-subtle, rgba(59, 130, 246, 0.08))',
                            border: '1px solid var(--border-info, rgba(59, 130, 246, 0.15))',
                            borderRadius: '0.75rem',
                            padding: '1.25rem',
                            marginTop: '1.25rem',
                            textAlign: 'left',
                        }}>
                            <p style={{ color: 'var(--accent-primary, #60a5fa)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                What happens next?
                            </p>
                            <ul style={{ color: 'var(--text-mid)', fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
                                <li>Your declaration has been securely processed</li>
                                <li>Our team will review your policy details</li>
                                <li>You&apos;ll receive a comprehensive coverage analysis</li>
                                <li>Your agent will reach out with findings and recommendations</li>
                            </ul>
                        </div>
                    )}

                    {/* Upload another */}
                    <button
                        onClick={() => {
                            setSubmitState('idle');
                            setUploadResult(null);
                            setProcessingStatus(null);
                            setProcessingStep(null);
                            setUploadProgress(0);
                            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        }}
                        style={{
                            marginTop: '1.5rem',
                            background: 'transparent',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-muted)',
                            padding: '0.5rem 1.25rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                        }}
                    >
                        Upload another declaration
                    </button>
                </div>
            ) : (
                /* ─── Upload Form ─── */
                <form ref={formRef} onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Upload Declarations Page (PDF only)</label>
                        <div
                            className={`${styles.fileInputContainer} ${isDragOver ? styles.dragover : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                name="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                required
                            />
                            <Upload className={styles.uploadIcon} size={24} />
                            <span className={styles.uploadText}>
                                {file ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={16} />
                                        {file.name}
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            ({formatFileSize(file.size)})
                                        </span>
                                    </span>
                                ) : isDragOver ? (
                                    'Drop your PDF here'
                                ) : (
                                    'Click to upload or drag and drop'
                                )}
                            </span>
                            <span className={styles.uploadHint}>
                                Supported format: PDF only (max 10MB)
                            </span>
                        </div>
                        {fileError && (
                            <p style={{
                                color: 'var(--status-error, #fca5a5)',
                                fontSize: '0.8rem',
                                marginTop: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                            }}>
                                <AlertCircle size={14} />
                                {fileError}
                            </p>
                        )}
                    </div>

                    {/* Upload Progress Bar */}
                    {submitState === 'loading' && uploadProgress > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '0.375rem',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)',
                            }}>
                                <span>Uploading...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{
                                height: '6px',
                                background: 'var(--bg-surface-raised, rgba(255,255,255,0.06))',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${uploadProgress}%`,
                                    background: 'var(--accent-primary, #6366f1)',
                                    borderRadius: '3px',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Terms and Conditions — clients only */}
                    {!isAgent && (
                        <div className={styles.termsSection}>
                            <h3 className={styles.termsTitle}>Terms and Conditions</h3>
                            <div className={styles.termsContent}>
                                <p><strong>DISCLAIMER: TEMPORARY PLACEHOLDER TEXT</strong></p>
                                <p>
                                    This document contains temporary filler text and placeholder content for demonstration
                                    purposes only. This text is explicitly NOT intended to serve as legally binding terms
                                    and conditions, nor does it constitute a valid legal agreement between any parties.
                                </p>
                                <p>
                                    By using this service, you acknowledge and agree that: (1) This placeholder text cannot
                                    be used, cited, or referenced in any court of law or legal proceeding; (2) We explicitly
                                    state that this is dummy text created solely for development and testing purposes;
                                    (3) Neither the platform owners, developers, nor any affiliated parties shall be held
                                    accountable, liable, or responsible for any interpretation or misuse of this temporary
                                    content.
                                </p>
                                <p>
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
                                    ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                                    ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                                    reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                                </p>
                                <p>
                                    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                                    mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a
                                    odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit.
                                </p>
                                <p>
                                    <em>This placeholder will be replaced with official Terms and Conditions before
                                        production deployment.</em>
                                </p>
                            </div>
                            <div className={styles.termsCheckbox}>
                                <input 
                                    type="checkbox" 
                                    id="acceptTerms" 
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    required 
                                />
                                <label htmlFor="acceptTerms">
                                    I have read and agree to the Terms and Conditions
                                </label>
                            </div>
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        isLoading={submitState === 'loading'}
                        disabled={!!fileError || submitState === 'loading' || !file || (!isAgent && !termsAccepted)}
                    >
                        {submitState === 'loading' ? 'Uploading...' : (isAgent ? 'Upload Declaration' : 'Submit for Review')}
                    </Button>

                    {/* Persistent hint when button is disabled due to T&C */}
                    {!isAgent && !termsAccepted && (
                        <p style={{
                            textAlign: 'center',
                            fontSize: '0.8rem',
                            color: 'var(--accent-warning, #f59e0b)',
                            marginTop: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                        }}>
                            <AlertCircle size={14} />
                            Please accept the Terms and Conditions to continue
                        </p>
                    )}

                    {/* Persistent hint when no file is attached */}
                    {!file && (
                        <p style={{
                            textAlign: 'center',
                            fontSize: '0.8rem',
                            color: 'var(--accent-warning, #f59e0b)',
                            marginTop: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                        }}>
                            <AlertCircle size={14} />
                            A PDF declaration page is required to submit
                        </p>
                    )}

                    {/* Inline error below button */}
                    {submitState === 'error' && uploadResult && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            padding: '1rem 1.25rem',
                            background: 'var(--bg-error-subtle, rgba(239, 68, 68, 0.1))',
                            border: '1px solid var(--border-error, rgba(239, 68, 68, 0.2))',
                            borderRadius: '0.75rem',
                            marginTop: '1rem',
                        }}>
                            <AlertCircle size={20} style={{ color: 'var(--status-error, #ef4444)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <p style={{ color: 'var(--status-error, #fca5a5)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                    Upload failed
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {uploadResult.message}
                                </p>
                            </div>
                        </div>
                    )}
                </form>
            )}
        </Card>
    );
}
