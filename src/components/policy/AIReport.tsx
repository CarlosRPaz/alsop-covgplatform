'use client';

import React from 'react';
import { Card } from '../ui/Card/Card';
import { Eye, AlertTriangle, Database, FileText, ExternalLink, MessageSquare } from 'lucide-react';
import { PolicyReportRow, PropertyEnrichment } from '@/lib/api';
import styles from './AIReport.module.css';

interface AgentReviewPanelProps {
    /** Live report data from policy_reports table */
    reportRow?: PolicyReportRow | null;
    /** Enrichments for raw data display */
    enrichments?: PropertyEnrichment[];
    /** Link to the full client-facing report */
    reportLink?: string;
}

export function AgentReviewPanel({ reportRow, enrichments = [], reportLink }: AgentReviewPanelProps) {
    const ai = reportRow?.ai_insights;
    const propertyObs = ai?.property_observations || [];
    const dataGaps = ai?.data_gaps || [];
    const internalNotes = ai?.internal_notes || '';

    const hasContent = propertyObs.length > 0 || dataGaps.length > 0 || internalNotes || enrichments.length > 0;

    if (!hasContent && !reportRow) {
        return (
            <Card className={styles.container}>
                <div className={styles.header}>
                    <Eye className={styles.aiIcon} size={20} />
                    <h2>Internal Review</h2>
                </div>
                <div className={styles.emptyState}>
                    <p>No report data yet. Generate a report to populate the internal review with property observations, data gaps, and agent notes.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <Eye className={styles.aiIcon} size={20} />
                <h2>Internal Review</h2>
                {reportLink && (
                    <a href={reportLink} className={styles.reportLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} />
                        <span>Client Report</span>
                    </a>
                )}
            </div>

            <div className={styles.reviewGrid}>
                {/* Property Observations (from AI analysis — agent-only) */}
                {propertyObs.length > 0 && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader}>
                            <Eye size={15} />
                            <span>Property Observations</span>
                            <span className={styles.countBadge}>{propertyObs.length}</span>
                        </div>
                        <div className={styles.reviewList}>
                            {propertyObs.map((obs: any, idx: number) => (
                                <div key={idx} className={`${styles.reviewItem} ${obs.discrepancy ? styles.reviewItemWarn : ''}`}>
                                    <div className={styles.reviewItemText}>{obs.observation}</div>
                                    <div className={styles.reviewItemMeta}>
                                        <span className={styles.sourcePill}>{obs.source}</span>
                                        <span className={`${styles.confBadge} ${styles[`conf_${obs.confidence}`]}`}>
                                            {obs.confidence}
                                        </span>
                                    </div>
                                    {obs.discrepancy && (
                                        <div className={styles.discrepancyBanner}>
                                            <AlertTriangle size={12} />
                                            {obs.discrepancy}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Data Gaps — agent action items */}
                {dataGaps.length > 0 && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader}>
                            <AlertTriangle size={15} />
                            <span>Data Gaps</span>
                            <span className={styles.countBadge}>{dataGaps.length}</span>
                        </div>
                        <div className={styles.reviewList}>
                            {dataGaps.map((gap: any, idx: number) => (
                                <div key={idx} className={styles.reviewItem}>
                                    <div className={styles.reviewItemText}>
                                        <strong>{gap.field}:</strong> {gap.impact}
                                    </div>
                                    <div className={styles.reviewItemAction}>{gap.suggestion}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Internal Notes (agent-only AI content) */}
                {internalNotes && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader}>
                            <MessageSquare size={15} />
                            <span>Agent Notes</span>
                        </div>
                        <div className={styles.internalNotes}>{internalNotes}</div>
                    </div>
                )}

                {/* Raw Enrichment Data */}
                {enrichments.length > 0 && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader}>
                            <Database size={15} />
                            <span>Enrichment Data</span>
                            <span className={styles.countBadge}>{enrichments.length}</span>
                        </div>
                        <div className={styles.enrichTable}>
                            {enrichments
                                .filter(e => e.field_key !== 'property_image') // skip image row
                                .map((e, idx) => (
                                    <div key={idx} className={styles.enrichRow}>
                                        <span className={styles.enrichKey}>{e.field_key.replace(/_/g, ' ')}</span>
                                        <span className={styles.enrichValue}>{e.field_value}</span>
                                        <span className={styles.enrichSource}>{e.source_name}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
