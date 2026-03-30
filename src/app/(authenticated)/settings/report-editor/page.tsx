'use client';

import React, { useState, useCallback } from 'react';
import {
    FileText, GripVertical, Eye, EyeOff, ChevronDown, ChevronRight,
    Save, RotateCcw, ArrowLeft, Loader2, Check
} from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

/* ── Default Report Template ── */
interface ReportSection {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    clientFacing: boolean;  // true = included in client PDF, false = agent-only
    order: number;
}

const DEFAULT_SECTIONS: ReportSection[] = [
    {
        id: 'executive_summary',
        label: 'Executive Summary',
        description: 'Concise 2-4 sentence overview of the most important findings and overall risk posture.',
        enabled: true,
        clientFacing: true,
        order: 0,
    },
    {
        id: 'key_findings',
        label: 'Key Findings',
        description: 'Top 3-5 concerns sorted by severity, with headline + brief explanation + evidence.',
        enabled: true,
        clientFacing: true,
        order: 1,
    },
    {
        id: 'coverage_review',
        label: 'Coverage Review',
        description: 'Compact table of coverage lines with current limits, adequacy status, and short observation notes.',
        enabled: true,
        clientFacing: true,
        order: 2,
    },
    {
        id: 'next_steps',
        label: 'Next Steps',
        description: 'Merged recommendations, action items, and data gaps grouped by urgency: Review Now, At Renewal, Confirm & Update.',
        enabled: true,
        clientFacing: true,
        order: 3,
    },
    {
        id: 'property_observations',
        label: 'Property Observations',
        description: 'Satellite/street-view observations with confidence levels. Discrepancies with policy data are highlighted.',
        enabled: true,
        clientFacing: false,
        order: 4,
    },
    {
        id: 'data_gaps',
        label: 'Data Gaps',
        description: 'Missing information that could affect coverage assessment, with suggested agent actions.',
        enabled: true,
        clientFacing: false,
        order: 5,
    },
    {
        id: 'internal_notes',
        label: 'Internal Agent Notes',
        description: 'AI-generated agent-only notes, raw enrichment conflicts, and technical observations. Never shown to clients.',
        enabled: true,
        clientFacing: false,
        order: 6,
    },
    {
        id: 'sources',
        label: 'Sources & Credits',
        description: 'Footer listing real named data sources used in the analysis. Filtered to exclude internal labels.',
        enabled: true,
        clientFacing: true,
        order: 7,
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

    const toggleClientFacing = useCallback((id: string) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, clientFacing: !s.clientFacing } : s));
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

    const clientSections = sections.filter(s => s.enabled && s.clientFacing);
    const internalSections = sections.filter(s => s.enabled && !s.clientFacing);

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
                        Control which sections appear in client-facing reports vs. internal-only views. Drag to reorder, toggle visibility, and set client/agent scope.
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
                    <span className={styles.summaryCount}>{sections.filter(s => s.enabled).length}</span>
                    <span className={styles.summaryLabel}>Active Sections</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryCount} style={{ color: '#6366f1' }}>{clientSections.length}</span>
                    <span className={styles.summaryLabel}>Client-Facing</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryCount} style={{ color: '#f59e0b' }}>{internalSections.length}</span>
                    <span className={styles.summaryLabel}>Internal Only</span>
                </div>
            </div>

            {/* Main Content */}
            <div className={styles.editorLayout}>
                {/* ── Section List ── */}
                <div className={styles.sectionList}>
                    <h2 className={styles.listTitle}>Report Sections</h2>
                    <p className={styles.listSubtitle}>Drag to reorder · Toggle sections on/off · Set scope</p>

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
                                            {/* Scope Tag */}
                                            <button
                                                className={`${styles.scopeTag} ${section.clientFacing ? styles.scopeClient : styles.scopeInternal}`}
                                                onClick={() => toggleClientFacing(section.id)}
                                                title={section.clientFacing ? 'Click to make internal-only' : 'Click to make client-facing'}
                                            >
                                                {section.clientFacing ? 'Client' : 'Internal'}
                                            </button>

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

                        {clientSections.length === 0 ? (
                            <div className={styles.previewEmpty}>No client-facing sections enabled.</div>
                        ) : (
                            clientSections.map((s, i) => (
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

                        {/* Internal sections preview */}
                        {internalSections.length > 0 && (
                            <>
                                <div className={styles.previewDivider}>
                                    <span>Agent-Only (Not in Client PDF)</span>
                                </div>
                                {internalSections.map((s, i) => (
                                    <div key={s.id} className={`${styles.previewSection} ${styles.previewInternal}`}>
                                        <div className={styles.previewSectionLabel}>{s.label}</div>
                                        <div className={styles.previewSkeleton}>
                                            <div className={styles.skelLine} style={{ width: '80%' }} />
                                            <div className={styles.skelLine} style={{ width: '55%' }} />
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        <div className={styles.previewFooter}>CoverageCheckNow</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
