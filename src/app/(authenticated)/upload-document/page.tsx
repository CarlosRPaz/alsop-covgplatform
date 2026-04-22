'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Upload,
    FileText,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ArrowLeft,
    FileUp,
    Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';
import Link from 'next/link';

/** Valid document types for upload */
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

interface UploadResult {
    status: 'success' | 'error' | 'duplicate';
    message: string;
    documentId?: string;
    fileName?: string;
    docType?: string;
}

export default function UploadDocumentPage() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<DocTypeKey | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        if (!selectedType) return;

        // Validate
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (ext !== '.pdf') {
            setResult({ status: 'error', message: `Unsupported file type "${ext}". Only PDF files are accepted.` });
            return;
        }
        if (file.size === 0) {
            setResult({ status: 'error', message: 'The selected file is empty (0 bytes).' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setResult({ status: 'error', message: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.` });
            return;
        }

        setIsUploading(true);
        setResult(null);
        setUploadProgress('Authenticating...');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setResult({ status: 'error', message: 'Session expired. Please refresh and sign in again.' });
                return;
            }

            setUploadProgress('Uploading file...');

            const formData = new FormData();
            formData.set('file', file);
            formData.set('doc_type', selectedType);

            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });

            setUploadProgress('Processing response...');
            const json = await res.json();

            if (res.status === 409) {
                setResult({
                    status: 'duplicate',
                    message: json.message || 'This file has already been uploaded.',
                    fileName: file.name,
                    docType: selectedType,
                });
            } else if (res.ok && json.success) {
                setResult({
                    status: 'success',
                    message: json.message || 'Document uploaded successfully.',
                    documentId: json.data?.documentId,
                    fileName: file.name,
                    docType: selectedType,
                });
            } else {
                setResult({
                    status: 'error',
                    message: json.message || 'Upload failed. Please try again.',
                    fileName: file.name,
                    docType: selectedType,
                });
            }
        } catch (err) {
            console.error('Upload error:', err);
            setResult({ status: 'error', message: 'Network error during upload. Please try again.' });
        } finally {
            setIsUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [selectedType]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleUpload(e.target.files[0]);
    };

    const selectedTypeInfo = DOC_TYPES.find(t => t.key === selectedType);

    return (
        <main style={{ padding: '2rem', maxWidth: '48rem', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '0.25rem',
                    }}
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

            {/* Step 1: Select Document Type */}
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
                            onClick={() => { setSelectedType(type.key); setResult(null); }}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                padding: '1rem 1.25rem',
                                borderRadius: '0.75rem',
                                border: selectedType === type.key
                                    ? `2px solid ${type.color}`
                                    : '2px solid var(--border-default)',
                                background: selectedType === type.key
                                    ? `${type.color}08`
                                    : 'var(--bg-surface-raised)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '1.4rem' }}>{type.icon}</span>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                                    padding: '0.15rem 0.5rem', borderRadius: '0.25rem',
                                    backgroundColor: `${type.color}20`, color: type.color,
                                }}>
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

            {/* Step 2: Upload File */}
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
                        <span style={{
                            marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                            padding: '0.1rem 0.4rem', borderRadius: '0.25rem',
                            backgroundColor: `${selectedTypeInfo.color}20`,
                            color: selectedTypeInfo.color,
                        }}>
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
                        border: isDragOver
                            ? `2px dashed ${selectedTypeInfo?.color || 'var(--accent-primary)'}`
                            : '2px dashed var(--border-default)',
                        borderRadius: '0.75rem',
                        padding: '2.5rem 2rem',
                        textAlign: 'center',
                        cursor: isUploading ? 'wait' : 'pointer',
                        background: isDragOver
                            ? `${selectedTypeInfo?.color || 'var(--accent-primary)'}08`
                            : 'var(--bg-surface-raised)',
                        transition: 'all 0.2s',
                    }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    {isUploading ? (
                        <>
                            <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: selectedTypeInfo?.color || 'var(--accent-primary)', marginBottom: '0.75rem' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)' }}>
                                Uploading {selectedTypeInfo?.label}…
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {uploadProgress || 'Sending to processing pipeline'}
                            </p>
                        </>
                    ) : (
                        <>
                            <FileUp size={36} style={{ color: selectedTypeInfo?.color || 'var(--text-muted)', marginBottom: '0.75rem' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)' }}>
                                {isDragOver ? (
                                    <span style={{ color: selectedTypeInfo?.color }}>Drop PDF here</span>
                                ) : (
                                    <>Drop a {selectedTypeInfo?.label || 'document'} PDF here or <span style={{ color: 'var(--accent-primary)' }}>click to browse</span></>
                                )}
                            </p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                PDF only · Max 10MB · Processed automatically by the ingestion pipeline
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Result Card */}
            {result && (
                <div style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${
                        result.status === 'success' ? '#10b981' :
                        result.status === 'duplicate' ? '#f59e0b' : '#ef4444'
                    }40`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.25rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        {result.status === 'success' && <CheckCircle size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '0.1rem' }} />}
                        {result.status === 'duplicate' && <AlertTriangle size={22} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.1rem' }} />}
                        {result.status === 'error' && <XCircle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: '0.1rem' }} />}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem',
                                color: result.status === 'success' ? '#10b981' :
                                       result.status === 'duplicate' ? '#f59e0b' : '#ef4444',
                            }}>
                                {result.status === 'success' ? 'Upload Successful' :
                                 result.status === 'duplicate' ? 'Duplicate Detected' : 'Upload Failed'}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>
                                {result.message}
                            </p>

                            {result.status === 'success' && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        setResult(null);
                                        setSelectedType(null);
                                    }}>
                                        <FileUp style={{ width: 13, height: 13, marginRight: 5 }} />
                                        Upload Another
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
                                        Back to Dashboard
                                    </Button>
                                </div>
                            )}

                            {result.status === 'error' && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <Button size="sm" variant="outline" onClick={() => setResult(null)}>
                                        Try Again
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem 1.5rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.7,
            }}>
                <strong style={{ color: 'var(--text-mid)' }}>What happens after upload?</strong>
                <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', marginBottom: 0 }}>
                    <li>The document is stored securely and queued for processing</li>
                    <li>Text is extracted (OCR if needed for scanned documents)</li>
                    <li>Key fields are parsed using AI-powered extraction</li>
                    <li>The system matches the document to an existing policy by owner name and address</li>
                    <li>Extracted data is applied to the policy (RCE → enrichments, DIC → stored for reference)</li>
                    <li>If no match is found, the document appears in your review queue for manual assignment</li>
                </ol>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
    );
}
