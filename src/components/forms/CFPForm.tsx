'use client';

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import styles from './CFPForm.module.scss';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

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
}

export function CFPForm({ userId }: CFPFormProps) {
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const validateFile = (selectedFile: File): string | null => {
        const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return `Unsupported file type "${ext}". Please upload a PDF, PNG, or JPG file.`;
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
                <h2 className={styles.title}>Submit for Coverage Review</h2>
                <p className={styles.description}>
                    Upload your current Declarations Page for a comprehensive professional review.
                    We&apos;ll analyze your policy and identify any coverage gaps.
                </p>
            </div>

            {/* Success banner */}
            {submitState === 'success' && uploadResult && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                }}>
                    <CheckCircle size={20} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            {uploadResult.message}
                        </p>
                        {uploadResult.fileName && (
                            <p style={{ color: 'rgba(34, 197, 94, 0.7)', fontSize: '0.8rem' }}>
                                File: {uploadResult.fileName}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Error banner */}
            {submitState === 'error' && uploadResult && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
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

            <form ref={formRef} onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Upload Declarations Page (PDF, Images)</label>
                    <div className={styles.fileInputContainer}>
                        <input
                            type="file"
                            name="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            required
                        />
                        <Upload className={styles.uploadIcon} size={24} />
                        <span className={styles.uploadText}>
                            {file ? file.name : "Click to upload or drag and drop"}
                        </span>
                        <span className={styles.uploadHint}>
                            Supported formats: PDF, PNG, JPG (max 10MB)
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

                {/* Terms and Conditions */}
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
                        <input type="checkbox" id="acceptTerms" required />
                        <label htmlFor="acceptTerms">
                            I have read and agree to the Terms and Conditions
                        </label>
                    </div>
                </div>

                <Button
                    type="submit"
                    fullWidth
                    isLoading={submitState === 'loading'}
                    disabled={!!fileError || submitState === 'loading'}
                >
                    {submitState === 'loading' ? 'Uploading...' : 'Submit for Review'}
                </Button>
            </form>
        </Card>
    );
}
