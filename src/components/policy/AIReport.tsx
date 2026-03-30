'use client';

import React from 'react';
import { Card } from '../ui/Card/Card';
import { Eye, AlertTriangle, MessageSquare, ExternalLink, Zap, CheckCircle2 } from 'lucide-react';
import { PolicyReportRow } from '@/lib/api';
import styles from './AIReport.module.css';

interface AgentReviewPanelProps {
    reportRow?: PolicyReportRow | null;
    reportLink?: string;
}

export function AgentReviewPanel({ reportRow, reportLink }: AgentReviewPanelProps) {
    const ai = reportRow?.ai_insights;

    // Merge recommendations + action_items + data_gaps into unified action list
    const actions: Array<{ text: string; type: string; urgency: string }> = [];

    // Recommendations → actions
    (ai?.recommendations || []).forEach((r: any) => {
        actions.push({
            text: r.text,
            type: r.category,
            urgency: r.priority === 1 ? 'now' : r.priority === 2 ? 'before_renewal' : 'future',
        });
    });

    // Action items → actions
    (ai?.action_items || []).forEach((a: any) => {
        // Skip duplicates (if rec text ≈ action item text)
        if (!actions.some(x => x.text.toLowerCase().includes(a.item.toLowerCase().slice(0, 20)))) {
            actions.push({ text: a.item, type: a.type, urgency: a.urgency === 'before_renewal' ? 'before_renewal' : a.urgency === 'at_renewal' ? 'before_renewal' : 'future' });
        }
    });

    // Data gaps → actions (framed as things to verify)
    (ai?.data_gaps || []).forEach((g: any) => {
        actions.push({ text: `${g.field}: ${g.suggestion}`, type: 'verify', urgency: 'before_renewal' });
    });

    // Sort: now → before_renewal → future
    const urgencyOrder: Record<string, number> = { now: 0, before_renewal: 1, future: 2 };
    actions.sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));

    // Property observations (agent-only)
    const propertyObs = (ai?.property_observations || []).filter((o: any) => o.discrepancy);
    const internalNotes = ai?.internal_notes || '';
    const hasContent = actions.length > 0 || propertyObs.length > 0 || internalNotes;

    if (!hasContent && !reportRow) {
        return (
            <Card className={styles.container}>
                <div className={styles.header}>
                    <Eye className={styles.aiIcon} size={20} />
                    <h2>Internal Review</h2>
                </div>
                <div className={styles.emptyState}>
                    <p>Generate a report to populate agent suggestions and review data.</p>
                </div>
            </Card>
        );
    }

    const urgencyLabel = (u: string) => u === 'now' ? 'Now' : u === 'before_renewal' ? 'Before Renewal' : 'When Convenient';
    const urgencyColor = (u: string) => u === 'now' ? '#ef4444' : u === 'before_renewal' ? '#f59e0b' : '#6366f1';
    const typeIcon = (t: string) => {
        switch (t) {
            case 'verify': return '🔍';
            case 'discuss': return '💬';
            case 'review': return '📋';
            case 'confirm': return '✓';
            case 'update': return '✏️';
            default: return '→';
        }
    };

    // Group actions by urgency
    const grouped = actions.reduce((acc, a) => {
        const key = a.urgency;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
    }, {} as Record<string, typeof actions>);

    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <Zap className={styles.aiIcon} size={18} />
                <h2>Agent Action Items</h2>
                {reportLink && (
                    <a href={reportLink} className={styles.reportLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} />
                        View Client Report
                    </a>
                )}
            </div>

            <div className={styles.reviewGrid}>
                {/* ── Grouped Actions ── */}
                {Object.entries(grouped).map(([urgency, items]) => (
                    <div key={urgency} className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader} style={{ color: urgencyColor(urgency) }}>
                            <span className={styles.urgencyDot} style={{ background: urgencyColor(urgency) }} />
                            {urgencyLabel(urgency)}
                            <span className={styles.countBadge}>{items.length}</span>
                        </div>
                        <div className={styles.actionList}>
                            {items.map((item, idx) => (
                                <div key={idx} className={styles.actionItem}>
                                    <span className={styles.actionIcon}>{typeIcon(item.type)}</span>
                                    <span className={styles.actionText}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* ── Discrepancies (only ones with conflicts) ── */}
                {propertyObs.length > 0 && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader} style={{ color: '#f59e0b' }}>
                            <AlertTriangle size={13} />
                            Data Conflicts
                            <span className={styles.countBadge}>{propertyObs.length}</span>
                        </div>
                        <div className={styles.actionList}>
                            {propertyObs.map((obs: any, idx: number) => (
                                <div key={idx} className={styles.conflictItem}>
                                    <div className={styles.conflictText}>{obs.observation}</div>
                                    <div className={styles.conflictDetail}>
                                        <AlertTriangle size={10} />
                                        {obs.discrepancy}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Internal Notes ── */}
                {internalNotes && (
                    <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionHeader}>
                            <MessageSquare size={13} />
                            AI Notes
                        </div>
                        <div className={styles.internalNotes}>{internalNotes}</div>
                    </div>
                )}
            </div>
        </Card>
    );
}
