'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { ArrowLeft, Mail, FileDown, Download, X, Maximize2 } from 'lucide-react';
import { getDeclarationById, fetchAIReport, Declaration, AIReportData } from '@/lib/api';
import { PolicyDashboard } from '@/components/policy/PolicyDashboard';
import { AIReport } from '@/components/policy/AIReport';
import { PolicyFiles } from '@/components/policy/PolicyFiles';

const policyTabs = [
    { id: 'review', label: 'POLICY REVIEW' },
    { id: 'files', label: 'FILES' },
];

export default function PolicyReviewPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    // Unwrap params in Next.js 15
    const { id } = use(params);

    const [declaration, setDeclaration] = useState<Declaration | undefined>(undefined);
    const [aiReport, setAiReport] = useState<AIReportData | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('review');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!id) return;

        async function loadData() {
            setLoading(true);
            try {
                const [decl, report] = await Promise.all([
                    getDeclarationById(id),
                    fetchAIReport(id)
                ]);
                setDeclaration(decl);
                setAiReport(report);
            } catch (error) {
                console.error("Failed to fetch policy data", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [id]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'review':
                return (
                    <div className={styles.content}>
                        <PolicyDashboard declaration={declaration!} />
                        {aiReport && <AIReport data={aiReport} />}
                    </div>
                );
            case 'files':
                return (
                    <div className={styles.content}>
                        <PolicyFiles policyId={id} />
                    </div>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return <div className={styles.container}>Loading policy data...</div>;
    }

    if (!declaration) {
        return (
            <div className={styles.container}>
                <Button variant="outline" onClick={() => router.back()} className={styles.backButton}>
                    <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                    Back to Dashboard
                </Button>
                <div style={{ marginTop: '2rem' }}>Policy not found for ID: {id}</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Property Banner */}
            <div className={styles.propertyBanner} onClick={() => setIsModalOpen(true)}>
                <img
                    src="/property-overhead-ai.png"
                    alt="AI-analyzed property overhead view"
                    className={styles.bannerImage}
                />
                <div className={styles.bannerOverlay}>
                    <div className={styles.bannerContent}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className={styles.bannerTitle}>Property Analysis</h2>
                                <p className={styles.bannerSubtitle}>AI-Detected Structures & Coverage Areas</p>
                            </div>
                            <Button variant="outline" className="text-white border-white hover:bg-white/20">
                                <Maximize2 size={16} className="mr-2" />
                                View Full Image
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Overlay */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeButton} onClick={() => setIsModalOpen(false)}>
                            <X size={20} />
                            Close
                        </button>
                        <img
                            src="/property-overhead-ai.png"
                            alt="Full AI-analyzed property overhead view"
                            className={styles.modalImage}
                        />
                    </div>
                </div>
            )}

            <div className={styles.header}>
                <Button variant="outline" onClick={() => router.back()} className={styles.backButton}>
                    <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                    Back to Dashboard
                </Button>
                <div>
                    <h1 className={styles.title}>Policy Review</h1>
                    <div className={styles.subtitle}>Policy #{declaration.policy_number} • {declaration.insured_name}</div>
                    <div className={styles.actionRow} style={{ padding: '10px 0px 0px 0px', float: "right" }}>
                        <Button variant="outline" className={`${styles.actionButton} ${styles.outlineAction}`}>
                            <Mail size={16} />
                            Email Options
                        </Button>
                        <Button variant="outline" className={`${styles.actionButton} ${styles.outlineAction}`}>
                            <FileDown size={16} />
                            Download Dec Page
                        </Button>
                        <Button variant="primary" className={styles.actionButton}>
                            <Download size={16} />
                            Download AI Report
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className={styles.tabsWrapper}>
                <Tabs tabs={policyTabs} defaultTab="review" onChange={setActiveTab} />
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
}
