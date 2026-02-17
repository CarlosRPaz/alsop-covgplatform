'use client';

import React, { useState } from 'react';
import { Upload, FileText, File, Trash2, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import styles from './PolicyFiles.module.css';

interface PolicyFile {
    id: string;
    name: string;
    type: string;
    category: string;
    uploadedAt: string;
    size: string;
}

const FILE_CATEGORIES = [
    { id: 'dec-pages', label: 'Dec Pages', icon: FileText },
    { id: 'ai-report', label: 'AI Report', icon: FileText },
    { id: 'invoices', label: 'Invoices', icon: File },
    { id: 'underwriting', label: 'Underwriting Notices', icon: FileText },
    { id: 'pending-cancel', label: 'Pending Cancellation', icon: FileText },
    { id: 'cancellation', label: 'Cancellation Notices', icon: FileText },
];

// Mock files data
const mockFiles: PolicyFile[] = [
    { id: '1', name: 'HO-983274-23_Dec_Page.pdf', type: 'PDF', category: 'dec-pages', uploadedAt: '2024-01-15', size: '245 KB' },
    { id: '2', name: 'AI_Coverage_Analysis.pdf', type: 'PDF', category: 'ai-report', uploadedAt: '2024-01-16', size: '128 KB' },
    { id: '3', name: 'Invoice_Q1_2024.pdf', type: 'PDF', category: 'invoices', uploadedAt: '2024-01-10', size: '56 KB' },
];

interface PolicyFilesProps {
    policyId: string;
}

export function PolicyFiles({ policyId }: PolicyFilesProps) {
    const [files, setFiles] = useState<PolicyFile[]>(mockFiles);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isDragging, setIsDragging] = useState(false);

    const filteredFiles = selectedCategory === 'all'
        ? files
        : files.filter(f => f.category === selectedCategory);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        // Handle file drop
        console.log('Files dropped:', e.dataTransfer.files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            console.log('Files selected:', e.target.files);
        }
    };

    const getCategoryLabel = (categoryId: string) => {
        return FILE_CATEGORIES.find(c => c.id === categoryId)?.label || categoryId;
    };

    return (
        <div className={styles.container}>
            {/* Upload Section */}
            <div className={styles.uploadSection}>
                <h3 className={styles.sectionTitle}>Upload Files</h3>
                <div
                    className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <Upload className={styles.uploadIcon} />
                    <p className={styles.dropzoneText}>
                        Drag and drop files here, or <label className={styles.browseLink}>
                            browse
                            <input
                                type="file"
                                multiple
                                className={styles.fileInput}
                                onChange={handleFileSelect}
                            />
                        </label>
                    </p>
                    <p className={styles.dropzoneHint}>Supports PDF, DOC, DOCX, JPG, PNG (Max 10MB)</p>
                </div>

                {/* Category Selection for Upload */}
                <div className={styles.categorySelect}>
                    <label className={styles.selectLabel}>File Category:</label>
                    <select className={styles.select}>
                        {FILE_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* File Categories */}
            <div className={styles.categoriesSection}>
                <h3 className={styles.sectionTitle}>File Categories</h3>
                <div className={styles.categoryTabs}>
                    <button
                        className={`${styles.categoryTab} ${selectedCategory === 'all' ? styles.categoryTabActive : ''}`}
                        onClick={() => setSelectedCategory('all')}
                    >
                        All Files
                    </button>
                    {FILE_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            className={`${styles.categoryTab} ${selectedCategory === cat.id ? styles.categoryTabActive : ''}`}
                            onClick={() => setSelectedCategory(cat.id)}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Files List */}
            <div className={styles.filesSection}>
                <h3 className={styles.sectionTitle}>
                    {selectedCategory === 'all' ? 'All Files' : getCategoryLabel(selectedCategory)}
                    <span className={styles.fileCount}>({filteredFiles.length})</span>
                </h3>

                {filteredFiles.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FileText className={styles.emptyIcon} />
                        <p>No files uploaded in this category</p>
                    </div>
                ) : (
                    <div className={styles.fileList}>
                        {filteredFiles.map(file => (
                            <div key={file.id} className={styles.fileItem}>
                                <div className={styles.fileInfo}>
                                    <FileText className={styles.fileIcon} />
                                    <div>
                                        <div className={styles.fileName}>{file.name}</div>
                                        <div className={styles.fileMeta}>
                                            <span className={styles.fileBadge}>{getCategoryLabel(file.category)}</span>
                                            <span>{file.size}</span>
                                            <span>{file.uploadedAt}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.fileActions}>
                                    <button className={styles.iconButton} title="Preview">
                                        <Eye size={16} />
                                    </button>
                                    <button className={styles.iconButton} title="Download">
                                        <Download size={16} />
                                    </button>
                                    <button className={`${styles.iconButton} ${styles.deleteButton}`} title="Delete">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
