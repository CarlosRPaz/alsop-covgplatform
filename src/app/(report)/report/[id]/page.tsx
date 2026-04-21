'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReportById, PolicyReportRow } from '@/lib/api';
import styles from './page.module.css';

/* ── Helpers ── */
const SEVERITY_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const ADEQUACY_CONFIG: Record<string, { label: string; cls: string }> = {
    adequate: { label: 'Adequate', cls: 'adeqOk' },
    review:   { label: 'Review',   cls: 'adeqReview' },
    gap:      { label: 'Gap',      cls: 'adeqGap' },
    unknown:  { label: '—',        cls: 'adeqUnknown' },
};

/** Only keep real named sources — filter out generic internal labels. */
const INTERNAL_SOURCES = new Set([
    'enrichment', 'policy', 'flag_engine', 'inferred', 'analysis',
    'automated review', 'policy declaration', 'internal',
]);

function fmtDate(d: string | null | undefined): string {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
}

function fmtCurrency(v: string | number | null | undefined): string {
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
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (!id) return;
        getReportById(id).then(data => { setReport(data || null); setLoading(false); });
    }, [id]);

    const ai = report?.ai_insights;
    const data = report?.data_payload;
    const policy = data?.policy || {};
    const flags = data?.flags || [];
    const enrichments = data?.enrichments || [];

    // Sort concerns by severity
    const sortedConcerns = useMemo(() =>
        [...(ai?.top_concerns || [])].sort((a: any, b: any) => {
            const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
            return (ord[a.severity] ?? 9) - (ord[b.severity] ?? 9);
        }), [ai?.top_concerns]);

    // Merge recommendations + action_items + data_gaps into unified Next Steps
    const nextSteps = useMemo(() => {
        const steps: Array<{ text: string; group: string; type?: string; priority?: number }> = [];

        // From recommendations
        (ai?.recommendations || []).forEach((r: any) => {
            const urgency = r.priority === 1 ? 'review_now' : r.priority === 2 ? 'at_renewal' : 'confirm';
            steps.push({ text: r.text, group: urgency, type: r.category, priority: r.priority });
        });

        // From action_items
        (ai?.action_items || []).forEach((item: any) => {
            const urgency = item.urgency === 'before_renewal' ? 'review_now'
                : item.urgency === 'at_renewal' ? 'at_renewal' : 'confirm';
            // Deduplicate with recommendations by checking text similarity
            const isDuplicate = steps.some(s =>
                s.text.toLowerCase().includes(item.item.toLowerCase().slice(0, 30)) ||
                item.item.toLowerCase().includes(s.text.toLowerCase().slice(0, 30))
            );
            if (!isDuplicate) {
                steps.push({ text: item.item, group: urgency, type: item.type });
            }
        });

        // From data_gaps
        (ai?.data_gaps || []).forEach((gap: any) => {
            steps.push({ text: `${gap.field}: ${gap.suggestion}`, group: 'confirm', type: 'verify' });
        });

        return steps;
    }, [ai]);

    const groupedSteps = useMemo(() => {
        const groups: Record<string, typeof nextSteps> = {};
        nextSteps.forEach(s => {
            if (!groups[s.group]) groups[s.group] = [];
            groups[s.group].push(s);
        });
        return groups;
    }, [nextSteps]);

    // Filter sources to real named tools only
    const realSources = useMemo(() => {
        const s = new Set<string>();
        enrichments.forEach((e: any) => { if (e.source && !INTERNAL_SOURCES.has(e.source.toLowerCase())) s.add(e.source); });
        (ai?.property_observations || []).forEach((o: any) => {
            if (o.source && !INTERNAL_SOURCES.has(o.source.toLowerCase())) s.add(o.source);
        });
        return Array.from(s).sort();
    }, [enrichments, ai]);

    const issuedDate = report?.created_at
        ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';

    const handleRegenerate = async () => {
        if (!report?.policy_id) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policyId: report.policy_id })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.report) {
                    router.push(`/report/${data.report.id}`);
                }
            } else {
                alert('Failed to regenerate report');
            }
        } catch (e) {
            console.error(e);
            alert('Error generating report');
        } finally {
            setIsGenerating(false);
        }
    };

    // Early returns AFTER all hooks
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading Report…</div>
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

    const GROUP_LABELS: Record<string, { title: string; color: string }> = {
        review_now: { title: 'Review Now', color: '#ef4444' },
        at_renewal: { title: 'Discuss at Renewal', color: '#f59e0b' },
        confirm: { title: 'Confirm & Update', color: '#3b82f6' },
    };

    return (
        <div className={styles.container}>
            {/* Action Bar (hidden in print) */}
            <div className={styles.actionBar}>
                <button onClick={() => router.back()} className={styles.backBtn}>← Back</button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        onClick={handleRegenerate} 
                        disabled={isGenerating} 
                        style={{ padding: '0.4rem 0.8rem', cursor: isGenerating ? 'wait' : 'pointer', background: 'var(--bg-surface-raised)', color: 'var(--text-high)', border: '1px solid var(--border-default)', borderRadius: '4px' }}
                    >
                        {isGenerating ? 'Regenerating...' : 'Regenerate Analysis'}
                    </button>
                    <button onClick={() => window.print()} className={styles.printBtn}>Save as PDF</button>
                </div>
            </div>

            {/* ════ DOCUMENT ════ */}
            <div className={styles.document}>

                {/* ── HEADER ── */}
                <header className={styles.header}>
                    <div className={styles.headerTop}>
                        <div className={styles.brand}>
                            <div className={styles.brandMark}>CCN</div>
                            <span className={styles.brandName}>CoverageCheckNow</span>
                        </div>
                        <div className={styles.headerDate}>{issuedDate}</div>
                    </div>
                    <h1 className={styles.reportTitle}>Coverage Analysis Report</h1>
                    <div className={styles.headerMeta}>
                        <div className={styles.metaChip}>
                            <span className={styles.metaLabel}>Prepared for</span>
                            <span className={styles.metaValue}>{policy.named_insured || 'Unknown'}</span>
                        </div>
                        <div className={styles.metaChip}>
                            <span className={styles.metaLabel}>Policy</span>
                            <span className={styles.metaValue}>{policy.policy_number || 'N/A'}</span>
                        </div>
                        <div className={styles.metaChip}>
                            <span className={styles.metaLabel}>Carrier</span>
                            <span className={styles.metaValue}>{policy.carrier_name || 'N/A'}</span>
                        </div>
                        <div className={styles.metaChip}>
                            <span className={styles.metaLabel}>Term</span>
                            <span className={styles.metaValue}>{fmtDate(policy.effective_date)} → {fmtDate(policy.expiration_date)}</span>
                        </div>
                        <div className={styles.metaChip}>
                            <span className={styles.metaLabel}>Premium</span>
                            <span className={styles.metaValue}>{fmtCurrency(policy.annual_premium)}</span>
                        </div>
                    </div>
                </header>

                {/* ── 1. EXECUTIVE SUMMARY ── */}
                <section className={styles.section}>
                    <div className={styles.sectionLabel}>Summary</div>
                    <div className={styles.summaryCard}>
                        {ai?.executive_summary || 'No executive summary available.'}
                    </div>
                    {ai?.renewal_snapshot && (
                        <p className={styles.snapshotNote}>{ai.renewal_snapshot}</p>
                    )}
                </section>

                {/* ── 2. KEY FINDINGS ── */}
                {sortedConcerns.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionLabel}>Key Findings</div>
                        <div className={styles.findingsGrid}>
                            {sortedConcerns.map((c: any, i: number) => (
                                <div key={i} className={`${styles.finding} ${styles[`sev_${c.severity}`] || ''}`}>
                                    <div className={styles.findingTop}>
                                        <span className={`${styles.sevDot} ${styles[`dot_${c.severity}`]}`} />
                                        <span className={styles.findingHeadline}>{c.topic}</span>
                                        <span className={`${styles.sevTag} ${styles[`tag_${c.severity}`]}`}>
                                            {SEVERITY_LABEL[c.severity] || c.severity}
                                        </span>
                                    </div>
                                    <p className={styles.findingBody}>{c.explanation}</p>
                                    {c.evidence && (
                                        <p className={styles.findingEvidence}>{c.evidence}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── 3. COVERAGE REVIEW ── */}
                <section className={`${styles.section} ${styles.avoidBreak}`}>
                    <div className={styles.sectionLabel}>Coverage Review</div>
                    <table className={styles.covTable}>
                        <thead>
                            <tr>
                                <th>Coverage</th>
                                <th>Limit</th>
                                <th>Status</th>
                                <th>Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { label: 'Dwelling (A)', value: policy.limit_dwelling },
                                { label: 'Other Structures (B)', value: policy.limit_other_structures },
                                { label: 'Personal Property (C)', value: policy.limit_personal_property },
                                { label: 'Loss of Use (D)', value: policy.limit_loss_of_use },
                                { label: 'Medical Payments', value: policy.limit_medical_payments },
                                { label: 'Ordinance or Law', value: policy.limit_ordinance_or_law },
                                { label: 'Extended Replacement', value: policy.limit_extended_replacement_cost_coverage },
                                { label: 'Deductible', value: policy.deductible },
                            ].map((cov, i) => {
                                const aiRow = (ai?.coverage_review || []).find(
                                    (c: any) => c.coverage?.toLowerCase().includes(cov.label.split(' (')[0].toLowerCase())
                                );
                                const adeq = ADEQUACY_CONFIG[aiRow?.adequacy] || ADEQUACY_CONFIG.unknown;
                                return (
                                    <tr key={i}>
                                        <td className={styles.covName}>{cov.label}</td>
                                        <td className={styles.covValue}>
                                            {cov.value ? fmtCurrency(cov.value) : <span className={styles.noData}>Not on file</span>}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusDot} ${styles[adeq.cls]}`}>
                                                {adeq.label}
                                            </span>
                                        </td>
                                        <td className={styles.covNote}>{aiRow?.observation || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>

                {/* ── 4. NEXT STEPS ── */}
                {nextSteps.length > 0 && (
                    <section className={`${styles.section} ${styles.avoidBreak}`}>
                        <div className={styles.sectionLabel}>Next Steps</div>
                        <div className={styles.stepsContainer}>
                            {(['review_now', 'at_renewal', 'confirm'] as const).map(groupKey => {
                                const items = groupedSteps[groupKey];
                                if (!items || items.length === 0) return null;
                                const cfg = GROUP_LABELS[groupKey];
                                return (
                                    <div key={groupKey} className={styles.stepGroup}>
                                        <div className={styles.stepGroupHeader}>
                                            <span className={styles.stepGroupDot} style={{ background: cfg.color }} />
                                            <span className={styles.stepGroupTitle}>{cfg.title}</span>
                                            <span className={styles.stepGroupCount}>{items.length}</span>
                                        </div>
                                        <div className={styles.stepList}>
                                            {items.map((step, idx) => (
                                                <div key={idx} className={styles.stepItem}>
                                                    <div className={styles.stepCheck} />
                                                    <span className={styles.stepText}>{step.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── 5. FOOTER ── */}
                <footer className={styles.footer}>
                    {realSources.length > 0 && (
                        <div className={styles.footerSources}>
                            <span className={styles.footerSourcesLabel}>Sources:</span>
                            {realSources.map((s, i) => (
                                <span key={i} className={styles.sourceChip}>{s}</span>
                            ))}
                        </div>
                    )}
                    <div className={styles.disclaimer}>
                        This report was generated by CoverageCheckNow&apos;s analysis engine. Observations are derived from the data sources listed above. Report data reflects a snapshot at the time of generation.
                    </div>
                    <div className={styles.footerBottom}>
                        <span className={styles.footerBrand}>CoverageCheckNow</span>
                        <span className={styles.footerId}>Report {report.id?.slice(0, 8)}</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
