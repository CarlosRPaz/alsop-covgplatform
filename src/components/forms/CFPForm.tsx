'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import styles from './CFPForm.module.scss';
import { Upload, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf']);

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

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
    userRole?: 'admin' | 'service' | 'user' | 'customer';
}

export function CFPForm({ userId, userRole }: CFPFormProps) {
    const router = useRouter();
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const isAgent = userRole === 'admin' || userRole === 'service';

    const validateFile = (selectedFile: File): string | null => {
        const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return `Unsupported file type "${ext}". Please upload a PDF file.`;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            return `File size (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.`;
        }
        return null;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError(null);
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const error = validateFile(selectedFile);
            if (error) {
                setFileError(error);
                setFile(null);
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setSubmitState('loading');
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.set('file', file);

            // Auth token is required — user is always authenticated at this point
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setSubmitState('error');
                setUploadResult({ message: 'Session expired. Please refresh the page and sign in again.' });
                return;
            }

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setSubmitState('error');
                setUploadResult({
                    message: result.message || 'Upload failed. Please try again.',
                });
                return;
            }

            setSubmitState('success');
            setUploadResult({
                message: result.message,
                fileName: result.data?.fileName,
                submittedAt: result.data?.submittedAt,
                submissionId: result.data?.submissionId,
            });

            // Reset file after successful upload
            setFile(null);
            if (formRef.current) formRef.current.reset();

            // Auto-redirect agents to dashboard after brief delay
            if (isAgent) {
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2500);
            }
        } catch (err) {
            setSubmitState('error');
            setUploadResult({
                message: err instanceof Error
                    ? `Network error: ${err.message}`
                    : 'An unexpected error occurred. Please check your connection and try again.',
            });
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
                        background: 'rgba(34, 197, 94, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem',
                    }}>
                        <CheckCircle size={28} style={{ color: '#22c55e' }} />
                    </div>

                    <h3 style={{ color: '#22c55e', fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Declaration Submitted Successfully
                    </h3>

                    {uploadResult.fileName && (
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            {uploadResult.fileName}
                        </p>
                    )}

                    {isAgent ? (
                        /* Agent: redirect notice */
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.85rem',
                            marginTop: '1rem',
                        }}>
                            <div style={{
                                width: '16px', height: '16px',
                                border: '2px solid rgba(59,130,246,0.4)',
                                borderTopColor: '#3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            Returning to dashboard...
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        /* Client: what happens next */
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            borderRadius: '0.75rem',
                            padding: '1.25rem',
                            marginTop: '1.25rem',
                            textAlign: 'left',
                        }}>
                            <p style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                What happens next?
                            </p>
                            <ul style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
                                <li>Your declaration is being securely processed</li>
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
                        }}
                        style={{
                            marginTop: '1.5rem',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.4)',
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
                        <div className={styles.fileInputContainer}>
                            <input
                                type="file"
                                name="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                required
                            />
                            <Upload className={styles.uploadIcon} size={24} />
                            <span className={styles.uploadText}>
                                {file ? file.name : "Click to upload or drag and drop"}
                            </span>
                            <span className={styles.uploadHint}>
                                Supported format: PDF only (max 10MB)
                            </span>
                        </div>
                        {fileError && (
                            <p style={{
                                color: '#fca5a5',
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
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '0.75rem',
                            marginTop: '1rem',
                        }}>
                            <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <p style={{ color: '#fca5a5', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                    Upload failed
                                </p>
                                <p style={{ color: 'rgba(252, 165, 165, 0.7)', fontSize: '0.8rem' }}>
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
