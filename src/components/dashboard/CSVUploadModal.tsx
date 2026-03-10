'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Button } from '@/components/ui/Button/Button';
import {
    Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle,
    AlertTriangle, Copy, Loader2, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { parseCSVFile, commitImport, ParseResult, ImportRow, ImportStats } from '@/lib/csvImport';
import styles from './CSVUploadModal.module.scss';

interface CSVUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete?: () => void;
}

type Step = 'select' | 'parsing' | 'preview' | 'importing' | 'done';

export function CSVUploadModal({ isOpen, onClose, onImportComplete }: CSVUploadModalProps) {
    const [step, setStep] = useState<Step>('select');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [commitResult, setCommitResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>('valid');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setStep('select');
        setSelectedFile(null);
        setIsDragging(false);
        setParseResult(null);
        setCommitResult(null);
        setError(null);
        setExpandedSection('valid');
    }, []);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileSelect = (file: File) => {
        if (file.name.endsWith('.csv') || file.type === 'text/csv') {
            setSelectedFile(file);
            setError(null);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        e.target.value = '';
    };

    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleParse = async () => {
        if (!selectedFile) return;
        setStep('parsing');
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Session expired. Please sign in again.');
                setStep('select');
                return;
            }

            const result = await parseCSVFile(selectedFile, session.access_token);

            if (!result.success) {
                setError(result.error || 'Failed to parse CSV');
                setStep('select');
                return;
            }

            setParseResult(result);
            setStep('preview');

            // Auto-expand the most relevant section
            if (result.stats.name_mismatch > 0) {
                setExpandedSection('name_mismatch');
            } else if (result.stats.invalid > 0) {
                setExpandedSection('invalid');
            } else {
                setExpandedSection('valid');
            }
        } catch {
            setError('Failed to parse CSV. Please try again.');
            setStep('select');
        }
    };

    const handleCommit = async () => {
        if (!parseResult?.batch_id) return;
        setStep('importing');
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Session expired.');
                setStep('preview');
                return;
            }

            const result = await commitImport(parseResult.batch_id, session.access_token);

            if (!result.success) {
                setError('Import failed. Check rows and try again.');
                setStep('preview');
                return;
            }

            setCommitResult(result);
            setStep('done');
            onImportComplete?.();
        } catch {
            setError('Import failed. Please try again.');
            setStep('preview');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ─── Render helpers ───

    const renderStatBadge = (label: string, count: number, variant: 'success' | 'error' | 'warning' | 'info') => {
        if (count === 0) return null;
        const colorMap = {
            success: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' },
            error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' },
            warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' },
            info: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
        };
        const c = colorMap[variant];
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.75rem', fontWeight: 600,
                padding: '0.25rem 0.625rem', borderRadius: '9999px',
                background: c.bg, color: c.color, border: `1px solid ${c.border}`,
            }}>
                {count} {label}
            </span>
        );
    };

    const renderRowSection = (title: string, icon: React.ReactNode, rows: ImportRow[], sectionKey: string) => {
        if (rows.length === 0) return null;
        const isExpanded = expandedSection === sectionKey;
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <button
                    onClick={() => setExpandedSection(isExpanded ? null : sectionKey)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                        padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-high)',
                        fontSize: '0.8125rem', fontWeight: 600,
                    }}
                >
                    {icon}
                    {title} ({rows.length})
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {isExpanded ? '▾' : '▸'}
                    </span>
                </button>
                {isExpanded && (
                    <div style={{
                        maxHeight: '240px', overflowY: 'auto',
                        border: '1px solid var(--border-default)', borderTop: 'none',
                        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                    }}>
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-surface)' }}>
                                    <th style={thStyle}>Row</th>
                                    <th style={thStyle}>Policy #</th>
                                    <th style={thStyle}>Insured</th>
                                    <th style={thStyle}>Eff Date</th>
                                    <th style={thStyle}>Premium</th>
                                    <th style={thStyle}>Status / Issue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.row_index} style={{ borderBottom: '1px solid var(--border-default)' }}>
                                        <td style={tdStyle}>{row.row_index + 2}</td>
                                        <td style={tdStyle}>{row.policy_number || '—'}</td>
                                        <td style={tdStyle}>{row.insured_name || '—'}</td>
                                        <td style={tdStyle}>{row.effective_date || '—'}</td>
                                        <td style={tdStyle}>{row.annual_premium != null ? `$${row.annual_premium.toLocaleString()}` : '—'}</td>
                                        <td style={{ ...tdStyle, color: row.errors.length ? '#ef4444' : '#22c55e', maxWidth: '200px' }}>
                                            {row.errors.length > 0 ? row.errors.join('; ') : 'OK'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ─── Step content ───

    const modalTitle = {
        select: 'Upload CSV',
        parsing: 'Parsing CSV…',
        preview: 'Import Preview',
        importing: 'Importing…',
        done: 'Import Complete',
    }[step];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} maxWidth="720px">
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.625rem 0.875rem', marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: '#ef4444',
                }}>
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* ─── STEP: Select File ─── */}
            {step === 'select' && (
                <>
                    <div
                        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleInputChange}
                            className={styles.hiddenInput}
                        />
                        {selectedFile ? (
                            <div className={styles.selectedFile}>
                                <FileSpreadsheet size={28} className={styles.fileIcon} />
                                <div className={styles.fileInfo}>
                                    <span className={styles.fileName}>{selectedFile.name}</span>
                                    <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
                                </div>
                                <button className={styles.removeFileBtn} onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className={styles.dropPlaceholder}>
                                <Upload size={28} className={styles.uploadIcon} />
                                <span className={styles.dropText}>
                                    Drag & drop your CSV here, or <strong>browse</strong>
                                </span>
                                <span className={styles.dropHint}>Google Sheets export (.csv) accepted</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.actions}>
                        <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                        <Button variant="excel" size="sm" disabled={!selectedFile} onClick={handleParse}>
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Parse &amp; Preview
                        </Button>
                    </div>
                </>
            )}

            {/* ─── STEP: Parsing ─── */}
            {step === 'parsing' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-accent)' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-mid)' }}>
                        Parsing {selectedFile?.name}…
                    </span>
                </div>
            )}

            {/* ─── STEP: Preview ─── */}
            {step === 'preview' && parseResult && (
                <>
                    {/* Stats bar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        {renderStatBadge('Valid', parseResult.stats.valid, 'success')}
                        {renderStatBadge('Invalid', parseResult.stats.invalid, 'error')}
                        {renderStatBadge('Duplicates', parseResult.stats.duplicate, 'warning')}
                        {renderStatBadge('Name Mismatches', parseResult.stats.name_mismatch, 'info')}
                        <span style={{
                            fontSize: '0.75rem', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', marginLeft: 'auto',
                        }}>
                            {parseResult.stats.total} total rows
                        </span>
                    </div>

                    {/* Row sections */}
                    {renderRowSection(
                        'Valid Rows',
                        <CheckCircle2 size={14} style={{ color: '#22c55e' }} />,
                        parseResult.rows.filter(r => r.status === 'valid'),
                        'valid'
                    )}
                    {renderRowSection(
                        'Name Mismatches (flagged for review)',
                        <AlertTriangle size={14} style={{ color: '#3b82f6' }} />,
                        parseResult.rows.filter(r => r.status === 'name_mismatch'),
                        'name_mismatch'
                    )}
                    {renderRowSection(
                        'Duplicates in File',
                        <Copy size={14} style={{ color: '#f59e0b' }} />,
                        parseResult.rows.filter(r => r.status === 'duplicate'),
                        'duplicate'
                    )}
                    {renderRowSection(
                        'Invalid Rows',
                        <AlertCircle size={14} style={{ color: '#ef4444' }} />,
                        parseResult.rows.filter(r => r.status === 'invalid'),
                        'invalid'
                    )}

                    {/* Actions */}
                    <div className={styles.actions} style={{ marginTop: '0.5rem' }}>
                        <Button variant="ghost" size="sm" onClick={() => { setStep('select'); setParseResult(null); }}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                        <Button
                            variant="excel"
                            size="sm"
                            disabled={parseResult.stats.valid === 0}
                            onClick={handleCommit}
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Import {parseResult.stats.valid} Rows
                        </Button>
                    </div>
                </>
            )}

            {/* ─── STEP: Importing ─── */}
            {step === 'importing' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-accent)' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-mid)' }}>
                        Importing {parseResult?.stats.valid} rows…
                    </span>
                </div>
            )}

            {/* ─── STEP: Done ─── */}
            {step === 'done' && commitResult && (
                <>
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '1.5rem', gap: '0.75rem',
                    }}>
                        <CheckCircle2 size={40} style={{ color: '#22c55e' }} />
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-high)' }}>
                            Import Complete!
                        </span>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                            <span style={{ color: '#22c55e' }}>✓ {commitResult.imported} imported</span>
                            {commitResult.skipped > 0 && (
                                <span style={{ color: '#f59e0b' }}>⚠ {commitResult.skipped} skipped</span>
                            )}
                        </div>
                        {commitResult.errors.length > 0 && (
                            <div style={{
                                width: '100%', maxHeight: '120px', overflowY: 'auto', marginTop: '0.5rem',
                                padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)',
                                border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem', color: '#ef4444',
                            }}>
                                {commitResult.errors.map((e, i) => (
                                    <div key={i}>{e}</div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className={styles.actions}>
                        <Button variant="excel" size="sm" onClick={handleClose}>
                            Done
                        </Button>
                    </div>
                </>
            )}
        </Modal>
    );
}

// ─── Table styles ───
const thStyle: React.CSSProperties = {
    padding: '0.375rem 0.625rem',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-default)',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-surface)',
};

const tdStyle: React.CSSProperties = {
    padding: '0.375rem 0.625rem',
    color: 'var(--text-mid)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '160px',
};
