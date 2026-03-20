'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { ArrowLeft, Mail, FileDown, Download, X, Maximize2, Copy, Check, Pencil, Flag, AlertTriangle, AlertCircle, Info, Satellite, Loader2 } from 'lucide-react';
import { getPolicyDetailById, mapPolicyDetailToDeclaration, generateAIReport, Declaration, AIReportData, PolicyDetail, fetchFlagsByPolicyId, PolicyFlagRow, getPropertyEnrichments, PropertyEnrichment, runPropertyEnrichment } from '@/lib/api';
import { PolicyDashboard } from '@/components/policy/PolicyDashboard';
import { AIReport } from '@/components/policy/AIReport';
import { PolicyFiles } from '@/components/policy/PolicyFiles';
import { PolicyFlags } from '@/components/policy/PolicyFlags';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { DecPageReview } from '@/components/policy/DecPageReview';
import { PolicyEditPanel } from '@/components/policy/PolicyEditPanel';

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
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [policyDetailRaw, setPolicyDetailRaw] = useState<PolicyDetail | null>(null);
    const [flagSummary, setFlagSummary] = useState<{ total: number; critical: number; high: number; warning: number; info: number }>(
        { total: 0, critical: 0, high: 0, warning: 0, info: 0 }
    );
    const [enrichments, setEnrichments] = useState<PropertyEnrichment[]>([]);
    const [enrichStep, setEnrichStep] = useState<string | null>(null);

    // Derive enriched property image
    const propertyImageEnrichment = enrichments.find(e => e.field_key === 'property_image');
    const bannerImageSrc = propertyImageEnrichment?.field_value || '/property-overhead-ai.png';
    const imageSource = propertyImageEnrichment ? {
        name: propertyImageEnrichment.source_name,
        type: propertyImageEnrichment.source_type,
        url: propertyImageEnrichment.source_url,
        fetchedAt: propertyImageEnrichment.fetched_at,
        confidence: propertyImageEnrichment.confidence,
    } : null;

    // Derive fire risk data
    const fireRiskEnrichment = enrichments.find(e => e.field_key === 'fire_risk_label');
    const fireRiskLabel = fireRiskEnrichment?.field_value || null;
    const fireRiskColor = fireRiskLabel === 'Very High' ? '#ef4444'
        : fireRiskLabel === 'High' ? '#f97316'
            : fireRiskLabel === 'Moderate' ? '#eab308'
                : fireRiskLabel === 'Low' ? '#22c55e'
                    : fireRiskLabel === 'Very Low' ? '#16a34a'
                        : '#6b7280';

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
                    setPolicyDetailRaw(detail);
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

    // Fetch flag counts for the indicator pill
    useEffect(() => {
        if (!id) return;
        fetchFlagsByPolicyId(id).then(flags => {
            const open = flags.filter((f: PolicyFlagRow) => !f.status || f.status === 'open');
            setFlagSummary({
                total: open.length,
                critical: open.filter((f: PolicyFlagRow) => f.severity === 'critical').length,
                high: open.filter((f: PolicyFlagRow) => f.severity === 'high').length,
                warning: open.filter((f: PolicyFlagRow) => f.severity === 'warning').length,
                info: open.filter((f: PolicyFlagRow) => f.severity === 'info').length,
            });
        });

        // Fetch property enrichments (source-tracked data)
        getPropertyEnrichments(id).then(setEnrichments);
    }, [id]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'review':
                return (
                    <div className={styles.content}>
                        <PolicyDashboard declaration={declaration!} enrichments={enrichments} />
                        {aiReport && <AIReport data={aiReport} />}
                    </div>
                );
            case 'flags':
                return (
                    <div className={styles.content}>
                        <PolicyFlags policyId={id} clientId={declaration?.client_id || undefined} />
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
        return (
            <div className={styles.skeletonContainer}>
                <div className={styles.skeletonBanner} />
                <div className={styles.skeletonHeader}>
                    <div className={`${styles.skeletonLine} ${styles.wide}`} />
                    <div className={`${styles.skeletonLine} ${styles.medium}`} />
                    <div className={`${styles.skeletonLine} ${styles.narrow}`} />
                </div>
                <div className={styles.skeletonCards}>
                    <div className={styles.skeletonCard} />
                    <div className={styles.skeletonCard} />
                    <div className={styles.skeletonCard} />
                </div>
                <div className={styles.skeletonTabs}>
                    <div className={styles.skeletonTab} />
                    <div className={styles.skeletonTab} />
                    <div className={styles.skeletonTab} />
                    <div className={styles.skeletonTab} />
                    <div className={styles.skeletonTab} />
                </div>
                <div className={styles.skeletonContent} />
            </div>
        );
    }

    if (!declaration) {
        return (
            <div className={styles.container}>
                <Link href="/dashboard">
                    <Button variant="outline" className={styles.backButton}>
                        <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                        Back to Dashboard
                    </Button>
                </Link>
                <div style={{ marginTop: '2rem' }}>Policy not found for ID: {id}</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Property Banner */}
            <div className={styles.propertyBanner} onClick={() => setIsModalOpen(true)}>
                <img
                    src={bannerImageSrc}
                    alt={imageSource ? `Satellite view — ${imageSource.name}` : 'AI-analyzed property overhead view'}
                    className={styles.bannerImage}
                />
                <div className={styles.bannerOverlay}>
                    <div className={styles.bannerContent}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className={styles.bannerTitle}>Property Analysis</h2>
                                <p className={styles.bannerSubtitle}>
                                    {imageSource
                                        ? `Source: ${imageSource.name} · Fetched ${new Date(imageSource.fetchedAt).toLocaleDateString()}`
                                        : 'AI-Detected Structures & Coverage Areas'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {fireRiskLabel && (
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: '8px',
                                        padding: '0.4rem 0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        border: `1px solid ${fireRiskColor}40`,
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>🔥 FIRE RISK</span>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            color: fireRiskColor,
                                            textTransform: 'uppercase',
                                        }}>{fireRiskLabel}</span>
                                    </div>
                                )}
                                <Button variant="outline" className="text-white border-white hover:bg-white/20">
                                    <Maximize2 size={16} className="mr-2" />
                                    View Full Image
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                {imageSource && (
                    <div style={{
                        position: 'absolute',
                        bottom: '0.75rem',
                        right: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.7rem',
                        color: 'rgba(255,255,255,0.8)',
                        zIndex: 2,
                    }}>
                        <span style={{ opacity: 0.6 }}>📡</span>
                        <span>{imageSource.name}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ opacity: 0.6, textTransform: 'capitalize' }}>{imageSource.type.replace('_', ' ')}</span>
                        {imageSource.confidence === 'high' && (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>✓</span>
                        )}
                    </div>
                )}
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
                            src={bannerImageSrc}
                            alt={imageSource ? `Satellite view — ${imageSource.name}` : 'Full AI-analyzed property overhead view'}
                            className={styles.modalImage}
                        />
                        {imageSource && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(30, 41, 59, 0.8)',
                                borderRadius: '0 0 12px 12px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.7)',
                            }}>
                                <span><strong style={{ color: '#94a3b8' }}>Source:</strong> {imageSource.name}</span>
                                <span><strong style={{ color: '#94a3b8' }}>Type:</strong> {imageSource.type.replace('_', ' ')}</span>
                                <span><strong style={{ color: '#94a3b8' }}>Fetched:</strong> {new Date(imageSource.fetchedAt).toLocaleString()}</span>
                                <span><strong style={{ color: '#94a3b8' }}>Confidence:</strong> {imageSource.confidence}</span>
                                {imageSource.url && (
                                    <a href={imageSource.url} target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                                        View on {imageSource.name} ↗
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={styles.header}>
                <Link href="/dashboard">
                    <Button variant="outline" className={styles.backButton}>
                        <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                        Back to Dashboard
                    </Button>
                </Link>
                <div>
                    <h1 className={styles.title}>Policy Review</h1>
                    <div
                        className={styles.subtitle}
                        onClick={copyPolicyNumber}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        title="Click to copy policy number"
                    >
                        <span style={{ color: 'var(--text-high)', fontWeight: 500 }}>Policy # </span><span style={{ color: '#60a5fa', fontWeight: 600 }}>{declaration.policy_number}</span>
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
                    <div style={{ marginTop: '0.35rem' }}>
                        <span
                            style={{
                                color: '#60a5fa',
                                cursor: 'pointer',
                                fontSize: '1.15rem',
                                fontWeight: 700,
                                letterSpacing: '-0.01em',
                                lineHeight: 1.3,
                                borderBottom: '2px solid transparent',
                                transition: 'border-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#60a5fa')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                            onClick={() => declaration.client_id && router.push(`/client/${declaration.client_id}`)}
                        >
                            {declaration.insured_name}
                        </span>
                    </div>

                    {/* Flag indicator pill */}
                    {flagSummary.total > 0 && (
                        <div
                            className={styles.flagIndicator}
                            onClick={() => setActiveTab('flags')}
                            title="Click to view flags"
                        >
                            <Flag size={13} />
                            <span className={styles.flagIndicatorTotal}>{flagSummary.total} open flag{flagSummary.total !== 1 ? 's' : ''}</span>
                            {flagSummary.critical > 0 && (
                                <span className={styles.flagDotCritical}>
                                    <AlertCircle size={11} /> {flagSummary.critical}
                                </span>
                            )}
                            {flagSummary.high > 0 && (
                                <span className={styles.flagDotHigh}>
                                    <AlertTriangle size={11} /> {flagSummary.high}
                                </span>
                            )}
                            {flagSummary.warning > 0 && (
                                <span className={styles.flagDotWarning}>{flagSummary.warning} warn</span>
                            )}
                            {flagSummary.info > 0 && (
                                <span className={styles.flagDotInfo}>
                                    <Info size={11} /> {flagSummary.info}
                                </span>
                            )}
                        </div>
                    )}

                    <div className={styles.actionRow} style={{ padding: '10px 0px 0px 0px', float: "right" }}>
                        <Button
                            variant="outline"
                            className={`${styles.actionButton} ${styles.outlineAction}`}
                            disabled={!!enrichStep}
                            onClick={async () => {
                                const steps = [
                                    'Fetching satellite image…',
                                    'Geocoding address…',
                                    'Checking fire risk…',
                                    'Running AI vision analysis…',
                                    'Finalizing…',
                                ];
                                let stepIdx = 0;
                                setEnrichStep(steps[0]);
                                const timer = setInterval(() => {
                                    stepIdx++;
                                    if (stepIdx < steps.length) {
                                        setEnrichStep(steps[stepIdx]);
                                    }
                                }, 4000);
                                try {
                                    await runPropertyEnrichment(id);
                                    clearInterval(timer);
                                    setEnrichStep('✓ Complete!');
                                    const updated = await getPropertyEnrichments(id);
                                    setEnrichments(updated);
                                    setTimeout(() => setEnrichStep(null), 2000);
                                } catch (e) {
                                    clearInterval(timer);
                                    console.error('Enrichment failed:', e);
                                    setEnrichStep('✗ Failed — try again');
                                    setTimeout(() => setEnrichStep(null), 3000);
                                }
                            }}
                        >
                            {enrichStep ? (
                                <>
                                    {enrichStep === '✓ Complete!' ? (
                                        <Check size={16} style={{ color: '#22c55e' }} />
                                    ) : enrichStep === '✗ Failed — try again' ? (
                                        <X size={16} style={{ color: '#ef4444' }} />
                                    ) : (
                                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    )}
                                    <span style={{
                                        fontSize: '0.78rem',
                                        color: enrichStep === '✓ Complete!' ? '#22c55e'
                                            : enrichStep === '✗ Failed — try again' ? '#ef4444'
                                            : undefined,
                                        fontWeight: enrichStep === '✓ Complete!' || enrichStep === '✗ Failed — try again' ? 600 : undefined,
                                    }}>{enrichStep}</span>
                                </>
                            ) : (
                                <>
                                    <Satellite size={16} />
                                    Enrich Property Data
                                </>
                            )}
                        </Button>
                        <Button variant="outline" className={`${styles.actionButton} ${styles.outlineAction}`} onClick={() => setIsEditOpen(true)}>
                            <Pencil size={16} />
                            Edit Policy
                        </Button>
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
                <Tabs tabs={policyTabs} defaultTab="review" activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Tab Content */}
            {renderTabContent()}

            {/* Edit Panel */}
            {isEditOpen && policyDetailRaw && (
                <PolicyEditPanel
                    policyDetail={policyDetailRaw}
                    onClose={() => setIsEditOpen(false)}
                    onSaved={async () => {
                        setIsEditOpen(false);
                        const detail = await getPolicyDetailById(id);
                        if (detail) {
                            setPolicyDetailRaw(detail);
                            setDeclaration(mapPolicyDetailToDeclaration(detail));
                            setAiReport(generateAIReport(mapPolicyDetailToDeclaration(detail)));
                        }
                    }}
                />
            )}
        </div>
    );
}
