'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    fetchFlaggedPoliciesGrouped,
    FlaggedPolicyGroup,
} from '@/lib/api';
import { Button } from '@/components/ui/Button/Button';
import {
    Flag,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Info,
    Search,
    Clock,
    Shield,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    RefreshCw,
    Building2,
    User,
    Calendar,
    Filter,
    X,
} from 'lucide-react';
import styles from './page.module.css';

// ─── Constants ───

const SEVERITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    warning: '#eab308',
    info: '#3b82f6',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
    critical: <AlertCircle size={13} />,
    high: <AlertTriangle size={13} />,
    warning: <AlertTriangle size={13} />,
    info: <Info size={13} />,
};

const RENEWAL_FILTERS = [
    { key: '7', label: '7 days' },
    { key: '14', label: '14 days' },
    { key: '21', label: '21 days' },
    { key: '30', label: '30 days' },
];

// ─── Helpers ───

function formatDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function daysUntil(d?: string | null): number | null {
    if (!d) return null;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
}

function expirationClass(d?: string | null): string {
    const days = daysUntil(d);
    if (days === null) return '';
    if (days < 0) return styles.expired;
    if (days <= 14) return styles.expiringSoon;
    if (days <= 30) return styles.expiringModerate;
    return '';
}

// ─── Component ───

