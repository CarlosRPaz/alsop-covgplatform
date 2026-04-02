'use client';

import React, { useState, useCallback } from 'react';
import {
    FileText, GripVertical, Eye, EyeOff, ChevronDown, ChevronRight,
    Save, RotateCcw, ArrowLeft, Check
} from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

/* ── Default Report Template ── */
interface ReportSection {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    order: number;
}

const DEFAULT_SECTIONS: ReportSection[] = [
    {
        id: 'executive_summary',
        label: 'Executive Summary',
        description: 'Concise 2-4 sentence overview of the most important findings and overall risk posture.',
        enabled: true,
        order: 0,
    },
    {
        id: 'key_findings',
        label: 'Key Findings',
        description: 'Top 3-5 concerns sorted by priority, with headline + brief explanation + evidence.',
        enabled: true,
        order: 1,
    },
    {
        id: 'coverage_review',
        label: 'Coverage Review',
        description: 'Compact table of coverage lines with current limits, adequacy status, and short observation notes.',
        enabled: true,
        order: 2,
    },
    {
        id: 'next_steps',
        label: 'Next Steps',
        description: 'Merged recommendations, action items, and data gaps grouped by urgency: Review Now, At Renewal, Confirm & Update.',
        enabled: true,
        order: 3,
    },
    {
        id: 'sources',
        label: 'Sources & Credits',
        description: 'Footer listing real named data sources used in the analysis. Filtered to exclude internal labels.',
        enabled: true,
        order: 4,
    },
];

export default function ReportEditorPage() {
    const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const toggleEnabled = useCallback((id: string) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    }, []);

    const toggleExpand = useCallback((id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    }, []);

    const handleSave = useCallback(() => {
        // For now, save to localStorage. Future: save to DB.
        localStorage.setItem('report_template_config', JSON.stringify(sections));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }, [sections]);

    const handleReset = useCallback(() => {
        setSections(DEFAULT_SECTIONS);
    }, []);

    // Drag & Drop handlers
    const handleDragStart = (id: string) => {
        setDraggedId(id);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        setSections(prev => {
            const copy = [...prev];
            const fromIdx = copy.findIndex(s => s.id === draggedId);
            const toIdx = copy.findIndex(s => s.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;

            const [removed] = copy.splice(fromIdx, 1);
            copy.splice(toIdx, 0, removed);
            return copy.map((s, i) => ({ ...s, order: i }));
        });
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    const activeSections = sections.filter(s => s.enabled);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerBar}>
                <div>
                    <Link href="/settings" className={styles.backLink}>
                        <ArrowLeft size={14} />
                        Settings
                    </Link>
                    <h1 className={styles.pageTitle}>
                        <FileText size={22} className={styles.titleIcon} />
                        Report Template Editor
                    </h1>
                    <p className={styles.pageSubtitle}>
                        Control which sections appear in client-facing reports. Drag to reorder and toggle visibility.
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.resetBtn} onClick={handleReset}>
                        <RotateCcw size={14} />
                        Reset
                    </button>
                    <button className={styles.saveBtn} onClick={handleSave}>
                        {saved ? <Check size={14} /> : <Save size={14} />}
                        {saved ? 'Saved!' : 'Save Template'}
                    </button>
                </div>
            </div>

            {/* Summary Strip */}
            <div className={styles.summaryStrip}>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryCount}>{activeSections.length}</span>
                    <span className={styles.summaryLabel}>Active</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryCount}>{sections.length - activeSections.length}</span>
                    <span className={styles.summaryLabel}>Hidden</span>
                </div>
            </div>

            {/* Note about agent-only data */}
            <div className={styles.agentNote}>
                <strong>Note:</strong> Agent-only insights (property observations, data gaps, AI notes) are shown automatically in the <em>Agent Action Items</em> panel on the policy page. They are never included in client reports.
            </div>

            {/* Main Content */}
            <div className={styles.editorLayout}>
                {/* ── Section List ── */}
                <div className={styles.sectionList}>
                    <h2 className={styles.listTitle}>Client Report Sections</h2>
                    <p className={styles.listSubtitle}>Drag to reorder · Toggle sections on/off</p>

                    <div className={styles.cards}>
                        {sections.map(section => {
                            const isExpanded = expandedId === section.id;
                            const isDragging = draggedId === section.id;

                            return (
                                <div
                                    key={section.id}
                                    className={`${styles.sectionCard} ${!section.enabled ? styles.cardDisabled : ''} ${isDragging ? styles.cardDragging : ''}`}
                                    draggable
                                    onDragStart={() => handleDragStart(section.id)}
                                    onDragOver={(e) => handleDragOver(e, section.id)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className={styles.cardTop}>
                                        <div className={styles.dragHandle}>
                                            <GripVertical size={14} />
                                        </div>

                                        <div className={styles.cardInfo} onClick={() => toggleExpand(section.id)}>
                                            <span className={styles.cardLabel}>{section.label}</span>
                                            {isExpanded ?
                                                <ChevronDown size={14} className={styles.chevron} /> :
                                                <ChevronRight size={14} className={styles.chevron} />
                                            }
                                        </div>

                                        <div className={styles.cardActions}>
                                            {/* Enabled Toggle */}
                                            <button
                                                className={`${styles.toggleBtn} ${section.enabled ? styles.toggleOn : styles.toggleOff}`}
                                                onClick={() => toggleEnabled(section.id)}
                                                title={section.enabled ? 'Disable section' : 'Enable section'}
                                            >
                                                {section.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className={styles.cardExpanded}>
                                            <p className={styles.cardDescription}>{section.description}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Preview Panel ── */}
                <div className={styles.previewPanel}>
                    <h2 className={styles.previewTitle}>Template Preview</h2>
                    <div className={styles.previewDoc}>
                        {/* Client Report Preview */}
                        <div className={styles.previewHeader}>
                            <div className={styles.previewBrand}>CCN</div>
                            <span className={styles.previewBrandName}>Coverage Analysis Report</span>
                        </div>

                        {activeSections.length === 0 ? (
                            <div className={styles.previewEmpty}>No sections enabled.</div>
                        ) : (
                            activeSections.map((s) => (
                                <div key={s.id} className={styles.previewSection}>
                                    <div className={styles.previewSectionLabel}>{s.label}</div>
                                    <div className={styles.previewSectionBar} />
                                    <div className={styles.previewSkeleton}>
                                        <div className={styles.skelLine} style={{ width: '90%' }} />
                                        <div className={styles.skelLine} style={{ width: '70%' }} />
                                        <div className={styles.skelLine} style={{ width: '50%' }} />
                                    </div>
                                </div>
                            ))
                        )}

                        <div className={styles.previewFooter}>CoverageCheckNow</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
