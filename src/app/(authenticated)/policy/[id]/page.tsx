'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { ArrowLeft, Mail, FileDown, Download, X, Maximize2, Copy, Check } from 'lucide-react';
import { getPolicyDetailById, mapPolicyDetailToDeclaration, generateAIReport, Declaration, AIReportData } from '@/lib/api';
import { PolicyDashboard } from '@/components/policy/PolicyDashboard';
import { AIReport } from '@/components/policy/AIReport';
import { PolicyFiles } from '@/components/policy/PolicyFiles';
import { PolicyFlags } from '@/components/policy/PolicyFlags';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { DecPageReview } from '@/components/policy/DecPageReview';

const policyTabs = [
    { id: 'review', label: 'POLICY REVIEW' },
    { id: 'flags', label: 'FLAGS' },
    { id: 'notes', label: 'NOTES' },
    { id: 'activity', label: 'ACTIVITY' },
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
    const [copied, setCopied] = useState(false);

    const copyPolicyNumber = () => {
        if (declaration?.policy_number) {
            navigator.clipboard.writeText(declaration.policy_number);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        if (!id) return;

        async function loadData() {
            setLoading(true);
            try {
                const detail = await getPolicyDetailById(id);
                if (detail) {
                    const decl = mapPolicyDetailToDeclaration(detail);
                    setDeclaration(decl);
                    setAiReport(generateAIReport(decl));
                }
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
            case 'flags':
                return (
                    <div className={styles.content}>
                        <PolicyFlags policyId={id} />
                    </div>
                );
            case 'notes':
                return (
                    <div className={styles.content}>
                        <NotesPanel
                            clientId={declaration?.client_id || ''}
                            policyId={id}
                            showPolicySections
                        />
                    </div>
                );
            case 'activity':
                return (
                    <div className={styles.content}>
                        <ActivityTimeline policyId={id} />
                    </div>
                );
            case 'files':
                return (
                    <div className={styles.content}>
                        <DecPageReview policyId={id} onApproved={() => {
                            // Reload policy data after approval
                            getPolicyDetailById(id).then(detail => {
                                if (detail) {
                                    setDeclaration(mapPolicyDetailToDeclaration(detail));
                                    setAiReport(generateAIReport(mapPolicyDetailToDeclaration(detail)));
                                }
                            });
                        }} />
                        <div style={{ marginTop: '1.5rem' }}>
                            <PolicyFiles policyId={id} />
                        </div>
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
                    <div
                        className={styles.subtitle}
                        onClick={copyPolicyNumber}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        title="Click to copy policy number"
                    >
                        <span>Policy #{declaration.policy_number}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); copyPolicyNumber(); }}
                            style={{
                                background: 'none',
                                border: '1px solid #475569',
                                borderRadius: '6px',
                                padding: '0.15rem 0.35rem',
                                color: copied ? '#34d399' : '#6b7280',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'color 0.15s, border-color 0.15s',
                            }}
                        >
                            {copied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>
                        <span
                            style={{ color: '#60a5fa', cursor: 'pointer', fontSize: '0.9rem' }}
                            onClick={() => declaration.client_id && router.push(`/client/${declaration.client_id}`)}
                        >
                            {declaration.insured_name}
                        </span>
                    </div>
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