export default function FlagsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [groups, setGroups] = useState<FlaggedPolicyGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Filters — initialized from URL query params
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
    const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
    const [officeFilter, setOfficeFilter] = useState(searchParams.get('office') || '');
    const [renewalDays, setRenewalDays] = useState(searchParams.get('renewal_window') || '');
    const [codeFilter, setCodeFilter] = useState(searchParams.get('code') || '');
    const [expirationFrom, setExpirationFrom] = useState(searchParams.get('expiration_from') || '');
    const [expirationTo, setExpirationTo] = useState(searchParams.get('expiration_to') || '');

    const loadData = useCallback(async () => {
        setLoading(true);
        const data = await fetchFlaggedPoliciesGrouped();
        setGroups(data);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Extract available offices + categories for filter dropdowns
    const { offices, categories } = useMemo(() => {
        const officeSet = new Set<string>();
        const catSet = new Set<string>();
        for (const g of groups) {
            if (g.office) officeSet.add(g.office);
            for (const f of g.flags) {
                if (f.category) catSet.add(f.category);
            }
        }
        return {
            offices: Array.from(officeSet).sort(),
            categories: Array.from(catSet).sort(),
        };
    }, [groups]);

    // Filtered groups
    const filtered = useMemo(() => {
        return groups.filter(g => {
            // Search
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                const matches =
                    g.policy_number.toLowerCase().includes(q) ||
                    g.named_insured.toLowerCase().includes(q) ||
                    (g.carrier_name || '').toLowerCase().includes(q);
                if (!matches) return false;
            }

            // Severity
            if (severityFilter && g.max_severity !== severityFilter) {
                // Also check if any flag in the group matches the severity
                const hasMatchingSeverity = g.flags.some(f => f.severity === severityFilter);
                if (!hasMatchingSeverity) return false;
            }

            // Category
            if (categoryFilter) {
                const hasMatchingCat = g.flags.some(f => f.category === categoryFilter);
                if (!hasMatchingCat) return false;
            }

            // Office
            if (officeFilter && g.office !== officeFilter) return false;

            // Flag code (e.g. ?code=NO_DIC)
            if (codeFilter) {
                const hasMatchingCode = g.flags.some(f => f.code === codeFilter);
                if (!hasMatchingCode) return false;
            }

            // Renewal date window
            if (renewalDays) {
                const days = daysUntil(g.expiration_date);
                if (days === null || days < 0) return false;
                if (days > parseInt(renewalDays)) return false;
            }

            // Exact expiration date range (from chart bar clicks)
            if (expirationFrom || expirationTo) {
                if (!g.expiration_date) return false;
                const expMs = new Date(g.expiration_date).getTime();
                if (expirationFrom && expMs < new Date(expirationFrom).getTime()) return false;
                if (expirationTo && expMs >= new Date(expirationTo).getTime()) return false;
            }

            return true;
        });
    }, [groups, searchTerm, severityFilter, categoryFilter, officeFilter, codeFilter, renewalDays, expirationFrom, expirationTo]);

    // Global totals (always from unfiltered for the summary bar)
    const totalFlags = groups.reduce((sum, g) => sum + g.total_flags, 0);
    const totalCritical = groups.reduce((sum, g) => sum + g.critical_count, 0);
    const totalHigh = groups.reduce((sum, g) => sum + g.high_count, 0);
    const totalWarning = groups.reduce((sum, g) => sum + g.warning_count, 0);
    const totalInfo = groups.reduce((sum, g) => sum + g.info_count, 0);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const hasActiveFilters = searchTerm || severityFilter || categoryFilter || officeFilter || codeFilter || renewalDays || expirationFrom || expirationTo;
    const clearFilters = () => {
        setSearchTerm('');
        setSeverityFilter('');
        setCodeFilter('');
        setCategoryFilter('');
        setOfficeFilter('');
        setRenewalDays('');
        setExpirationFrom('');
        setExpirationTo('');
        // Also clear URL params
        router.replace('/flags');
    };

    return (
        <div className={styles.flagsPage}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <Flag size={22} />
                    <h1>Flagged Policies</h1>
                    <span className={styles.flagCount}>
                        {filtered.length} {filtered.length === 1 ? 'policy' : 'policies'} · {totalFlags} flags
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button variant="outline" size="sm" onClick={() => router.push('/flags/definitions')}>
                        <ExternalLink size={14} style={{ marginRight: '0.375rem' }} /> Definitions
                    </Button>
                    <Button variant="ghost" size="sm" onClick={loadData}>
                        <RefreshCw size={14} style={{ marginRight: '0.375rem' }} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Severity summary */}
            <div className={styles.severitySummary}>
                <button
                    className={`${styles.sevCard} ${severityFilter === 'critical' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.critical }}
                    onClick={() => setSeverityFilter(severityFilter === 'critical' ? '' : 'critical')}
                >
                    <AlertCircle size={16} color={SEVERITY_COLORS.critical} />
                    <span className={styles.sevValue}>{totalCritical}</span>
                    <span className={styles.sevLabel}>Critical</span>
                </button>
                <button
                    className={`${styles.sevCard} ${severityFilter === 'high' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.high }}
                    onClick={() => setSeverityFilter(severityFilter === 'high' ? '' : 'high')}
                >
                    <AlertTriangle size={16} color={SEVERITY_COLORS.high} />
                    <span className={styles.sevValue}>{totalHigh}</span>
                    <span className={styles.sevLabel}>High</span>
                </button>
                <button
                    className={`${styles.sevCard} ${severityFilter === 'warning' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: SEVERITY_COLORS.warning }}
                    onClick={() => setSeverityFilter(severityFilter === 'warning' ? '' : 'warning')}
                >
                    <AlertTriangle size={16} color={SEVERITY_COLORS.warning} />
                    <span className={styles.sevValue}>{totalWarning}</span>
                    <span className={styles.sevLabel}>Warning</span>
                </button>
                <button
                    className={`${styles.sevCard} ${severityFilter === 'info' ? styles.activeSevCard : ''}`}
                    style={{ borderLeftColor: '#3b82f6' }}
                    onClick={() => setSeverityFilter(severityFilter === 'info' ? '' : 'info')}
                >
                    <Info size={16} color="#3b82f6" />
                    <span className={styles.sevValue}>{totalInfo}</span>
                    <span className={styles.sevLabel}>Info</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.filterRow}>
                    <div className={styles.searchBox}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search by policy #, insured, carrier..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className={styles.filterSelect}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => (
                            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                    {offices.length > 1 && (
                        <select
                            className={styles.filterSelect}
                            value={officeFilter}
                            onChange={(e) => setOfficeFilter(e.target.value)}
                        >
                            <option value="">All Offices</option>
                            {offices.map(o => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </select>
                    )}
                </div>
                <div className={styles.renewalChips}>
                    <Calendar size={13} className={styles.chipIcon} />
                    <span className={styles.chipLabel}>Expiring in:</span>
                    {RENEWAL_FILTERS.map(rf => (
                        <button
                            key={rf.key}
                            className={`${styles.chip} ${renewalDays === rf.key ? styles.chipActive : ''}`}
                            onClick={() => setRenewalDays(renewalDays === rf.key ? '' : rf.key)}
                        >
                            {rf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
                <div className={styles.activeFilters}>
                    <Filter size={13} className={styles.activeFilterIcon} />
                    {searchTerm && (
                        <button className={styles.activeChip} onClick={() => setSearchTerm('')}>
                            Search: &ldquo;{searchTerm}&rdquo; <X size={11} />
                        </button>
                    )}
                    {severityFilter && (
                        <button className={styles.activeChip} onClick={() => setSeverityFilter('')}>
                            Severity: {severityFilter} <X size={11} />
                        </button>
                    )}
                    {categoryFilter && (
                        <button className={styles.activeChip} onClick={() => setCategoryFilter('')}>
                            Category: {categoryFilter.replace(/_/g, ' ')} <X size={11} />
                        </button>
                    )}
                    {officeFilter && (
                        <button className={styles.activeChip} onClick={() => setOfficeFilter('')}>
                            Office: {officeFilter} <X size={11} />
                        </button>
                    )}
                    {codeFilter && (
                        <button className={styles.activeChip} onClick={() => setCodeFilter('')}>
                            Flag: {codeFilter} <X size={11} />
                        </button>
                    )}
                    {renewalDays && (
                        <button className={styles.activeChip} onClick={() => setRenewalDays('')}>
                            Renewing in {renewalDays} days <X size={11} />
                        </button>
                    )}
                    {(expirationFrom || expirationTo) && (
                        <button className={styles.activeChip} onClick={() => { setExpirationFrom(''); setExpirationTo(''); }}>
                            Expiry: {expirationFrom ? formatDate(expirationFrom) : '...'} – {expirationTo ? formatDate(expirationTo) : '...'} <X size={11} />
                        </button>
                    )}
                    <button className={styles.clearAllBtn} onClick={clearFilters}>
                        Clear All <X size={12} />
                    </button>
                </div>
            )}

            {/* Policy list */}
            <div className={styles.policyList}>
                {loading ? (
                    <div className={styles.loadingState}>Loading flagged policies...</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle size={32} />
                        <h3>{hasActiveFilters ? 'No flagged policies match your filters' : 'You\'re all caught up!'}</h3>
                        <p>
                            {hasActiveFilters
                                ? 'Try adjusting your search or filter criteria.'
                                : 'No open flags found across your policies.'}
                        </p>
                        {hasActiveFilters && (
                            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    filtered.map(group => {
                        const isExpanded = expandedIds.has(group.policy_id);
                        const sevColor = SEVERITY_COLORS[group.max_severity] || '#64748b';
                        const preview = group.flags.slice(0, 3);
                        const daysLeft = daysUntil(group.expiration_date);

                        return (
                            <div key={group.policy_id} className={`${styles.policyRow} ${isExpanded ? styles.policyRowExpanded : ''}`}>
                                {/* Main row */}
                                <div className={styles.policyRowMain}>
                                    <div className={styles.policyRowLeft} style={{ borderLeftColor: sevColor }} />
                                    <button
                                        className={styles.expandBtn}
                                        onClick={() => toggleExpand(group.policy_id)}
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    <div
                                        className={styles.policyRowBody}
                                        onClick={() => router.push(`/policy/${group.policy_id}?tab=flags`)}
                                    >
                                        <div className={styles.policyMeta}>
                                            <span className={styles.policyNumber}>
                                                <Shield size={12} /> {group.policy_number}
                                            </span>
                                            <span className={styles.insuredName}>{group.named_insured}</span>
                                            {group.carrier_name && (
                                                <span className={styles.carrierName}>{group.carrier_name}</span>
                                            )}
                                            {group.office && (
                                                <span className={styles.officeBadge}>
                                                    <Building2 size={11} /> {group.office}
                                                </span>
                                            )}
                                            {group.sold_by && (
                                                <span className={styles.agentBadge}>
                                                    <User size={11} /> {group.sold_by}
                                                </span>
                                            )}
                                            <span className={`${styles.expDate} ${expirationClass(group.expiration_date)}`}>
                                                <Clock size={11} />
                                                {group.expiration_date
                                                    ? `Rnwl ${formatDate(group.expiration_date)}${daysLeft !== null ? ` (${daysLeft < 0 ? 'expired' : `${daysLeft}d`})` : ''}`
                                                    : 'No expiration'}
                                            </span>
                                        </div>
                                        <div className={styles.policyFlags}>
                                            <div className={styles.sevCounts}>
                                                <span className={styles.totalBadge}>{group.total_flags} {group.total_flags === 1 ? 'flag' : 'flags'}</span>
                                                {group.critical_count > 0 && (
                                                    <span className={styles.sevMini} style={{ color: SEVERITY_COLORS.critical }}>
                                                        {SEVERITY_ICONS.critical} {group.critical_count}
                                                    </span>
                                                )}
                                                {group.high_count > 0 && (
                                                    <span className={styles.sevMini} style={{ color: SEVERITY_COLORS.high }}>
                                                        {SEVERITY_ICONS.high} {group.high_count}
                                                    </span>
                                                )}
                                                {group.warning_count > 0 && (
                                                    <span className={styles.sevMini} style={{ color: SEVERITY_COLORS.warning }}>
                                                        {SEVERITY_ICONS.warning} {group.warning_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.flagPreview}>
                                                {preview.map((f, i) => (
                                                    <span
                                                        key={f.id}
                                                        className={styles.previewChip}
                                                        style={{ borderLeftColor: SEVERITY_COLORS[f.severity] || '#64748b' }}
                                                    >
                                                        {f.title}
                                                    </span>
                                                ))}
                                                {group.flags.length > 3 && (
                                                    <span className={styles.moreChip}>+{group.flags.length - 3} more</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className={styles.expandedPanel}>
                                        <div className={styles.expandedHeader}>
                                            <span>All open flags for {group.policy_number}</span>
                                            <button
                                                className={styles.openPolicyBtn}
                                                onClick={() => router.push(`/policy/${group.policy_id}?tab=flags`)}
                                            >
                                                Open Policy <ExternalLink size={12} />
                                            </button>
                                        </div>
                                        <div className={styles.expandedFlags}>
                                            {group.flags.map(f => (
                                                <div key={f.id} className={styles.expandedFlagRow}>
                                                    <span
                                                        className={styles.flagSevBadge}
                                                        style={{ backgroundColor: `${SEVERITY_COLORS[f.severity]}18`, color: SEVERITY_COLORS[f.severity] }}
                                                    >
                                                        {SEVERITY_ICONS[f.severity]} {f.severity}
                                                    </span>
                                                    <span className={styles.flagTitle}>{f.title}</span>
                                                    {f.category && (
                                                        <span className={styles.flagCat}>{f.category.replace(/_/g, ' ')}</span>
                                                    )}
                                                    {f.message && (
                                                        <span className={styles.flagMsg}>{f.message}</span>
                                                    )}
                                                    {f.client_id && !f.policy_term_id && !f.policy_id && (
                                                        <span className={styles.clientFlagTag}>Client Flag</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
