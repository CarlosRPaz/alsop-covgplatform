'use client';

import { useState } from 'react';
import { InfoCards } from '@/components/dashboard/InfoCards';
import { KPIStats } from '@/components/dashboard/KPIStats';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { ActivityTab } from '@/components/dashboard/ActivityTab';
import { HighSeverityTab } from '@/components/dashboard/HighSeverityTab';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Plus } from 'lucide-react';


const tabs = [
    { id: 'policy-table', label: 'POLICY TABLE' },
    { id: 'activity', label: 'ACTIVITY' },
    { id: 'high-severity', label: 'HIGH SEVERITY' },
];

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('policy-table');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'policy-table':
                return (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">All Declarations</h2>
                            <Button variant="ghost" size="sm">View All</Button>
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
                    <div className="flex items-center gap-3" style={{ paddingTop: '.6rem' }}>
                        <Link href="/submit">
                            <Button size="md">
                                <Plus className="w-8 h-8 mr-2" />
                                New Declaration
                            </Button>
                        </Link>
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
