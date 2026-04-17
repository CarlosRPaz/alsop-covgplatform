'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Loader2, CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { fetchActivityFeed, ActivityFeedItem } from '@/lib/api';
import styles from './ActivityTab.module.css';

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'done': return 'Parsed';
        case 'queued': return 'Queued';
        case 'processing': return 'Processing';
        case 'failed': return 'Failed';
        default: return status;
    }
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'done':
            return <CheckCircle2 size={14} className={styles.statusIconDone} />;
        case 'failed':
            return <XCircle size={14} className={styles.statusIconFailed} />;
        case 'processing':
            return <Loader2 size={14} className={`${styles.statusIconProcessing} ${styles.spinSlow}`} />;
        case 'queued':
            return <Clock size={14} className={styles.statusIconQueued} />;
        default:
            return <AlertTriangle size={14} className={styles.statusIconDefault} />;
    }
}

export function ActivityTab() {
    const router = useRouter();
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadActivities = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await fetchActivityFeed(30);
            setActivities(data);
        } catch (err) {
            console.error('Activity feed error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadActivities();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Recent Activity</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        className={styles.refreshButton}
                        onClick={() => loadActivities(true)}
                        disabled={refreshing}
                        title="Refresh activity feed"
                    >
                        <RefreshCw size={14} className={refreshing ? styles.spinSlow : ''} />
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <span className={styles.count}>{activities.length} events</span>
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingState}>
                    <Loader2 className={styles.spinner} />
                    <span>Loading activity...</span>
                </div>
            ) : activities.length === 0 ? (
                <div className={styles.emptyState}>
                    <Upload className={styles.emptyIcon} />
                    <p>No recent uploads. Submit a declaration to see activity here.</p>
                </div>
            ) : (
                <div className={styles.timeline}>
                    {activities.map((activity, idx) => {
                        const fileName = activity.file_path
                            ? activity.file_path.split('/').pop() || 'Document'
                            : 'Declaration';

                        return (
                            <div key={`${activity.id}-${idx}`} className={styles.row}>
                                {/* Status icon */}
                                <div className={styles.statusCol}>
                                    <StatusIcon status={activity.status} />
                                </div>

                                {/* Main info — single line on desktop, wraps on mobile */}
                                <div className={styles.mainCol}>
                                    <span className={`${styles.statusLabel} ${styles[activity.status] || ''}`}>
                                        {getStatusLabel(activity.status)}
                                    </span>
                                    <span className={styles.divider}>—</span>
                                    {activity.insured_name ? (
                                        <span
                                            className={styles.clickableLink}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                activity.client_id && router.push(`/client/${activity.client_id}`);
                                            }}
                                        >
                                            {activity.insured_name}
                                        </span>
                                    ) : activity.policy_number ? (
                                        <span
                                            className={styles.clickableLink}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                activity.policy_id && router.push(`/policy/${activity.policy_id}`);
                                            }}
                                        >
                                            {activity.policy_number}
                                        </span>
                                    ) : (
                                        <span className={styles.fileName}>{fileName}</span>
                                    )}
                                    {activity.insured_name && activity.policy_number && (
                                        <>
                                            <span className={styles.divider}>·</span>
                                            <span
                                                className={styles.clickableLink}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    activity.policy_id && router.push(`/policy/${activity.policy_id}`);
                                                }}
                                            >
                                                {activity.policy_number}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Uploader */}
                                <div className={styles.uploaderCol}>
                                    {activity.uploaded_by}
                                </div>

                                {/* Error details if failed */}
                                {activity.status === 'failed' && activity.error_message && (
                                    <div className={styles.errorCol}>
                                        <AlertTriangle size={12} />
                                        <span>{activity.error_message}</span>
                                    </div>
                                )}

                                {/* Timestamp */}
                                <div className={styles.timeCol}>
                                    {formatTimeAgo(activity.created_at)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
