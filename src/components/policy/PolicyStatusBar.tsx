'use client';

import React from 'react';
import {
    Satellite, Shield, CheckCircle2, XCircle,
    Loader2, AlertTriangle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import styles from './PolicyStatusBar.module.css';

interface PolicyStatusBarProps {
    /** Whether enrichment data exists for this policy */
    isEnriched: boolean;
    /** Number of enrichment data points */
    enrichmentCount: number;
    /** Last enrichment date */
    lastEnrichedDate?: string | null;
    /** Whether flags have been checked (at least one flag exists — even if resolved) */
    flagsChecked: boolean;
    /** Number of open flags */
    openFlagCount: number;
    /** Highest flag severity */
    highestSeverity?: 'critical' | 'high' | 'warning' | 'info' | null;
    /** Last flag check date */
    lastCheckedDate?: string | null;
    /** Current enrichment step text (when enrichment is running) */
    enrichStep?: string | null;
    /** Callback to trigger enrichment */
    onEnrich: () => void;
    /** Callback to trigger flag check */
    onRunFlagCheck: () => void;
    /** Whether flag check is currently running */
    flagCheckRunning?: boolean;
}

export function PolicyStatusBar({
    isEnriched,
    enrichmentCount,
    lastEnrichedDate,
    flagsChecked,
    openFlagCount,
    highestSeverity,
    lastCheckedDate,
    enrichStep,
    onEnrich,
    onRunFlagCheck,
    flagCheckRunning = false,
}: PolicyStatusBarProps) {
    const enrichRunning = !!enrichStep && enrichStep !== '✓ Complete!' && enrichStep !== '✗ Failed — try again';
    const enrichDone = enrichStep === '✓ Complete!';
    const enrichFailed = enrichStep === '✗ Failed — try again';

    // Severity color
    const severityColor = highestSeverity === 'critical' ? '#ef4444'
        : highestSeverity === 'high' ? '#f97316'
            : highestSeverity === 'warning' ? '#eab308'
                : highestSeverity === 'info' ? '#3b82f6'
                    : '#64748b';

    return (
        <div className={styles.bar}>
            {/* ── Enrichment Status ── */}
            <div className={`${styles.segment} ${!isEnriched ? styles.segmentPending : ''}`}>
                <div className={`${styles.indicator} ${isEnriched ? styles.indicatorDone : styles.indicatorPending}`}>
                    {isEnriched ? (
                        <CheckCircle2 size={15} />
                    ) : (
                        <XCircle size={15} />
                    )}
                </div>
                <div className={styles.segmentInfo}>
                    <span className={styles.segmentLabel}>Property Enrichment</span>
                    <span className={styles.segmentValue}>
                        {isEnriched ? (
                            <>
                                <span className={styles.done}>{enrichmentCount} data points</span>
                                {lastEnrichedDate && (
                                    <span className={styles.subtle}> · {lastEnrichedDate}</span>
                                )}
                            </>
                        ) : (
                            <span className={styles.pending}>Not enriched — action required</span>
                        )}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={enrichRunning}
                    onClick={onEnrich}
                    className={isEnriched ? styles.actionBtn : styles.actionBtnUrgent}
                >
                    {enrichRunning ? (
                        <>
                            <Loader2 size={13} className={styles.spin} />
                            <span className={styles.actionLabel}>{enrichStep}</span>
                        </>
                    ) : enrichDone ? (
                        <>
                            <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                            <span className={styles.actionLabel} style={{ color: '#22c55e' }}>Complete!</span>
                        </>
                    ) : enrichFailed ? (
                        <>
                            <XCircle size={13} style={{ color: '#ef4444' }} />
                            <span className={styles.actionLabel} style={{ color: '#ef4444' }}>Failed — retry</span>
                        </>
                    ) : isEnriched ? (
                        <>
                            <Satellite size={13} />
                            <span className={styles.actionLabel}>Re-Enrich</span>
                        </>
                    ) : (
                        <>
                            <Satellite size={13} />
                            <span className={styles.actionLabel}>Enrich Now</span>
                        </>
                    )}
                </Button>
            </div>

            {/* ── Divider ── */}
            <div className={styles.divider} />

            {/* ── Flag Check Status ── */}
            <div className={`${styles.segment} ${!flagsChecked ? styles.segmentPending : ''}`}>
                <div className={`${styles.indicator} ${flagsChecked ? styles.indicatorDone : styles.indicatorPending}`}
                    style={flagsChecked && openFlagCount > 0 ? { background: `${severityColor}18`, color: severityColor, borderColor: `${severityColor}40`, animation: 'none' } : undefined}
                >
                    {flagsChecked ? (
                        openFlagCount > 0 ? (
                            <AlertTriangle size={15} />
                        ) : (
                            <Shield size={15} />
                        )
                    ) : (
                        <XCircle size={15} />
                    )}
                </div>
                <div className={styles.segmentInfo}>
                    <span className={styles.segmentLabel}>Flag Check</span>
                    <span className={styles.segmentValue}>
                        {flagsChecked ? (
                            openFlagCount > 0 ? (
                                <>
                                    <span style={{ color: severityColor, fontWeight: 600 }}>
                                        {openFlagCount} open flag{openFlagCount !== 1 ? 's' : ''}
                                    </span>
                                    {lastCheckedDate && (
                                        <span className={styles.subtle}> · {lastCheckedDate}</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className={styles.done}>All clear — no issues</span>
                                    {lastCheckedDate && (
                                        <span className={styles.subtle}> · {lastCheckedDate}</span>
                                    )}
                                </>
                            )
                        ) : (
                            <span className={styles.pending}>Not checked — action required</span>
                        )}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={flagCheckRunning}
                    onClick={onRunFlagCheck}
                    className={flagsChecked ? styles.actionBtn : styles.actionBtnUrgent}
                >
                    {flagCheckRunning ? (
                        <>
                            <Loader2 size={13} className={styles.spin} />
                            <span className={styles.actionLabel}>Checking…</span>
                        </>
                    ) : (
                        <>
                            <Zap size={13} />
                            <span className={styles.actionLabel}>{flagsChecked ? 'Re-Check Flags' : 'Check Now'}</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
