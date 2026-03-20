'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReportById, PolicyReportRow } from '@/lib/api';
import styles from './page.module.css';

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

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
                    Loading Policy Report...
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '5rem 0', color: '#ef4444' }}>
                    Report not found or unavailable.
                </div>
            </div>
        );
    }

    const { data_payload: data, ai_insights: ai } = report;
    const policy = data.policy || {};
    const flags = data.flags || [];
    const enrichments = data.enrichments || [];

    const issuedDate = report.created_at ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    return (
        <div className={styles.container}>
            {/* Action Bar (Hidden when printing via CSS) */}
            <div className={styles.noPrint} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <button 
                    onClick={() => router.back()} 
                    style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                >
                    ← Back to Policy
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        onClick={() => window.print()} 
                        style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.4rem 1.25rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Save as PDF
                    </button>
                </div>
            </div>

            {/* Document Body */}
            <div className={styles.document}>
                <div className={styles.reportTitle}>
                    Comprehensive Policy Review
                </div>
                <div className={styles.reportSubtitle}>
                    Prepared for: <strong>{policy.named_insured || 'Unknown'}</strong> | Policy Number: {policy.policy_number || 'N/A'} | Report Generated: {issuedDate}
                </div>

                <div className={styles.aiBanner}>
                    <span className={styles.aiBadge}>AI-Synthesized</span>
                    This report compiles raw deterministic policy data alongside AI-inferred structural insights and recommendations. Agent review is required.
                </div>

                {/* Section 1: Executive Summary */}
                <div className={styles.section}>
                    <h2 className={styles.sectionHeader}>1. Executive Summary</h2>
                    <div className={styles.textBlock}>
                        {ai.executive_summary || "No executive summary available."}
                    </div>
                </div>

                {/* Section 2: Renewal Snapshot */}
                <div className={styles.section}>
                    <h2 className={styles.sectionHeader}>2. Renewal Snapshot</h2>
                    <div className={styles.textBlock}>
                        {ai.renewal_snapshot || "No renewal snapshot available."}
                    </div>
                </div>

                {/* Section 3: Policy Overview */}
                <div className={styles.section}>
                    <h2 className={styles.sectionHeader}>3. Policy Overview</h2>
                    <div className={styles.grid}>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Insured Location</div>
                            <div className={styles.gridValue}>{policy.property_address || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Policy Term</div>
                            <div className={styles.gridValue}>
                                {policy.effective_date} to {policy.expiration_date}
                            </div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Current Premium</div>
                            <div className={styles.gridValue}>{policy.annual_premium || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Year Built / Construction</div>
                            <div className={styles.gridValue}>
                                {policy.year_built || 'Unknown'} / {policy.construction_type || 'Unknown'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Top Findings / Key Concerns */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <h2 className={styles.sectionHeader}>4. Top Findings & Key Concerns</h2>
                    {ai.top_concerns && ai.top_concerns.length > 0 ? (
                        ai.top_concerns.map((concern: any, idx: number) => (
                            <div key={idx} className={`${styles.callout} ${styles[concern.severity] || styles.medium}`}>
                                <div className={styles.calloutTitle}>
                                    <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.8, marginRight: '0.5rem' }}>[{concern.severity}]</span>
                                    {concern.topic}
                                </div>
                                <div className={styles.calloutText}>{concern.explanation}</div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.textBlock} style={{ color: '#10b981', fontWeight: 600 }}>
                            ✓ No critical discrepancies or immediate concerns detected.
                        </div>
                    )}
                </div>

                {/* Section 5: Recommendations */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <h2 className={styles.sectionHeader}>5. Recommendations & Action Items</h2>
                    {ai.recommendations && ai.recommendations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {ai.recommendations.map((rec: any, idx: number) => (
                                <div key={idx} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', display: 'flex', alignItems: 'flex-start' }}>
                                    <span className={`${styles.actionBadge} ${styles[rec.category]}`}>
                                        {rec.category.replace('_', ' ')}
                                    </span>
                                    <span className={styles.textBlock} style={{ margin: 0, flex: 1 }}>{rec.text}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.textBlock}>None at this time.</div>
                    )}
                </div>

                <div className={styles.pageBreakBefore}></div>

                {/* Section 6: Coverage Review */}
                <div className={styles.section}>
                    <h2 className={styles.sectionHeader}>6. Current Coverage Review</h2>
                    <div className={styles.grid}>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Dwelling Limit</div>
                            <div className={styles.gridValue}>{policy.limit_dwelling || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Other Structures</div>
                            <div className={styles.gridValue}>{policy.limit_other_structures || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Personal Property</div>
                            <div className={styles.gridValue}>{policy.limit_personal_property || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Ordinance / Law</div>
                            <div className={styles.gridValue}>{policy.limit_ordinance_or_law || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Deductible</div>
                            <div className={styles.gridValue}>{policy.deductible || 'N/A'}</div>
                        </div>
                        <div className={styles.gridItem}>
                            <div className={styles.gridLabel}>Extended Replacement</div>
                            <div className={styles.gridValue}>{policy.limit_extended_replacement_cost_coverage || 'None'}</div>
                        </div>
                    </div>
                </div>

                {/* Section 7: Sourced Observations */}
                <div className={`${styles.section} ${styles.avoidBreak}`}>
                    <h2 className={styles.sectionHeader}>7. Property & Risk Observations (Sourced)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr minmax(100px, 1fr)', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>
                        <div>Key</div>
                        <div>Observation Value / Note</div>
                        <div style={{ textAlign: 'right' }}>Source</div>
                    </div>
                    {enrichments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {enrichments.map((enr: any, idx: number) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr minmax(100px, 1fr)', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#1e293b' }}>
                                    <div style={{ fontWeight: 600 }}>{enr.key.replace(/_/g, ' ')}</div>
                                    <div>
                                        {enr.value} 
                                        {enr.confidence && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{enr.confidence}</span>}
                                    </div>
                                    <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>{enr.source}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.textBlock}>No external property enrichment data fetched.</div>
                    )}
                </div>

            </div>
        </div>
    );
}
