'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Clock, Flag, ShieldAlert, Home, ZapOff, CalendarClock, ArrowRight } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import styles from './AgentDashboardStats.module.css';

export function AgentDashboardStats() {
    const router = useRouter();
    const { stats, loading, refreshing } = useDashboardStats();

    const actionableCards = stats ? [
        {
            title: "Policies w/ High Priority Flags",
            value: stats.highPolicies,
            sublabel: stats.highPolicies > 0 ? `${stats.totalHighFlags.toLocaleString()} total flags to resolve` : "All clear",
            color: "#ef4444",
            bg: "rgba(239, 68, 68, 0.1)",
            icon: Flag,
            action: "/flags?priority=high"
        },
        {
            title: "Missing DIC",
            value: stats.missingDic,
            sublabel: "Active policies w/o DIC",
            color: "#8b5cf6",
            bg: "rgba(139, 92, 246, 0.1)",
            icon: ShieldAlert,
            action: "/flags?code=NO_DIC"
        },
        {
            title: "Other Structures Coverage Missing",
            value: stats.otherStructures,
            sublabel: "AI detected structures, $0 coverage",
            color: "#f97316",
            bg: "rgba(249, 115, 22, 0.1)",
            icon: Home,
            action: "/flags?code=OTHER_STRUCTURES_ZERO"
        },
        {
            title: "Not Enriched",
            value: stats.unenriched,
            sublabel: "Missing property insights",
            color: "#3b82f6",
            bg: "rgba(59, 130, 246, 0.1)",
            icon: ZapOff,
            action: "/dashboard?enrichment=not_enriched"
        },
        {
            title: "Expiring Soon",
            value: stats.renewals14Days,
            sublabel: "Renewing within 14 days",
            color: "#06b6d4",
            bg: "rgba(6, 182, 212, 0.1)",
            icon: CalendarClock,
            action: "/dashboard?renewal_window=14"
        }
    ] : [];

    if (loading && !stats) {
        return (
            <div className={styles.container}>
                <div className={styles.topRow}>
                    <div className={styles.summaryCard} style={{ opacity: 0.6 }}>
                        <div className={styles.summaryTitle}>Total Active Policies</div>
                        <div className={`${styles.loadingSkeleton} ${styles.skeletonValue}`}></div>
                    </div>
                    <div className={styles.summaryCard} style={{ opacity: 0.6 }}>
                        <div className={styles.summaryTitle}>Pending Review</div>
                        <div className={`${styles.loadingSkeleton} ${styles.skeletonValue}`}></div>
                    </div>
                </div>
                <div className={styles.actionGrid}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={styles.actionCard} style={{ opacity: 0.5, pointerEvents: 'none' }}>
                            <div className={styles.cardHeader}>
                                <div className={styles.iconBox} style={{ background: 'var(--bg-core)' }} />
                                <div className={`${styles.loadingSkeleton} ${styles.skeletonTitle}`}></div>
                            </div>
                            <div className={`${styles.loadingSkeleton} ${styles.skeletonValue}`}></div>
                            <div className={`${styles.loadingSkeleton} ${styles.skeletonSubtext}`}></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className={styles.container}>
            {/* Informational Top Row */}
            <div className={styles.topRow}>
                <div className={`${styles.summaryCard} ${styles.summaryTotal}`}>
                    <div className={styles.summaryTitle}>
                        <FileText size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }}/>
                        Total Active Policies
                    </div>
                    <div className={styles.summaryValue}>{stats.totalPolicies.toLocaleString()}</div>
                </div>
                <div className={`${styles.summaryCard} ${styles.summaryPending}`}>
                    <div className={styles.summaryTitle}>
                        <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }}/>
                        Policies Pending Review
                    </div>
                    <div className={styles.summaryValue}>{stats.pendingReview.toLocaleString()}</div>
                </div>
            </div>

            {/* Actionable Workflow Grid */}
            <div className={styles.actionGrid}>
                {actionableCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={idx}
                            className={`${styles.actionCard} ${refreshing ? styles.refreshing : ''}`}
                            style={{ '--card-color': card.color, '--icon-bg': card.bg } as React.CSSProperties}
                            onClick={() => router.push(card.action)}
                        >
                            <div className={styles.cardHeader}>
                                <div className={styles.iconBox}>
                                    <Icon size={18} />
                                </div>
                                <div className={styles.cardTitle}>{card.title}</div>
                            </div>
                            <div className={styles.cardValue}>{card.value.toLocaleString()}</div>
                            <div className={styles.cardSubtext} style={{ color: card.value > 0 ? card.color : 'var(--text-secondary)' }}>
                                {card.sublabel}
                                {card.value > 0 && <ArrowRight size={12} className={styles.cardActionIcon} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
