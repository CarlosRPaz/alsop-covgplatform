'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Button } from '@/components/ui/Button/Button';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react';
import styles from './CSVUploadModal.module.scss';

/** Required / expected columns for the CSV upload */
const CSV_COLUMNS = [
    { name: 'insured_name', label: 'Insured Name', required: true },
    { name: 'mailing_address', label: 'Mailing Address', required: false },
    { name: 'property_location', label: 'Property / Risk Address', required: false },
    { name: 'policy_number', label: 'Policy Number', required: true },
    { name: 'policy_period_start', label: 'Effective Date (MM/DD/YYYY)', required: false },
    { name: 'policy_period_end', label: 'Expiration Date (MM/DD/YYYY)', required: false },
    { name: 'total_annual_premium', label: 'Annual Premium ($)', required: false },
    { name: 'carrier_name', label: 'Insurance Carrier', required: false },
];

interface CSVUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called when the user confirms the upload with a selected file */
    onUpload?: (file: File) => void;
}

export function CSVUploadModal({ isOpen, onClose, onUpload }: CSVUploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setSelectedFile(null);
        setIsDragging(false);
    }, []);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileSelect = (file: File) => {
        if (file.name.endsWith('.csv') || file.type === 'text/csv') {
            setSelectedFile(file);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        e.target.value = '';
    };

    // Drag handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleUpload = () => {
        if (selectedFile && onUpload) {
            onUpload(selectedFile);
        }
        handleClose();
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Upload CSV" maxWidth="560px">
            {/* Rules Section */}
            <div className={styles.rulesSection}>
                <div className={styles.rulesHeader}>
                    <AlertCircle size={16} className={styles.rulesIcon} />
                    <span>CSV Column Requirements</span>
                </div>
                <p className={styles.rulesDescription}>
                    Your CSV file should include the following columns. Headers must match the column names exactly.
                </p>
                <div className={styles.columnList}>
                    {CSV_COLUMNS.map((col) => (
                        <div key={col.name} className={styles.columnItem}>
                            <code className={styles.columnName}>{col.name}</code>
                            <span className={styles.columnLabel}>{col.label}</span>
                            {col.required && (
                                <span className={styles.requiredBadge}>Required</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Upload Area */}
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
                        <button
                            className={styles.removeFileBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className={styles.dropPlaceholder}>
                        <Upload size={28} className={styles.uploadIcon} />
                        <span className={styles.dropText}>
                            Drag & drop your CSV here, or <strong>browse</strong>
                        </span>
                        <span className={styles.dropHint}>Only .csv files are accepted</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    variant="excel"
                    size="sm"
                    disabled={!selectedFile}
                    onClick={handleUpload}
                >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Upload CSV
                </Button>
            </div>
        </Modal>
    );
}
