'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { ArrowLeft, Mail, FileDown, Download, X, Maximize2, Copy, Check, Pencil, Flag, AlertTriangle, AlertCircle, Info, Satellite, Loader2, Settings, FileText, ExternalLink, Zap, Upload } from 'lucide-react';
import { PropertyBanner } from '@/components/policy/PropertyBanner';
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
import { PolicyEmailComposer } from '@/components/email/PolicyEmailComposer';
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
    const [copied, setCopied] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [policyDetailRaw, setPolicyDetailRaw] = useState<PolicyDetail | null>(null);
    const [flagSummary, setFlagSummary] = useState<{ total: number; high: number; medium: number; low: number }>({
        total: 0, high: 0, medium: 0, low: 0
    });
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
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);
    const [bgProcessing, setBgProcessing] = useState(false);
    const [bgProcessingStep, setBgProcessingStep] = useState<string | null>(null);

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
    const bannerImageSrc = propertyImageEnrichment?.field_value || null;
    const imageSource = propertyImageEnrichment ? {
        name: propertyImageEnrichment.source_name,
        type: propertyImageEnrichment.source_type,
        url: propertyImageEnrichment.source_url,
        fetchedAt: propertyImageEnrichment.fetched_at,
        confidence: propertyImageEnrichment.confidence,
    } : null;

    // Derive street view image
    const streetViewEnrichment = enrichments.find(e => e.field_key === 'street_view_image');
    const streetViewSrc = streetViewEnrichment?.field_value || null;
    const streetViewSource = streetViewEnrichment ? {
        name: streetViewEnrichment.source_name,
        type: streetViewEnrichment.source_type,
        url: streetViewEnrichment.source_url,
        fetchedAt: streetViewEnrichment.fetched_at,
        confidence: streetViewEnrichment.confidence,
    } : null;

    // Derive fire risk data
    const fireRiskEnrichment = enrichments.find(e => e.field_key === 'fire_risk_label');
    const fireRiskLabel = fireRiskEnrichment?.field_value || null;

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
                high: open.filter((f: PolicyFlagRow) => f.severity === 'high').length,
                medium: open.filter((f: PolicyFlagRow) => f.severity === 'medium').length,
                low: open.filter((f: PolicyFlagRow) => f.severity === 'low').length,
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

    // Helper: refresh all policy data (enrichments, flags, report, etc.)
    const refreshAllData = useCallback(async () => {
        if (!id) return;
        try {
            const [newEnrichments, newFlags, newReport] = await Promise.all([
                getPropertyEnrichments(id),
                fetchFlagsByPolicyId(id),
                getLatestReportForPolicy(id),
            ]);
            setEnrichments(newEnrichments);
            setAllFlags(newFlags);
            const open = newFlags.filter((f: PolicyFlagRow) => !f.status || f.status === 'open');
            setOpenFlags(open);
            setFlagSummary({
                total: open.length,
                high: open.filter((f: PolicyFlagRow) => f.severity === 'high').length,
                medium: open.filter((f: PolicyFlagRow) => f.severity === 'medium').length,
                low: open.filter((f: PolicyFlagRow) => f.severity === 'low').length,
            });
            if (newReport) setReportRow(newReport);
            // Also refresh dec page file
            fetchDecPageFilesByPolicyId(id).then(files => {
                if (files.length > 0 && files[0].storage_path) {
                    setDecPageStoragePath(files[0].storage_path);
                }
            });
        } catch (e) {
            console.error('[PolicyPage] Failed to refresh data:', e);
        }
    }, [id]);

    // Auto-refresh when a dec page finishes processing in the background
    useEffect(() => {
        const handleDecPageParsed = () => {
            console.log('[PolicyPage] Dec page parsed — refreshing all data');
            setBgProcessing(false);
            setBgProcessingStep(null);
            refreshAllData();
        };
        window.addEventListener('decPageParsed', handleDecPageParsed);
        return () => window.removeEventListener('decPageParsed', handleDecPageParsed);
    }, [refreshAllData]);

    // Detect if a dec page is being processed in the background for this policy
    useEffect(() => {
        if (!id) return;
        const TRACKING_KEY = 'cfp_pending_dec_uploads';
        const stored = sessionStorage.getItem(TRACKING_KEY);
        if (!stored) return;

        let pendingIds: string[];
        try { pendingIds = JSON.parse(stored); } catch { return; }
        if (!Array.isArray(pendingIds) || pendingIds.length === 0) return;

        // There's a pending upload — show the banner
        setBgProcessing(true);

        // Poll the processing step for richer status
        const poll = async () => {
            try {
                const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
                if (!session?.access_token) return;
                const res = await fetch(`/api/upload/status?ids=${pendingIds.join(',')}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!res.ok) return;
                const json = await res.json();
                if (!json.success || !json.data) return;
                const active = (json.data as Array<{ status: string; processing_step?: string }>)
                    .find(s => s.status === 'processing' || s.status === 'queued');
                if (active) {
                    setBgProcessing(true);
                    const stepLabels: Record<string, string> = {
                        extracting_text: 'Extracting text from PDF…',
                        parsing_fields: 'Parsing declaration fields…',
                        creating_records: 'Creating policy records…',
                        enriching_property: 'Enriching property data…',
                        evaluating_flags: 'Evaluating flags…',
                        generating_report: 'Generating report…',
                        complete: 'Finalizing…',
                    };
                    setBgProcessingStep(stepLabels[active.processing_step || ''] || 'Processing…');
                } else {
                    // All done or none active anymore
                    setBgProcessing(false);
                    setBgProcessingStep(null);
                    refreshAllData();
                }
            } catch { /* non-fatal */ }
        };
        poll();
        const interval = setInterval(poll, 4000);
        return () => clearInterval(interval);
    }, [id, refreshAllData]);

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
        // Guard: enrichment requires a property address
        const address = policyDetailRaw?.property_address;
        if (!address) {
            toast.error('No property address on this policy — add an address before running enrichment.');
            return;
        }

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
        } catch (e: any) {
            clearInterval(timer);
            const msg = e?.message || 'Enrichment failed';
            toast.error(msg);
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
                high: open.filter((f: PolicyFlagRow) => f.severity === 'high').length,
                medium: open.filter((f: PolicyFlagRow) => f.severity === 'medium').length,
                low: open.filter((f: PolicyFlagRow) => f.severity === 'low').length,
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
            {/* Property Banner — state-aware (not-enriched / loading / enriched / error) */}
            <PropertyBanner
                imageSrc={bannerImageSrc}
                imageSource={imageSource}
                streetViewSrc={streetViewSrc}
                streetViewSource={streetViewSource}
                fireRiskLabel={fireRiskLabel}
                propertyAddress={policyDetailRaw?.property_address || null}
                isEnriching={enrichStep !== null && enrichStep !== '✓ Complete!' && enrichStep !== '✗ Failed — try again'}
                enrichStep={enrichStep}
                onEnrich={handleEnrich}
            />

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
                    <button
                        className={styles.iconBtn}
                        onClick={() => setShowEmailComposer(true)}
                        title="Compose Email"
                    >
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

                    {reportRow && (
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setShowEmailComposer(true)}
                            title="Email report to client"
                        >
                            <Mail size={15} />
                            Email Report
                        </button>
                    )}
                </div>
            </div>

            {/* ── Background Processing Banner ── */}
            {bgProcessing && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.75rem 1.25rem',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(59, 130, 246, 0.08))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '0.75rem',
                    marginBottom: '0.75rem',
                    fontSize: '0.85rem',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <Loader2 size={16} style={{ color: '#6366f1', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            Processing in background
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                            {bgProcessingStep || 'Working…'}
                        </span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        Data will auto-refresh when complete
                    </span>
                    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            <div className={styles.commandSection}>
                <PolicyStatusBar
                    isEnriched={isEnriched}
                    enrichmentCount={enrichments.length}
                    lastEnrichedDate={lastEnrichedDate}
                    flagsChecked={flagsChecked}
                    lastCheckedDate={lastCheckedDate}
                    openFlagCount={flagSummary.total}
                    highestSeverity={flagSummary.high > 0 ? 'high' : flagSummary.medium > 0 ? 'medium' : flagSummary.low > 0 ? 'low' : null}
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

            {/* Premium Email Composer */}
            <PolicyEmailComposer
                isOpen={showEmailComposer}
                onClose={() => setShowEmailComposer(false)}
                policyId={id}
                clientId={policyDetailRaw?.client_id || ''}
                reportId={reportRow?.id || ''}
                reportUrl={reportRow ? `${typeof window !== 'undefined' ? window.location.origin : ''}/report/${reportRow.id}` : undefined}
                clientEmail={policyDetailRaw?.client_email || ''}
                clientName={policyDetailRaw?.named_insured || declaration?.insured_name || ''}
                policyNumber={policyDetailRaw?.policy_number || declaration?.policy_number || ''}
                propertyAddress={policyDetailRaw?.property_address || ''}
                agentName="Alsop and Associates Insurance Agency"
                defaultTemplateId={reportRow ? 'report_delivery' : 'agent_outreach'}
            />
        </div>
    );
}
