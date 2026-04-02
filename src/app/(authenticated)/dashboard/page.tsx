'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AgentDashboardStats } from '@/components/dashboard/AgentDashboardStats';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { ActivityTab } from '@/components/dashboard/ActivityTab';
import { CSVUploadModal } from '@/components/dashboard/CSVUploadModal';
import { BatchEnrichModal } from '@/components/dashboard/BatchEnrichModal';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Plus, Upload, Zap } from 'lucide-react';
import { useSidebar } from '@/components/layout/SidebarContext';


const tabs = [
    { id: 'policy-table', label: 'POLICY TABLE' },
    { id: 'activity', label: 'ACTIVITY' },
];

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
    const [isEnrichModalOpen, setIsEnrichModalOpen] = useState(false);
    const [selectedTablePolicyIds, setSelectedTablePolicyIds] = useState<string[]>([]);
    const tableSectionRef = useRef<HTMLDivElement>(null);
    const { isMobile } = useSidebar();

    // Read URL params for drill-down filtering
    const expirationFrom = searchParams.get('expiration_from') || '';
    const expirationTo = searchParams.get('expiration_to') || '';
    const statusFilter = searchParams.get('status') || '';
    const renewalWindow = searchParams.get('renewal_window') || '';
    const searchInit = searchParams.get('search') || '';

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

    const hasDrillDownFilters = !!(expirationFrom || expirationTo || statusFilter || renewalWindow || searchInit);

    // If we have drill-down filters, default to policy-table tab
    const [activeTab, setActiveTab] = useState('policy-table');

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
        return '';
    }, [expirationFrom, expirationTo, statusFilter, renewalWindow]);

    // Auto-scroll to the table section when drill-down filters are active
    useEffect(() => {
        if (hasDrillDownFilters && tableSectionRef.current) {
            // Small delay to let the page render first
            const timer = setTimeout(() => {
                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [hasDrillDownFilters]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'policy-table':
                return (
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mt-4">
                            <h2 className="text-xl font-bold font-heading" style={{ color: 'var(--text-high)' }}>All Active Policies</h2>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
                                <Link href="/submit">
                                    <Button size="sm" variant="primary">
                                        <Plus className="w-3 h-3 mr-1.5" />
                                        New Declaration
                                    </Button>
                                </Link>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsCSVModalOpen(true)}
                                >
                                    <Upload className="w-3 h-3 mr-1.5" />
                                    Upload CSV
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEnrichModalOpen(true)}
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <Zap className="w-3 h-3 mr-1.5" />
                                    Enrich &amp; Analyze
                                </Button>
                            </div>
                        </div>
                        <DataTable
                            initialSearch={searchInit}
                            initialExpirationFilter={expirationFilter}
                            initialStatusFilter={statusFilter}
                            filterLabel={filterLabel}
                            onSelectionChange={setSelectedTablePolicyIds}
                        />
                    </section>
                );
            case 'activity':
                return <ActivityTab />;
            default:
                return null;
        }
    };

    return (
        <main>
            <div style={{ padding: isMobile ? '0.25rem 0' : '2rem 1.5rem' }}>
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ marginTop: isMobile ? '0.5rem' : '1.5rem', marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Agent Dashboard</h1>
                        <p className="text-sm text-slate-500">Overview of all policies and their status</p>
                    </div>
                </header>

                {/* ═══ Overview Section: Left (Cards + Rings) | Right (Charts) ═══ */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    alignItems: 'stretch',
                    gap: isMobile ? '0.75rem' : '1.25rem',
                    marginBottom: isMobile ? '0.75rem' : '1.5rem',
                }}>
                    {/* ── Left Column: Actionable Unified Dashboard Header ── */}
                    <AgentDashboardStats />

                    {/* ── Right Column: Stacked Charts ── */}
                    <div style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-default)',
                        padding: isMobile ? '0.75rem' : '1.25rem',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <DashboardChart />
                    </div>
                </div>

                {/* Tabs — scroll target when drill-down is active */}
                <div ref={tableSectionRef}>
                    <Tabs tabs={tabs} defaultTab="policy-table" onChange={setActiveTab} />
                </div>

                {/* Tab Content */}
                {renderTabContent()}
            </div>

            {/* CSV Upload Modal */}
            <CSVUploadModal
                isOpen={isCSVModalOpen}
                onClose={() => setIsCSVModalOpen(false)}
            />

            {/* Batch Enrich Modal */}
            <BatchEnrichModal
                isOpen={isEnrichModalOpen}
                onClose={() => setIsEnrichModalOpen(false)}
                selectedPolicyIds={selectedTablePolicyIds}
            />
        </main>
    );
}
