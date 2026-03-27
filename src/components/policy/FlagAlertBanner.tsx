'use client';

import React from 'react';
import { Flag, AlertCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { PolicyFlagRow } from '@/lib/api';
import styles from './FlagAlertBanner.module.css';

interface FlagAlertBannerProps {
    flags: PolicyFlagRow[];
    onViewFlags: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    warning: '#eab308',
    info: '#3b82f6',
};

const SEVERITY_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
};

export function FlagAlertBanner({ flags, onViewFlags }: FlagAlertBannerProps) {
    // Only show open flags
    const openFlags = flags.filter(
        f => (!f.status && !f.resolved_at) || f.status === 'open'
    );

    if (openFlags.length === 0) return null;

    // Severity counts
    const counts: Record<string, number> = {};
    openFlags.forEach(f => {
        counts[f.severity] = (counts[f.severity] || 0) + 1;
    });

    // Determine highest severity for accent color
    const hasCritical = (counts['critical'] || 0) > 0;
    const hasHigh = (counts['high'] || 0) > 0;
    const hasWarning = (counts['warning'] || 0) > 0;

    const highestSeverity = hasCritical
        ? 'critical'
        : hasHigh
            ? 'high'
            : hasWarning
                ? 'warning'
                : 'info';

    // Accent bar class
    const accentClass = {
        critical: styles.accentBarCritical,
        high: styles.accentBarHigh,
        warning: styles.accentBarWarning,
        info: styles.accentBarInfo,
    }[highestSeverity];

    // Banner severity class — drives entire theme
    const severityMap: Record<string, string> = {
        critical: styles.bannerCritical,
        high: styles.bannerHigh,
        warning: styles.bannerWarning,
        info: styles.bannerInfo,
    };

    const bannerClass = [styles.banner, severityMap[highestSeverity] || styles.bannerCritical]
        .filter(Boolean)
        .join(' ');

    // Severity chips to render
    const chipEntries = Object.entries(counts)
        .sort((a, b) => (SEVERITY_ORDER[a[0]] ?? 99) - (SEVERITY_ORDER[b[0]] ?? 99));

    const chipClass: Record<string, string> = {
        critical: styles.chipCritical,
        high: styles.chipHigh,
        warning: styles.chipWarning,
        info: styles.chipInfo,
    };

    const chipIcon: Record<string, React.ReactNode> = {
        critical: <AlertCircle size={11} />,
        high: <AlertTriangle size={11} />,
        warning: <AlertTriangle size={11} />,
        info: <Info size={11} />,
    };

    // Top flag previews — sorted by severity, show up to 3
    const sortedFlags = [...openFlags].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    );
    const previewFlags = sortedFlags.slice(0, 3);
    const remainingCount = openFlags.length - previewFlags.length;

    return (
        <div 
            className={bannerClass}
            onClick={onViewFlags}
            style={{ cursor: 'pointer' }}
            title="View all flags"
        >
            <div className={`${styles.accentBar} ${accentClass}`} />

            <div className={styles.body}>
                <div className={styles.bodyLeft}>
                    {/* Count Badge */}
                    <div className={styles.countBadge}>
                        <Flag size={18} className={styles.countIcon} />
                        <span className={styles.countNumber}>{openFlags.length}</span>
                    </div>

                    {/* Info Area */}
                    <div className={styles.infoArea}>
                        <div className={styles.infoTopRow}>
                            <span className={styles.infoTitle}>
                                {openFlags.length === 1 ? '1 Open Flag' : `${openFlags.length} Open Flags`}
                            </span>

                            {/* Severity chips */}
                            <div className={styles.severityChips}>
                                {chipEntries.map(([sev, count]) => (
                                    <span
                                        key={sev}
                                        className={`${styles.severityChip} ${chipClass[sev] || ''}`}
                                    >
                                        {chipIcon[sev]}
                                        {count} {sev}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Flag title previews */}
                        <div className={styles.flagPreviews}>
                            {previewFlags.map((f, i) => (
                                <React.Fragment key={f.id}>
                                    {i > 0 && <span className={styles.previewSeparator}>·</span>}
                                    <span className={styles.flagPreview}>
                                        <span
                                            className={styles.flagPreviewDot}
                                            style={{ background: SEVERITY_COLORS[f.severity] || '#64748b' }}
                                        />
                                        <span className={styles.flagPreviewText}>{f.title}</span>
                                    </span>
                                </React.Fragment>
                            ))}
                            {remainingCount > 0 && (
                                <span className={styles.flagPreviewMore}>
                                    +{remainingCount} more
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <button className={styles.ctaButton} onClick={onViewFlags}>
                    View All Flags
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
}
