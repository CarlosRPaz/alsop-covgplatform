'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AgentDashboardStats } from '@/components/dashboard/AgentDashboardStats';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { LineChartKPI } from '@/components/dashboard/LineChartKPI';
import { ActivityTab } from '@/components/dashboard/ActivityTab';
import { CSVUploadModal } from '@/components/dashboard/CSVUploadModal';
import { BatchEnrichModal } from '@/components/dashboard/BatchEnrichModal';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Plus, Upload, Zap, BarChart2, ChevronDown } from 'lucide-react';
import { useSidebar } from '@/components/layout/SidebarContext';

const tabs = [
    { id: 'activity', label: 'ACTIVITY' },
];

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
    const [isEnrichModalOpen, setIsEnrichModalOpen] = useState(false);
    const [selectedTablePolicyIds, setSelectedTablePolicyIds] = useState<string[]>([]);
    const tableSectionRef = useRef<HTMLDivElement>(null);
    const { isMobile } = useSidebar();
    const [analyticsOpen, setAnalyticsOpen] = useState(false);

    // Read URL params for drill-down filtering
    const expirationFrom = searchParams.get('expiration_from') || '';
    const expirationTo = searchParams.get('expiration_to') || '';
    const statusFilter = searchParams.get('status') || '';
    const renewalWindow = searchParams.get('renewal_window') || '';
    const searchInit = searchParams.get('search') || '';

    const enrichmentFilter = searchParams.get('enrichment') || '';

    // Compute expiration filter from URL params
    const expirationFilter = useMemo(() => {
        if (renewalWindow) {
            const today = new Date();
            const future = new Date(today);
            future.setDate(future.getDate() + parseInt(renewalWindow));
            return {
                from: today.toISOString().split('T')[0],
                to: future.toISOString().split('T')[0],
            };
        }
        if (expirationFrom || expirationTo) {
            return { from: expirationFrom || undefined, to: expirationTo || undefined };
        }
        return undefined;
    }, [expirationFrom, expirationTo, renewalWindow]);

    const hasDrillDownFilters = !!(expirationFrom || expirationTo || statusFilter || renewalWindow || searchInit || enrichmentFilter);

    const [activeTab, setActiveTab] = useState('activity');

    // Build a human-readable filter label
    const filterLabel = useMemo(() => {
        if (renewalWindow) return `Renewing in ${renewalWindow} days`;
        if (expirationFrom && expirationTo) {
            const from = new Date(expirationFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const to = new Date(expirationTo);
            to.setDate(to.getDate() - 1);
            const toStr = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return from === toStr ? `Expiring on ${from}` : `Expiring ${from} – ${toStr}`;
        }
        if (statusFilter === 'pending_review') return 'Pending review';
        if (statusFilter) return `Status: ${statusFilter}`;
        if (enrichmentFilter === 'not_enriched') return 'Not enriched';
        return '';
    }, [expirationFrom, expirationTo, statusFilter, renewalWindow, enrichmentFilter]);

    // Smooth scroll to table when drill-downs fire (not needed anymore since table is at top)
    useEffect(() => {
        if (hasDrillDownFilters && tableSectionRef.current) {
            const timer = setTimeout(() => {
                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [hasDrillDownFilters]);

    return (
        <main>
            <div style={{ padding: isMobile ? '0.5rem 0' : '1.5rem 1.5rem 2rem' }}>

                {/* ── Page header ── */}
                <header style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                }}>
                    <div>
                        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.2rem' }}>
                            Agent Dashboard
                        </h1>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Overview of all policies and their status
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                        <Link href="/submit">
                            <Button size="sm" variant="primary">
                                <Plus style={{ width: 13, height: 13, marginRight: 5 }} />
                                New Declaration
                            </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => setIsCSVModalOpen(true)}>
                            <Upload style={{ width: 13, height: 13, marginRight: 5 }} />
                            Upload CSV
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsEnrichModalOpen(true)} style={{ color: 'var(--text-muted)' }}>
                            <Zap style={{ width: 13, height: 13, marginRight: 5 }} />
                            Enrich &amp; Analyze
                        </Button>
                    </div>
                </header>

                {/* ── Compact KPI strip ── */}
                <AgentDashboardStats />

                {/* ── Policy table — immediately at fold ── */}
                <div ref={tableSectionRef} style={{
                    marginTop: '1.5rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid var(--border-default)',
                    }}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-high)' }}>
                            All Active Policies
                            {filterLabel && (
                                <span style={{
                                    marginLeft: '0.625rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    color: 'var(--accent-primary)',
                                    background: 'var(--accent-primary-muted)',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                }}>
                                    {filterLabel}
                                </span>
                            )}
                        </h2>
                    </div>
                    <div style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
                        <DataTable
                            initialSearch={searchInit}
                            initialExpirationFilter={expirationFilter}
                            initialStatusFilter={statusFilter}
                            filterLabel={filterLabel}
                            onSelectionChange={setSelectedTablePolicyIds}
                        />
                    </div>
                </div>

                {/* ── Collapsible analytics section ── */}
                <div style={{ marginTop: '1.25rem' }}>
                    <button
                        onClick={() => setAnalyticsOpen(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            width: '100%', padding: '0.75rem 1rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: analyticsOpen ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                            color: 'var(--text-mid)', fontSize: '0.82rem', fontWeight: 600,
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        }}
                    >
                        <BarChart2 size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        Analytics &amp; Renewal Charts
                        <ChevronDown
                            size={15}
                            style={{
                                marginLeft: 'auto', color: 'var(--text-muted)',
                                transform: analyticsOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                            }}
                        />
                    </button>
                    {analyticsOpen && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                            gap: '1.25rem',
                            padding: '1.25rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderTop: 'none',
                            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                        }}>
                            <div style={{
                                background: 'var(--bg-surface-raised)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-default)',
                                padding: '1.25rem',
                                overflow: 'hidden',
                            }}>
                                <DashboardChart />
                            </div>
                            <LineChartKPI />
                        </div>
                    )}
                </div>

                {/* ── Activity tab (secondary) ── */}
                <div style={{ marginTop: '1.25rem' }}>
                    <Tabs tabs={tabs} defaultTab="activity" onChange={setActiveTab} />
                    {activeTab === 'activity' && <ActivityTab />}
                </div>

            </div>

            <CSVUploadModal isOpen={isCSVModalOpen} onClose={() => setIsCSVModalOpen(false)} />
            <BatchEnrichModal
                isOpen={isEnrichModalOpen}
                onClose={() => setIsEnrichModalOpen(false)}
                selectedPolicyIds={selectedTablePolicyIds}
            />
        </main>
    );
}
