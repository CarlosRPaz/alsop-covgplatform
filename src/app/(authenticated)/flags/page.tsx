'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    fetchAllOpenFlags,
    resolveFlag,
    dismissFlag,
    PolicyFlagRow,
} from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';
import {
    Flag,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Info,
    Filter,
    Search,
    XCircle,
    Clock,
    Shield,
    User,
    Zap,
    ArrowRight,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';
import styles from './page.module.css';

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
    critical: <AlertCircle size={14} />,
    high: <AlertTriangle size={14} />,
    warning: <AlertTriangle size={14} />,
    info: <Info size={14} />,
};

const SEVERITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    warning: '#eab308',
    info: '#3b82f6',
};

const QUICK_VIEWS = [
    { key: 'all', label: 'All Open', icon: Flag },
    { key: 'critical', label: 'Critical', icon: AlertCircle },
    { key: 'high', label: 'High', icon: AlertTriangle },
    { key: 'renewal', label: 'Renewal', icon: Clock },
    { key: 'data_quality', label: 'Missing Data', icon: Search },
    { key: 'coverage_gap', label: 'Coverage Gaps', icon: Shield },
    { key: 'dic', label: 'DIC Issues', icon: Shield },
    { key: 'manual', label: 'Manual', icon: User },
];

function formatDate(d?: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function FlagsPage() {
    const router = useRouter();
    const [flags, setFlags] = useState<PolicyFlagRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('open');
    const [searchTerm, setSearchTerm] = useState('');

    const loadFlags = useCallback(async () => {
        setLoading(true);
        let filters: Record<string, string> = {};

        if (statusFilter !== 'all') {
            filters.status = statusFilter;
        } else {
            filters.status = '';
        }

        const data = await fetchAllOpenFlags(filters);
        setFlags(data);
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        loadFlags();
    }, [loadFlags]);

    const handleResolve = async (flagId: string) => {
        setActionLoading(flagId);
        const ok = await resolveFlag(flagId);
        if (ok) await loadFlags();
        setActionLoading(null);
    };

    const handleDismiss = async (flagId: string) => {
        setActionLoading(flagId);
        const ok = await dismissFlag(flagId);
        if (ok) await loadFlags();
        setActionLoading(null);
    };

    const filteredByView = flags.filter(f => {
        if (activeView === 'all') return true;
        if (activeView === 'critical') return f.severity === 'critical';
        if (activeView === 'high') return f.severity === 'high';
        if (activeView === 'warning') return f.severity === 'warning';
        if (activeView === 'info') return f.severity === 'info';
        if (activeView === 'renewal') return f.category === 'renewal';
        if (activeView === 'data_quality') return f.category === 'data_quality';
        if (activeView === 'coverage_gap') return f.category === 'coverage_gap';
        if (activeView === 'dic') return f.category === 'dic';
        if (activeView === 'manual') return f.source === 'user';
        return true;
    });

    // Filter by search
    const filtered = searchTerm
        ? filteredByView.filter(f =>
            f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.message || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        : filteredByView;

    // Stats
    const criticalCount = flags.filter(f => f.severity === 'critical').length;
    const highCount = flags.filter(f => f.severity === 'high').length;
    const warningCount = flags.filter(f => f.severity === 'warning').length;

    return (
        <div className={styles.flagsPage}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <Flag size={22} />
                    <h1>Flag Work Queue</h1>
                    <span className={styles.flagCount}>{flags.length} flags</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadFlags}>
                    <RefreshCw size={14} /> Refresh
                </Button>
            </div>

            {/* Severity summary cards */}
            <div className={styles.severitySummary}>
                <div
                    className={`${styles.sevCard} ${activeView === 'critical' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.critical, cursor: 'pointer' }}
                    onClick={() => setActiveView('critical')}
                >
                    <AlertCircle size={16} color={SEVERITY_COLORS.critical} />
                    <span className={styles.sevValue}>{criticalCount}</span>
                    <span className={styles.sevLabel}>Critical</span>
                </div>
                <div
                    className={`${styles.sevCard} ${activeView === 'high' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.high, cursor: 'pointer' }}
                    onClick={() => setActiveView('high')}
                >
                    <AlertTriangle size={16} color={SEVERITY_COLORS.high} />
                    <span className={styles.sevValue}>{highCount}</span>
                    <span className={styles.sevLabel}>High</span>
                </div>
                <div
                    className={`${styles.sevCard} ${activeView === 'warning' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.warning, cursor: 'pointer' }}
                    onClick={() => setActiveView('warning')}
                >
                    <AlertTriangle size={16} color={SEVERITY_COLORS.warning} />
                    <span className={styles.sevValue}>{warningCount}</span>
                    <span className={styles.sevLabel}>Warning</span>
                </div>
                <div
                    className={`${styles.sevCard} ${activeView === 'info' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: '#3b82f6', cursor: 'pointer' }}
                    onClick={() => setActiveView('info')}
                >
                    <Info size={16} color="#3b82f6" />
                    <span className={styles.sevValue}>{flags.length - criticalCount - highCount - warningCount}</span>
                    <span className={styles.sevLabel}>Info</span>
                </div>
            </div>

            {/* Toolbar: Quick views + filters */}
            <div className={styles.toolbar}>
                <div className={styles.quickViews}>
                    {QUICK_VIEWS.map(qv => (
                        <button
                            key={qv.key}
                            className={`${styles.quickViewBtn} ${activeView === qv.key ? styles.quickViewActive : ''}`}
                            onClick={() => setActiveView(qv.key)}
                        >
                            <qv.icon size={13} />
                            {qv.label}
                        </button>
                    ))}
                </div>
                <div className={styles.filterRow}>
                    <div className={styles.searchBox}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search flags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="open">Open</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="all">All Statuses</option>
                    </select>
                </div>
            </div>

            {/* Flag list */}
            <div className={styles.flagList}>
                {loading ? (
                    <div className={styles.loadingState}>Loading flags...</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyQueue}>
                        <CheckCircle size={28} />
                        <p>No flags match your filters.</p>
                    </div>
                ) : (
                    filtered.map(flag => {
                        const sevColor = SEVERITY_COLORS[flag.severity] || '#64748b';
                        const isLoading = actionLoading === flag.id;

                        return (
                            <div key={flag.id} className={styles.queueCard}>
                                <div className={styles.queueCardLeft} style={{ borderLeftColor: sevColor }} />
                                <div className={styles.queueCardBody}>
                                    <div className={styles.queueHeader}>
                                        <span className={styles.queueSeverity} style={{ backgroundColor: `${sevColor}18`, color: sevColor }}>
                                            {SEVERITY_ICONS[flag.severity]}
                                            {flag.severity}
                                        </span>
                                        <span className={styles.queueCode}>{flag.code}</span>
                                        {flag.category && (
                                            <span className={styles.queueCategory}>{flag.category.replace(/_/g, ' ')}</span>
                                        )}
                                        {flag.policy_number && (
                                            <span className={styles.queuePolicyNum}>
                                                <Shield size={11} /> {flag.policy_number}
                                            </span>
                                        )}
                                        <span className={styles.queueSource}>
                                            {flag.source === 'user' ? <User size={11} /> : <Zap size={11} />}
                                            {flag.source}
                                        </span>
                                        {flag.status !== 'open' && (
                                            <span className={flag.status === 'resolved' ? styles.statusResolved : styles.statusDismissed}>
                                                {flag.status}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.queueTitle}>{flag.title}</div>
                                    {flag.message && <div className={styles.queueMessage}>{flag.message}</div>}
                                    <div className={styles.queueMeta}>
                                        <span><Clock size={11} /> {formatDate(flag.created_at)}</span>
                                        {(flag.times_seen || 0) > 1 && (
                                            <span className={styles.timesSeen}>Seen {flag.times_seen}×</span>
                                        )}
                                        {flag.policy_id && (
                                            <button
                                                className={styles.policyLink}
                                                onClick={() => router.push(`/policy/${flag.policy_id}?tab=flags`)}
                                            >
                                                <ArrowRight size={11} /> View Policy
                                            </button>
                                        )}
                                    </div>
                                    {flag.status === 'open' && (
                                        <div className={styles.queueActions}>
                                            <Button variant="ghost" size="sm" onClick={() => handleResolve(flag.id)} disabled={isLoading} className={styles.queueActionBtn}>
                                                <CheckCircle size={13} /> Resolve
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDismiss(flag.id)} disabled={isLoading} className={styles.queueActionBtn}>
                                                <XCircle size={13} /> Dismiss
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
