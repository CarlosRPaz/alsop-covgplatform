'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReportById, PolicyReportRow } from '@/lib/api';
import styles from './page.module.css';

/* ── Severity helpers ── */
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const ADEQUACY_LABEL: Record<string, string> = { adequate: '✓ Adequate', review: '⚠ Review', gap: '✕ Gap', unknown: '? Unknown' };
const CATEGORY_LABEL: Record<string, string> = { discuss: 'Discuss', verify: 'Verify', review: 'Review', consider_coverage: 'Coverage' };

function formatDate(d: string | null | undefined): string {
    if (!d) return 'N/A';
    try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return d; }
}

function formatCurrency(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === '') return 'N/A';
    const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : v;
    if (isNaN(n)) return String(v);
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function ReportPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [report, setReport] = useState<PolicyReportRow | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        getReportById(id).then(data => {
            setReport(data || null);
            setLoading(false);
        });
    }, [id]);

    // Derive data BEFORE hooks so dependencies are stable
    const ai = report?.ai_insights;
    const data = report?.data_payload;
    const policy = data?.policy || {};
    const flags = data?.flags || [];
    const enrichments = data?.enrichments || [];

    // All hooks must be called unconditionally (before any early returns)
    const sortedConcerns = useMemo(() =>
        [...(ai?.top_concerns || [])].sort((a: any, b: any) =>
            (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
        ), [ai?.top_concerns]);

    const sortedRecs = useMemo(() =>
        [...(ai?.recommendations || [])].sort((a: any, b: any) => (a.priority ?? 3) - (b.priority ?? 3))
        , [ai?.recommendations]);

    const recsByCategory = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        sortedRecs.forEach((r: any) => {
            const cat = r.category || 'review';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(r);
        });
        return grouped;
    }, [sortedRecs]);

    const allSources = useMemo(() => {
        const s = new Set<string>();
        enrichments.forEach((e: any) => { if (e.source) s.add(e.source); });
        (ai?.top_concerns || []).forEach((c: any) => { if (c.source) s.add(c.source); });
        (ai?.property_observations || []).forEach((o: any) => { if (o.source) s.add(o.source); });
        (ai?.recommendations || []).forEach((r: any) => { if (r.source) s.add(r.source); });
        flags.forEach((f: any) => { if (f.source) s.add(f.source); });
        return Array.from(s).sort();
    }, [enrichments, ai, flags]);

    // Derived display values
    const issuedDate = report?.created_at
        ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';
    const issuedTime = report?.created_at
        ? new Date(report.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';

    // Early returns AFTER all hooks
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading Policy Report…</div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={styles.container}>
                <div className={styles.errorState}>Report not found or unavailable.</div>
            </div>
        );
    }
    return (
        <div className={styles.container}>
            {/* Action Bar */}
            <div className={styles.actionBar}>
                <button onClick={() => router.back()} className={styles.backBtn}>← Back to Policy</button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => window.print()} className={styles.printBtn}>Save as PDF</button>
                </div>
            </div>

            {/* Document */}
            <div className={styles.document}>

                {/* ── HEADER ── */}
                <div className={styles.header}>
                    <div className={styles.headerBrand}>
                        <div className={styles.brandLogo}>GG</div>
                        <span className={styles.brandName}>Gap Guard</span>
                    </div>
                    <div className={styles.headerTitle}>Comprehensive Policy Review</div>
                    <div className={styles.headerMeta}>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Prepared for</span>
                            <span className={styles.metaValue}>{policy.named_insured || 'Unknown'}</span>
                        </div>
                        <div className={styles.metaDivider} />
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Policy</span>
                            <span className={styles.metaValue}>{policy.policy_number || 'N/A'}</span>
                        </div>
                        <div className={styles.metaDivider} />
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Generated</span>
                            <span className={styles.metaValue}>{issuedDate} at {issuedTime}</span>
                        </div>
                    </div>
                    <div className={styles.aiBanner}>
                        <span className={styles.aiBadge}>AI-Synthesized</span>
                        This report combines deterministic policy data with AI-inferred insights and recommendations. Agent review is required before client presentation.
                    </div>
                </div>

                {/* ── 1. EXECUTIVE SUMMARY ── */}
                <div className={styles.section}>
                    <div className={styles.sectionNumber}>01</div>
                    <h2 className={styles.sectionHeader}>Executive Summary</h2>
                    <div className={styles.summaryCard}>
                        {ai?.executive_summary || 'No executive summary available.'}
                    </div>
                </div>

                {/* ── 2. RENEWAL SNAPSHOT ── */}
                <div className={styles.section}>
                    <div className={styles.sectionNumber}>02</div>
                    <h2 className={styles.sectionHeader}>Renewal Snapshot</h2>
                    <div className={styles.snapshotGrid}>
                        <div className={styles.snapshotItem}>
                            <div className={styles.snapshotLabel}>Effective Date</div>
                            <div className={styles.snapshotValue}>{formatDate(policy.effective_date)}</div>
                        </div>
                        <div className={styles.snapshotItem}>
                            <div className={styles.snapshotLabel}>Expiration Date</div>
                            <div className={styles.snapshotValue}>{formatDate(policy.expiration_date)}</div>
                        </div>
                        <div className={styles.snapshotItem}>
                            <div className={styles.snapshotLabel}>Annual Premium</div>
                            <div className={styles.snapshotValue}>{formatCurrency(policy.annual_premium)}</div>
                        </div>
                        <div className={styles.snapshotItem}>
                            <div className={styles.snapshotLabel}>Open Flags</div>
                            <div className={`${styles.snapshotValue} ${flags.length > 0 ? styles.snapshotAlert : ''}`}>
                                {flags.length}
                            </div>
                        </div>
                    </div>
                    {ai?.renewal_snapshot && (
                        <div className={styles.snapshotNarrative}>{ai.renewal_snapshot}</div>
                    )}
                </div>

                {/* ── 3. POLICY OVERVIEW ── */}
                <div className={styles.section}>
                    <div className={styles.sectionNumber}>03</div>
                    <h2 className={styles.sectionHeader}>Policy Overview</h2>
                    <div className={styles.overviewGrid}>
                        {[
                            { label: 'Carrier', value: policy.carrier_name },
                            { label: 'Insured Location', value: policy.property_address },
                            { label: 'Mailing Address', value: policy.mailing_address },
                            { label: 'Year Built', value: policy.year_built },
                            { label: 'Construction', value: policy.construction_type },
                            { label: 'Roof Type', value: policy.roof_type },
                            { label: 'Square Footage', value: policy.square_footage ? `${policy.square_footage} sq ft` : null },
                            { label: 'Number of Stories', value: policy.number_of_stories },
                        ].map((item, i) => (
                            <div key={i} className={styles.overviewItem}>
                                <div className={styles.overviewLabel}>{item.label}</div>
                                <div className={styles.overviewValue}>{item.value || 'N/A'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── 4. TOP FINDINGS ── */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <div className={styles.sectionNumber}>04</div>
                    <h2 className={styles.sectionHeader}>Top Findings & Key Concerns</h2>
                    {sortedConcerns.length > 0 ? (
                        <div className={styles.findingsStack}>
                            {sortedConcerns.map((concern: any, idx: number) => (
                                <div key={idx} className={`${styles.findingCard} ${styles[`finding_${concern.severity}`] || ''}`}>
                                    <div className={styles.findingHeader}>
                                        <span className={`${styles.severityBadge} ${styles[`sev_${concern.severity}`]}`}>
                                            {SEVERITY_LABEL[concern.severity] || concern.severity}
                                        </span>
                                        <span className={styles.sourceBadge}>{concern.source || 'analysis'}</span>
                                    </div>
                                    <div className={styles.findingTitle}>{concern.topic}</div>
                                    <div className={styles.findingText}>{concern.explanation}</div>
                                    {concern.evidence && (
                                        <div className={styles.findingEvidence}>
                                            <span className={styles.evidenceLabel}>Evidence:</span> {concern.evidence}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            ✓ No critical discrepancies or immediate concerns detected.
                        </div>
                    )}
                </div>

                {/* ── 5. COVERAGE REVIEW ── */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <div className={styles.sectionNumber}>05</div>
                    <h2 className={styles.sectionHeader}>Coverage Review</h2>

                    {/* Deterministic coverage data */}
                    <div className={styles.coverageTable}>
                        <div className={styles.coverageRow + ' ' + styles.coverageHeaderRow}>
                            <div className={styles.coverageCell}>Coverage</div>
                            <div className={styles.coverageCell}>Current Limit</div>
                            <div className={styles.coverageCell}>Assessment</div>
                            <div className={styles.coverageCell}>Observation</div>
                        </div>
                        {/* Deterministic entries from policy */}
                        {[
                            { label: 'Dwelling (Cov A)', value: policy.limit_dwelling },
                            { label: 'Other Structures (Cov B)', value: policy.limit_other_structures },
                            { label: 'Personal Property (Cov C)', value: policy.limit_personal_property },
                            { label: 'Loss of Use (Cov D)', value: policy.limit_loss_of_use },
                            { label: 'Medical Payments', value: policy.limit_medical_payments },
                            { label: 'Ordinance or Law', value: policy.limit_ordinance_or_law },
                            { label: 'Extended Replacement', value: policy.limit_extended_replacement_cost_coverage },
                            { label: 'Deductible', value: policy.deductible },
                        ].map((cov, i) => {
                            const aiReview = (ai?.coverage_review || []).find(
                                (c: any) => c.coverage?.toLowerCase().includes(cov.label.split(' (')[0].toLowerCase())
                            );
                            return (
                                <div key={i} className={styles.coverageRow}>
                                    <div className={styles.coverageCell + ' ' + styles.coverageName}>{cov.label}</div>
                                    <div className={styles.coverageCell + ' ' + styles.coverageValue}>
                                        {cov.value ? formatCurrency(cov.value) : <span className={styles.noData}>Not on file</span>}
                                    </div>
                                    <div className={styles.coverageCell}>
                                        {aiReview ? (
                                            <span className={`${styles.adequacyBadge} ${styles[`adeq_${aiReview.adequacy}`]}`}>
                                                {ADEQUACY_LABEL[aiReview.adequacy] || aiReview.adequacy}
                                            </span>
                                        ) : (
                                            <span className={styles.adequacyBadge + ' ' + styles.adeq_unknown}>—</span>
                                        )}
                                    </div>
                                    <div className={styles.coverageCell + ' ' + styles.coverageObs}>
                                        {aiReview?.observation || '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.pageBreakBefore}></div>

                {/* ── 6. PROPERTY & RISK OBSERVATIONS ── */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <div className={styles.sectionNumber}>06</div>
                    <h2 className={styles.sectionHeader}>Property & Risk Observations</h2>

                    {/* AI-structured observations */}
                    {(ai?.property_observations || []).length > 0 ? (
                        <div className={styles.observationsStack}>
                            {(ai?.property_observations || []).map((obs: any, idx: number) => (
                                <div key={idx} className={`${styles.observationCard} ${obs.discrepancy ? styles.observationDiscrepancy : ''}`}>
                                    <div className={styles.observationHeader}>
                                        <span className={styles.sourceBadge}>{obs.source}</span>
                                        <span className={`${styles.confidenceBadge} ${styles[`conf_${obs.confidence}`]}`}>
                                            {obs.confidence} confidence
                                        </span>
                                    </div>
                                    <div className={styles.observationText}>{obs.observation}</div>
                                    {obs.discrepancy && (
                                        <div className={styles.discrepancyNote}>
                                            ⚠ Discrepancy: {obs.discrepancy}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : enrichments.length > 0 ? (
                        /* Fallback: raw enrichment table for older reports */
                        <div className={styles.coverageTable}>
                            <div className={styles.coverageRow + ' ' + styles.coverageHeaderRow}>
                                <div className={styles.coverageCell}>Data Point</div>
                                <div className={styles.coverageCell}>Value</div>
                                <div className={styles.coverageCell}>Source</div>
                            </div>
                            {enrichments.map((enr: any, idx: number) => (
                                <div key={idx} className={styles.coverageRow}>
                                    <div className={styles.coverageCell + ' ' + styles.coverageName}>
                                        {enr.key?.replace(/_/g, ' ')}
                                    </div>
                                    <div className={styles.coverageCell}>
                                        {enr.value}
                                        {enr.confidence && (
                                            <span className={styles.confidenceBadge + ' ' + styles[`conf_${enr.confidence}`]} style={{ marginLeft: '0.5rem' }}>
                                                {enr.confidence}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.coverageCell + ' ' + styles.coverageObs}>{enr.source}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>No external property enrichment data available.</div>
                    )}
                </div>

                {/* ── 7. DATA GAPS ── */}
                {(ai?.data_gaps || []).length > 0 && (
                    <div className={`${styles.section} ${styles.avoidBreak}`}>
                        <div className={styles.sectionNumber}>07</div>
                        <h2 className={styles.sectionHeader}>Data Gaps & Missing Information</h2>
                        <div className={styles.coverageTable}>
                            <div className={styles.coverageRow + ' ' + styles.coverageHeaderRow}>
                                <div className={styles.coverageCell}>Missing Data</div>
                                <div className={styles.coverageCell}>Impact</div>
                                <div className={styles.coverageCell}>Suggested Action</div>
                            </div>
                            {(ai?.data_gaps || []).map((gap: any, idx: number) => (
                                <div key={idx} className={styles.coverageRow}>
                                    <div className={styles.coverageCell + ' ' + styles.coverageName}>{gap.field}</div>
                                    <div className={styles.coverageCell + ' ' + styles.coverageObs}>{gap.impact}</div>
                                    <div className={styles.coverageCell + ' ' + styles.coverageObs}>{gap.suggestion}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 8. RECOMMENDATIONS ── */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <div className={styles.sectionNumber}>{(ai?.data_gaps || []).length > 0 ? '08' : '07'}</div>
                    <h2 className={styles.sectionHeader}>Recommendations & Action Items</h2>

                    {Object.keys(recsByCategory).length > 0 ? (
                        <div className={styles.recCategories}>
                            {Object.entries(recsByCategory).map(([category, recs]) => (
                                <div key={category} className={styles.recCategory}>
                                    <div className={styles.recCategoryTitle}>
                                        <span className={`${styles.categoryDot} ${styles[`cat_${category}`]}`} />
                                        {CATEGORY_LABEL[category] || category}
                                    </div>
                                    <div className={styles.recList}>
                                        {recs.map((rec: any, idx: number) => (
                                            <div key={idx} className={styles.recItem}>
                                                <span className={`${styles.priorityBadge} ${styles[`pri_${rec.priority}`]}`}>
                                                    P{rec.priority || 3}
                                                </span>
                                                <div className={styles.recContent}>
                                                    <div className={styles.recText}>{rec.text}</div>
                                                    {rec.source && (
                                                        <div className={styles.recSource}>Based on: {rec.source}</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>No recommendations at this time.</div>
                    )}
                </div>

                {/* ── 9. ACTION ITEMS CHECKLIST ── */}
                {(ai?.action_items || []).length > 0 && (
                    <div className={`${styles.section} ${styles.avoidBreak}`}>
                        <div className={styles.sectionNumber}>{(ai?.data_gaps || []).length > 0 ? '09' : '08'}</div>
                        <h2 className={styles.sectionHeader}>Discussion Checklist</h2>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                            Items to review together during the renewal conversation.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(ai?.action_items || []).map((item: any, idx: number) => {
                                const typeColors: Record<string, string> = {
                                    confirm: '#3b82f6', discuss: '#8b5cf6', update: '#f59e0b', verify: '#10b981'
                                };
                                const urgencyLabels: Record<string, string> = {
                                    before_renewal: 'Before Renewal', at_renewal: 'At Renewal', when_convenient: 'When Convenient'
                                };
                                return (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                        padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{
                                            width: '20px', height: '20px', borderRadius: '4px', border: '2px solid #cbd5e1',
                                            flexShrink: 0, marginTop: '2px'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>{item.item}</div>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                                                    letterSpacing: '0.04em', padding: '0.15rem 0.4rem', borderRadius: '4px',
                                                    background: `${typeColors[item.type] || '#64748b'}18`,
                                                    color: typeColors[item.type] || '#64748b',
                                                    border: `1px solid ${typeColors[item.type] || '#64748b'}30`
                                                }}>
                                                    {item.type}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500
                                                }}>
                                                    {urgencyLabels[item.urgency] || item.urgency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── 10. SOURCES ── */}
                {allSources.length > 0 && (
                    <div className={`${styles.section} ${styles.avoidBreak}`}>
                        <div className={styles.sectionNumber}>{
                            ((ai?.data_gaps || []).length > 0 ? 8 : 7) + ((ai?.action_items || []).length > 0 ? 2 : 1)
                        }</div>
                        <h2 className={styles.sectionHeader}>Sources & Citations</h2>
                        <div className={styles.sourcesList}>
                            {allSources.map((source, idx) => (
                                <div key={idx} className={styles.sourceItem}>
                                    <span className={styles.sourceNumber}>{idx + 1}</span>
                                    <span>{source}</span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.disclaimer}>
                            This report was generated by Gap Guard&apos;s AI analysis engine. All observations are derived from the data sources listed above. AI-synthesized content is clearly marked. Agent review is required before client presentation. Report data reflects a snapshot at the time of generation and may not reflect subsequent policy changes.
                        </div>
                    </div>
                )}

                {/* ── FOOTER ── */}
                <div className={styles.footer}>
                    <div className={styles.footerBrand}>Gap Guard · Comprehensive Policy Review</div>
                    <div className={styles.footerMeta}>Report ID: {report.id?.slice(0, 8)} · Generated: {issuedDate}</div>
                </div>
            </div>
        </div>
    );
}
