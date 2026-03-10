'use client';

import { useState } from 'react';
import { InfoCards } from '@/components/dashboard/InfoCards';
import { KPIStats } from '@/components/dashboard/KPIStats';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { ActivityTab } from '@/components/dashboard/ActivityTab';
import { HighSeverityTab } from '@/components/dashboard/HighSeverityTab';
import { CSVUploadModal } from '@/components/dashboard/CSVUploadModal';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Plus, Upload } from 'lucide-react';


const tabs = [
    { id: 'policy-table', label: 'POLICY TABLE' },
    { id: 'activity', label: 'ACTIVITY' },
    { id: 'high-severity', label: 'HIGH SEVERITY' },
];

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('policy-table');
    const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);



    const renderTabContent = () => {
        switch (activeTab) {
            case 'policy-table':
                return (
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mt-4">
                            <h2 className="text-xl font-bold font-heading" style={{ color: 'var(--text-high)' }}>All Declarations</h2>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
                                <Link href="/submit">
                                    <Button size="sm" variant="primary">
                                        <Plus className="w-4 h-4 mr-1.5" />
                                        New Declaration
                                    </Button>
                                </Link>
                                <Button size="sm" variant="primary">
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    New Account
                                </Button>
                                <Button
                                    variant="excel"
                                    size="sm"
                                    onClick={() => setIsCSVModalOpen(true)}
                                >
                                    <Upload className="w-4 h-4 mr-1.5" />
                                    Upload CSV
                                </Button>
                                <Button variant="ghost" size="sm">View All</Button>
                            </div>
                        </div>
                        <DataTable />
                    </section>
                );
            case 'activity':
                return <ActivityTab />;
            case 'high-severity':
                return <HighSeverityTab />;
            default:
                return null;
        }
    };

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="mx-auto px-6 py-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Agent Dashboard</h1>
                        <p className="text-sm text-slate-500">Overview of all CFP declarations and their status</p>
                    </div>
                </header>

                {/* ═══ Overview Section: Left (Cards + Rings) | Right (Charts) ═══ */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.25rem',
                    marginBottom: '1.5rem',
                }}>
                    {/* ── Left Column: Stat Cards + KPI Rings ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <InfoCards />
                        <div style={{
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-default)',
                            padding: '1rem',
                        }}>
                            <KPIStats />
                        </div>
                    </div>

                    {/* ── Right Column: Stacked Charts ── */}
                    <div style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-default)',
                        padding: '1.25rem',
                        overflow: 'hidden',
                    }}>
                        <DashboardChart />
                    </div>
                </div>

                {/* Tabs */}
                <Tabs tabs={tabs} defaultTab="policy-table" onChange={setActiveTab} />

                {/* Tab Content */}
                {renderTabContent()}
            </div>

            {/* CSV Upload Modal */}
            <CSVUploadModal
                isOpen={isCSVModalOpen}
                onClose={() => setIsCSVModalOpen(false)}
            />
        </main>
    );
}
