'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Loader2 } from 'lucide-react';
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
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'done': return 'Processed';
        case 'queued': return 'Queued';
        case 'processing': return 'Processing';
        case 'failed': return 'Failed';
        default: return status;
    }
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'done': return '#10b981';     // Green
        case 'queued': return '#f59e0b';   // Amber
        case 'processing': return '#3b82f6'; // Blue
        case 'failed': return '#ef4444';   // Red
        default: return '#6b7280';
    }
}

export function ActivityTab() {
    const router = useRouter();
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivityFeed(30)
            .then(setActivities)
            .catch(err => console.error('Activity feed error:', err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Recent Activity</h2>
                <p className={styles.subtitle}>Declaration uploads and processing events</p>
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
                    {activities.map((activity) => {
                        const statusColor = getStatusColor(activity.status);
                        const fileName = activity.file_path
                            ? activity.file_path.split('/').pop() || 'Document'
                            : 'Declaration';

                        return (
                            <div key={activity.id} className={styles.activityItem}>
                                <div
                                    className={styles.iconWrapper}
                                    style={{ backgroundColor: `${statusColor}15` }}
                                >
                                    <FileText className={styles.icon} style={{ color: statusColor }} />
                                </div>
                                <div className={styles.content}>
                                    <div className={styles.activityTitle}>
                                        Declaration Uploaded
                                        <span
                                            className={styles.statusChip}
                                            style={{
                                                backgroundColor: `${statusColor}18`,
                                                color: statusColor,
                                            }}
                                        >
                                            {getStatusLabel(activity.status)}
                                        </span>
                                    </div>

                                    <div className={styles.description}>
                                        {activity.insured_name && (
                                            <span
                                                className={styles.clickableLink}
                                                onClick={() =>
                                                    activity.client_id &&
                                                    router.push(`/client/${activity.client_id}`)
                                                }
                                            >
                                                {activity.insured_name}
                                            </span>
                                        )}
                                        {activity.insured_name && activity.policy_number && (
                                            <span> · </span>
                                        )}
                                        {activity.policy_number && (
                                            <>
                                                {!activity.insured_name && ''}
                                                <span>Policy </span>
                                                <span
                                                    className={styles.clickableLink}
                                                    onClick={() =>
                                                        activity.policy_id &&
                                                        router.push(`/policy/${activity.policy_id}`)
                                                    }
                                                >
                                                    {activity.policy_number}
                                                </span>
                                            </>
                                        )}
                                        {!activity.insured_name && !activity.policy_number && (
                                            <span>{fileName}</span>
                                        )}
                                    </div>

                                    <div className={styles.meta}>
                                        <span className={styles.timestamp}>
                                            {formatTimeAgo(activity.created_at)}
                                        </span>
                                        <span className={styles.separator}>•</span>
                                        <span className={styles.user}>
                                            Uploaded by {activity.uploaded_by}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
