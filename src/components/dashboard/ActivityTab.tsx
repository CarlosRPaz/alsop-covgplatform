'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Loader2, CheckCircle, CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Sparkles, Shield, Timer, Merge, ExternalLink } from 'lucide-react';
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

function getStatusConfig(status: string): { label: string; cssKey: string } {
    switch (status) {
        case 'parsed':
        case 'done':
            return { label: 'Complete', cssKey: 'done' };
        case 'duplicate':
            return { label: 'Duplicate Found', cssKey: 'queued' };
        case 'queued':
            return { label: 'Queued', cssKey: 'queued' };
        case 'processing':
            return { label: 'Processing', cssKey: 'processing' };
        case 'failed':
            return { label: 'Failed', cssKey: 'failed' };
        default:
            return { label: status.charAt(0).toUpperCase() + status.slice(1), cssKey: '' };
    }
}

function StatusIcon({ status, type, event_type }: { status: string; type?: string; event_type?: string }) {
    if (type === 'document') {
        const isUpload = (event_type || '').startsWith('doc.uploaded.');
        if (isUpload) return <FileText size={14} className={styles.statusIconDoc} />;
        if (event_type === 'document.processed') return <CheckCircle size={14} style={{ color: '#10b981' }} />;
        if (event_type === 'document.failed') return <XCircle size={14} style={{ color: '#ef4444' }} />;
        if (event_type === 'document.needs_review') return <AlertTriangle size={14} style={{ color: '#f59e0b' }} />;
        if (event_type === 'document.no_match') return <AlertTriangle size={14} style={{ color: '#f97316' }} />;
        return <FileText size={14} className={styles.statusIconDoc} />;
    }
    if (type === 'merge') {
        return <Merge size={14} className={styles.statusIconMerge} />;
    }
    switch (status) {
        case 'parsed':
        case 'done':
            return <CheckCircle2 size={14} className={styles.statusIconDone} />;
        case 'duplicate':
            return <Sparkles size={14} className={styles.statusIconProcessing} style={{ color: '#8b5cf6' }} />;
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

const DOC_TYPE_LABELS: Record<string, string> = {
    rce: 'RCE Report',
    dic_dec_page: 'DIC Declaration',
    invoice: 'Invoice',
    inspection: 'Inspection Report',
    endorsement: 'Endorsement',
    questionnaire: 'Questionnaire',
};

function getDocumentActionLabel(activity: ActivityFeedItem): string {
    const docLabel = DOC_TYPE_LABELS[activity.doc_type || ''] || activity.doc_type?.toUpperCase() || 'Document';
    const isUpload = (activity.event_type || '').startsWith('doc.uploaded.');
    if (isUpload) return `${docLabel} Uploaded`;
    if (activity.event_type === 'document.processed') return `${docLabel} Processed`;
    if (activity.event_type === 'document.needs_review') return `${docLabel} Needs Review`;
    if (activity.event_type === 'document.no_match') return `${docLabel} — No Match`;
    if (activity.event_type === 'document.failed') return `${docLabel} Failed`;
    return activity.title || 'Document Event';
}

const MAX_VISIBLE = 25;

export function ActivityTab() {
    const router = useRouter();
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const loadActivities = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await fetchActivityFeed(50);
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

    const visibleActivities = showAll ? activities : activities.slice(0, MAX_VISIBLE);
    const hasMore = activities.length > MAX_VISIBLE;

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
                <>
                    <div className={styles.timeline}>
                        {visibleActivities.map((activity, idx) => {
                            const sc = getStatusConfig(activity.status);
                            const isDone = activity.status === 'parsed' || activity.status === 'done';
                            const isFailed = activity.status === 'failed';

                            const isMerge = activity.type === 'merge';
                            const isDoc = activity.type === 'document';
                            const isDocUpload = isDoc && (activity.event_type || '').startsWith('doc.uploaded.');
                            const isDocProcessed = isDoc && activity.event_type === 'document.processed';
                            const isDocNeedsAction = isDoc && (activity.event_type === 'document.needs_review' || activity.event_type === 'document.no_match');
                            const isDocFailed = isDoc && activity.event_type === 'document.failed';
                            const rowClass = [
                                styles.row,
                                isMerge ? styles.rowMerge : '',
                                isDoc ? styles.rowDoc : '',
                            ].filter(Boolean).join(' ');

                            return (
                                <div key={`${activity.id}-${idx}`} className={rowClass}>
                                    {/* Status icon */}
                                    <div className={styles.statusCol}>
                                        <StatusIcon status={activity.status} type={activity.type} event_type={activity.event_type} />
                                    </div>

                                    {/* Main info */}
                                    <div className={styles.mainCol}>
                                        {/* Status badge — only for non-complete states */}
                                        {!isDone && (
                                            <>
                                                <span className={`${styles.statusLabel} ${styles[sc.cssKey] || ''}`}>
                                                    {sc.label}
                                                </span>
                                                <span className={styles.divider}>—</span>
                                            </>
                                        )}

                                        {/* Action description */}
                                        <span className={`${styles.actionText} ${isMerge ? styles.actionTextMerge : ''} ${isDoc ? styles.actionTextDoc : ''}`}>
                                            {isMerge ? 'Client Records Consolidated' : isDoc ? getDocumentActionLabel(activity) : 'Dec Page Uploaded'}
                                        </span>

                                        {/* Client link — always show when available (not all docs have policies) */}
                                        {activity.insured_name && (
                                            <>
                                                <span className={styles.divider}>·</span>
                                                <span
                                                    className={styles.clickableLink}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        activity.client_id && router.push(`/client/${activity.client_id}`);
                                                    }}
                                                >
                                                    {activity.insured_name}
                                                </span>
                                            </>
                                        )}
                                        {activity.policy_number && (
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

                                        {/* "View RCE Data" verification link for processed RCE documents */}
                                        {isDoc && activity.policy_id && (isDocProcessed || isDocUpload) && activity.doc_type === 'rce' && (
                                            <>
                                                <span className={styles.divider}>·</span>
                                                <span
                                                    className={styles.viewDataLink}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/policy/${activity.policy_id}?tab=rce`);
                                                    }}
                                                >
                                                    <ExternalLink size={10} />
                                                    View RCE Data
                                                </span>
                                            </>
                                        )}

                                        {/* Detail text for merge events */}
                                        {isMerge && activity.detail && (
                                            <div className={styles.detailText}>{activity.detail}</div>
                                        )}

                                        {/* Detail text for document events */}
                                        {isDoc && activity.detail && (
                                            <div className={styles.detailText}>{activity.detail}</div>
                                        )}

                                        {/* File name hint for document uploads */}
                                        {isDoc && activity.file_name && (
                                            <div className={styles.detailText} style={{ opacity: 0.7 }}>
                                                {activity.file_name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Supporting context for completed items */}
                                    <div className={styles.uploaderCol}>
                                        <span>{activity.uploaded_by}</span>
                                        {activity.type === 'upload' && isDone && (
                                            <span className={styles.successHints}>
                                                {activity.is_enriched ? (
                                                    <><Sparkles size={10} /><span>Enriched</span></>
                                                ) : (
                                                    (new Date().getTime() - new Date(activity.created_at).getTime() > 120_000) ? (
                                                        <><Sparkles size={10} style={{ opacity: 0.4 }} /><span style={{ opacity: 0.6 }}>Unenriched</span></>
                                                    ) : (
                                                        <><Loader2 size={10} className={styles.spinSlow} /><span style={{ opacity: 0.6 }}>Enriching…</span></>
                                                    )
                                                )}
                                                {activity.flags_checked ? (
                                                    <><Shield size={10} /><span>Flags checked</span></>
                                                ) : (
                                                    <><Shield size={10} style={{ opacity: 0.4 }} /><span style={{ opacity: 0.6 }}>Pending</span></>
                                                )}
                                                {activity.processing_time_seconds != null && (
                                                    <>
                                                        <Timer size={10} />
                                                        <span>{activity.processing_time_seconds}s</span>
                                                    </>
                                                )}
                                            </span>
                                        )}
                                        {isDoc && isDocProcessed && (
                                            <span className={styles.successHints}>
                                                <><CheckCircle size={10} style={{ color: '#10b981' }} /><span>Matched</span></>
                                                {activity.match_confidence != null && activity.match_confidence > 0 && (
                                                    <span style={{ opacity: 0.7 }}>{Math.round(activity.match_confidence * 100)}%</span>
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* Error details if failed */}
                                    {isFailed && activity.error_message && (
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

                    {/* Show more / less */}
                    {hasMore && (
                        <div className={styles.showMoreRow}>
                            <button
                                className={styles.showMoreBtn}
                                onClick={() => setShowAll(!showAll)}
                            >
                                {showAll
                                    ? `Show fewer (${MAX_VISIBLE})`
                                    : `Show all ${activities.length} events`
                                }
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
