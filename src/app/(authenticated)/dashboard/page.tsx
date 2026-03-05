'use client';

import { useState, useRef } from 'react';
import { InfoCards } from '@/components/dashboard/InfoCards';
import { KPIStats } from '@/components/dashboard/KPIStats';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { ActivityTab } from '@/components/dashboard/ActivityTab';
import { HighSeverityTab } from '@/components/dashboard/HighSeverityTab';
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
    const csvInputRef = useRef<HTMLInputElement>(null);

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        console.log('CSV file selected:', file.name);
        // TODO: Parse CSV and upload to Supabase
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

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
                                <input
                                    type="file"
                                    accept=".csv"
                                    ref={csvInputRef}
                                    onChange={handleCSVUpload}
                                    style={{ display: 'none' }}
                                />
                                <Button
                                    variant="excel"
                                    size="sm"
                                    onClick={() => csvInputRef.current?.click()}
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
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Agent Dashboard</h1>
                        <p className="text-sm text-slate-500">Overview of all CFP declarations and their status</p>
                    </div>
                </header>

                {/* Info Cards */}
                <div style={{ marginTop: '2rem' }}>
                    <InfoCards />
                </div>

                {/* Stats and Chart Section */}
                <div className="mb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
                        {/* KPI Stats */}
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <KPIStats />
                        </div>

                        {/* Chart */}
                        <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                            <DashboardChart />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs tabs={tabs} defaultTab="policy-table" onChange={setActiveTab} />

                {/* Tab Content */}
                {renderTabContent()}
            </div>
        </main>
    );
}
