'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { ArrowLeft, Mail, FileDown, Download, X, Maximize2, Copy, Check, Pencil, Flag, AlertTriangle, AlertCircle, Info, Satellite, Loader2, Settings, FileText, ExternalLink, Zap, Upload } from 'lucide-react';
import { getPolicyDetailById, mapPolicyDetailToDeclaration, Declaration, PolicyDetail, fetchFlagsByPolicyId, PolicyFlagRow, getPropertyEnrichments, PropertyEnrichment, runPropertyEnrichment, runFlagCheck, getLatestReportForPolicy, PolicyReportRow, fetchDecPageFilesByPolicyId, getDecPageFileDownloadUrl, uploadDecPageToPolicy } from '@/lib/api';
import { PolicyStatusBar } from '@/components/policy/PolicyStatusBar';
import { PolicyDashboard } from '@/components/policy/PolicyDashboard';
import { AgentReviewPanel } from '@/components/policy/AIReport';
import { PolicyFiles } from '@/components/policy/PolicyFiles';
import { PolicyFlags } from '@/components/policy/PolicyFlags';
import { FlagAlertBanner } from '@/components/policy/FlagAlertBanner';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { DecPageReview } from '@/components/policy/DecPageReview';
import { PolicyEditPanel } from '@/components/policy/PolicyEditPanel';
import { FullWorkupModal } from '@/components/dashboard/FullWorkupModal';
import { EmailComposeModal } from '@/components/email/EmailComposeModal';
import { useRecentlyVisited } from '@/hooks/useRecentlyVisited';
import { useToast } from '@/components/ui/Toast/Toast';
import { getUserProfile, UserRole } from '@/lib/auth';
import { ClientPolicyView } from './client-view';

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
    const { addVisit } = useRecentlyVisited();
    const toast = useToast();

    const [declaration, setDeclaration] = useState<Declaration | undefined>(undefined);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('review');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [policyDetailRaw, setPolicyDetailRaw] = useState<PolicyDetail | null>(null);
    const [flagSummary, setFlagSummary] = useState<{ total: number; critical: number; high: number; warning: number; info: number }>(
        { total: 0, critical: 0, high: 0, warning: 0, info: 0 }
    );
    const [openFlags, setOpenFlags] = useState<PolicyFlagRow[]>([]);
    const [allFlags, setAllFlags] = useState<PolicyFlagRow[]>([]);
    const [enrichments, setEnrichments] = useState<PropertyEnrichment[]>([]);
    const [enrichStep, setEnrichStep] = useState<string | null>(null);
    const [flagCheckRunning, setFlagCheckRunning] = useState(false);
    const [reportRow, setReportRow] = useState<PolicyReportRow | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [hasDecPage, setHasDecPage] = useState(false);
    const [isWorkupOpen, setIsWorkupOpen] = useState(false);
    const [decPageStoragePath, setDecPageStoragePath] = useState<string | null>(null);
    const [decPageLoading, setDecPageLoading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    // Detect user role for client vs agent view
    useEffect(() => {
        getUserProfile().then(p => {
            setUserRole(p?.role || null);
            setRoleLoading(false);
        });
    }, []);

    // Client-view flag — checked AFTER all hooks (React rules of hooks)
    const isCustomer = !roleLoading && userRole === 'customer';

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
            setAllFlags(flags);
            const open = flags.filter((f: PolicyFlagRow) => !f.status || f.status === 'open');
            setOpenFlags(open);
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

        // Fetch report existence
        getLatestReportForPolicy(id).then(r => {
            if (r) setReportRow(r);
        });

        // Fetch dec page file for the Dec Page button
        fetchDecPageFilesByPolicyId(id).then(files => {
            if (files.length > 0 && files[0].storage_path) {
                setDecPageStoragePath(files[0].storage_path);
            }
        });
    }, [id]);

    // Derived: enrichment status for the status bar
    const isEnriched = enrichments.length > 0;
    const lastEnrichedDate = isEnriched
        ? new Date(enrichments.reduce((latest, e) => {
            const t = new Date(e.fetched_at).getTime();
            return t > latest ? t : latest;
        }, 0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    // Derived: flag check status — if any flags exist (including resolved), the evaluator has run
    const flagsChecked = allFlags.length > 0;
    const lastCheckedDate = flagsChecked
        ? new Date(allFlags.reduce((latest, f) => {
            const t = new Date(f.created_at || 0).getTime();
            return t > latest ? t : latest;
        }, 0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    // Enrichment handler (shared between status bar)
    const handleEnrich = async () => {
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
    };

    // Flag check handler
    const handleFlagCheck = async () => {
        setFlagCheckRunning(true);
        try {
            await runFlagCheck(id);
            // Refresh flags
            const flags = await fetchFlagsByPolicyId(id);
            setAllFlags(flags);
            const open = flags.filter((f: PolicyFlagRow) => !f.status || f.status === 'open');
            setOpenFlags(open);
            setFlagSummary({
                total: open.length,
                critical: open.filter((f: PolicyFlagRow) => f.severity === 'critical').length,
                high: open.filter((f: PolicyFlagRow) => f.severity === 'high').length,
                warning: open.filter((f: PolicyFlagRow) => f.severity === 'warning').length,
                info: open.filter((f: PolicyFlagRow) => f.severity === 'info').length,
            });
        } catch (e) {
            console.error('Flag check failed:', e);
        } finally {
            setFlagCheckRunning(false);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'review':
                return (
                    <div className={styles.content}>
                        <PolicyDashboard declaration={declaration!} enrichments={enrichments} policyDetail={policyDetailRaw || undefined} />
                        <AgentReviewPanel
                            reportRow={reportRow}
                            enrichments={enrichments}
                            reportLink={reportRow ? `/report/${reportRow.id}` : undefined}
                        />
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

    // Client-specific view rendered AFTER all hooks
    if (isCustomer) {
        return <ClientPolicyView policyId={id} />;
    }

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
                {/* ── Left: Title Block ── */}
                <div>
                    <Link href="/dashboard">
                        <button className={styles.backButton}>
                            <ArrowLeft size={14} />
                            Dashboard
                        </button>
                    </Link>
                    <h1 className={styles.title}>Policy Review</h1>
                    <div
                        className={styles.subtitle}
                        onClick={copyPolicyNumber}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        title="Click to copy policy number"
                    >
                        <span>
                            Policy <strong style={{ color: 'var(--accent-primary)' }}>{declaration.policy_number}</strong>
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); copyPolicyNumber(); }}
                            className={styles.copyBtn}
                            style={{ color: copied ? '#34d399' : '#4b5563' }}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                    <span
                        className={styles.clientName}
                        onClick={() => declaration.client_id && router.push(`/client/${declaration.client_id}`)}
                    >
                        {declaration.insured_name}
                    </span>
                </div>

                {/* ── Right: Action Cluster ── */}
                <div className={styles.actionCluster}>
                    <button className={styles.iconBtn} onClick={() => setIsEditOpen(true)} title="Edit Policy">
                        <Settings size={16} />
                    </button>
                    <button className={styles.iconBtn} title="Email Options — coming soon" onClick={() => toast.info('Email Options — coming soon!')}>
                        <Mail size={16} />
                    </button>

                    <div className={styles.actionDivider} />

                    <button className={styles.secondaryBtn} onClick={() => setIsWorkupOpen(true)}>
                        <Zap size={15} />
                        Full Analysis
                    </button>

                    {!decPageStoragePath ? (
                        <>
                            <input
                                type="file"
                                accept="application/pdf"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setDecPageLoading(true);
                                    try {
                                        const res = await uploadDecPageToPolicy(id, file);
                                        if (res.success && res.storagePath) {
                                            setDecPageStoragePath(res.storagePath);
                                            alert('Dec page uploaded successfully!');
                                        } else {
                                            alert(res.error || 'Failed to upload dec page.');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        alert('Failed to upload dec page.');
                                    } finally {
                                        setDecPageLoading(false);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }
                                }}
                            />
                            <button
                                className={styles.secondaryBtn}
                                disabled={decPageLoading}
                                title={decPageLoading ? 'Uploading...' : 'Upload Dec Page PDF'}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={15} />
                                {decPageLoading ? 'Uploading…' : 'Upload Dec Page'}
                            </button>
                        </>
                    ) : (
                        <button
                            className={styles.secondaryBtn}
                            disabled={decPageLoading}
                            title="Open Dec Page PDF"
                            onClick={async () => {
                                setDecPageLoading(true);
                                try {
                                    const url = await getDecPageFileDownloadUrl(decPageStoragePath);
                                    if (url) {
                                        window.open(url, '_blank');
                                    } else {
                                        alert('Could not generate download link.');
                                    }
                                } catch {
                                    alert('Failed to open dec page file.');
                                } finally {
                                    setDecPageLoading(false);
                                }
                            }}
                        >
                            <FileDown size={15} />
                            {decPageLoading ? 'Opening…' : 'Dec Page'}
                        </button>
                    )}

                    {reportRow ? (
                        <button
                            className={styles.primaryBtn}
                            onClick={() => router.push(`/report/${reportRow.id}`)}
                        >
                            <ExternalLink size={15} />
                            View Report
                        </button>
                    ) : (
                        <button
                            className={styles.dangerOutlineBtn}
                            disabled={isGeneratingReport}
                            onClick={async () => {
                                setIsGeneratingReport(true);
                                try {
                                    const res = await fetch('/api/reports/generate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ policyId: id }),
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        if (data.report) {
                                            setReportRow(data.report);
                                            router.push(`/report/${data.report.id}`);
                                        }
                                    }
                                } catch (e) {
                                    console.error('Report generation failed:', e);
                                } finally {
                                    setIsGeneratingReport(false);
                                }
                            }}
                        >
                            {isGeneratingReport ? (
                                <>
                                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <FileText size={15} />
                                    Generate Report
                                </>
                            )}
                        </button>
                    )}

                    {/* Email Report */}
                    {reportRow && (
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setShowEmailModal(true)}
                            title="Email report to client"
                        >
                            <Mail size={15} />
                            Email Report
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.commandSection}>
                <PolicyStatusBar
                    isEnriched={isEnriched}
                    enrichmentCount={enrichments.length}
                    lastEnrichedDate={lastEnrichedDate}
                    flagsChecked={flagsChecked}
                    lastCheckedDate={lastCheckedDate}
                    openFlagCount={flagSummary.total}
                    highestSeverity={flagSummary.critical > 0 ? 'critical' : flagSummary.high > 0 ? 'high' : flagSummary.warning > 0 ? 'warning' : flagSummary.info > 0 ? 'info' : null}
                    enrichStep={enrichStep}
                    onEnrich={handleEnrich}
                    onRunFlagCheck={handleFlagCheck}
                    flagCheckRunning={flagCheckRunning}
                    enrichments={enrichments}
                />
            </div>

            {/* ── Flag Alert ── */}
            {openFlags.length > 0 && (
                <div className={styles.commandSection}>
                    <FlagAlertBanner flags={openFlags} onViewFlags={() => setActiveTab('flags')} />
                </div>
            )}

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
                        }
                    }}
                />
            )}

            {/* Full Workup Modal */}
            <FullWorkupModal
                isOpen={isWorkupOpen}
                onClose={() => setIsWorkupOpen(false)}
                policyIds={[id]}
                onComplete={async () => {
                    // Refresh enrichment, flags, and report data
                    const [enrichData, flagData, reportData] = await Promise.all([
                        getPropertyEnrichments(id),
                        fetchFlagsByPolicyId(id),
                        getLatestReportForPolicy(id),
                    ]);
                    setEnrichments(enrichData);
                    setOpenFlags(flagData.filter(f => (!f.status && !f.resolved_at) || f.status === 'open'));
                    setAllFlags(flagData);
                    if (reportData) setReportRow(reportData);
                }}
            />

            {/* Email Compose Modal */}
            <EmailComposeModal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                defaultTo={policyDetailRaw?.client_email || ''}
                defaultTemplateId="report_delivery"
                defaultVariables={{
                    clientName: policyDetailRaw?.named_insured || '',
                    agentName: 'Alsop Insurance',
                    policyNumber: policyDetailRaw?.policy_number || declaration?.policy_number || '',
                    propertyAddress: policyDetailRaw?.property_address || '',
                }}
                policyId={id}
                clientId={policyDetailRaw?.client_id || ''}
                reportId={reportRow?.id || ''}
            />
        </div>
    );
}
