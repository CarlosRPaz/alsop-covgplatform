'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Declaration, PolicyDetail, PropertyEnrichment, getLatestReportForPolicy, PolicyReportRow, getManualOverridesForPolicy, upsertManualOverride } from '@/lib/api';
import { EditableValue } from '@/components/ui/EditableValue';
import { RefreshCw, ShieldCheck, Home } from 'lucide-react';
import { Card } from '@/components/ui/Card/Card';
import styles from '../PolicyDashboard.module.css';

interface PolicyOverviewTabProps {
    declaration: Declaration;
    policyDetail?: PolicyDetail;
    enrichments?: PropertyEnrichment[];
}

/** Format YYYY-MM-DD or ISO date to MM/DD/YYYY */
function fmtDate(raw: string | null | undefined): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw;
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
        return raw;
    }
}

export function PolicyOverviewTab({ declaration, policyDetail, enrichments = [] }: PolicyOverviewTabProps) {
    const router = useRouter();
    const [report, setReport] = useState<PolicyReportRow | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [hasPendingEdits, setHasPendingEdits] = useState(false);

    React.useEffect(() => {
        const policyId = declaration.policy_id || declaration.id;
        if (policyId) {
            getLatestReportForPolicy(policyId).then(data => { if (data) setReport(data); });
            getManualOverridesForPolicy(policyId).then(setOverrides);
        }
    }, [declaration.policy_id, declaration.id]);

    const handleOverrideSave = async (fieldName: string, newValue: string, originalValue: string) => {
        const policyId = declaration.policy_id || declaration.id;
        if (!policyId) return false;
        const res = await upsertManualOverride(policyId, fieldName, newValue, originalValue);
        if (res.success) {
            setOverrides(prev => ({ ...prev, [fieldName]: newValue }));
            setHasPendingEdits(true);
            return true;
        }
        return false;
    };

    const getVal = (fieldName: string, original: string | null | undefined): string => {
        return overrides[fieldName] || original || '';
    };

    const handleGenerateReport = async () => {
        setIsGenerating(true);
        try {
            const policyId = declaration.policy_id || declaration.id;
            const res = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policyId }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.report) router.push(`/report/${data.report.id}`);
            }
        } catch (e) { console.error(e); }
        finally { setIsGenerating(false); }
    };

    const hasDic = declaration.dic_exists || !!declaration.dic_limit_dwelling;

    return (
        <div className={styles.container}>
            {/* Header row with report actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Policy Overview</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {hasPendingEdits && (
                        <button onClick={handleGenerateReport} disabled={isGenerating}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: 'var(--status-warning)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {isGenerating ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                            {isGenerating ? 'Regenerating...' : 'Regenerate Analysis'}
                        </button>
                    )}
                    {report ? (
                        <>
                            <button onClick={() => router.push(`/report/${report.id}`)}
                                style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                                View Latest Report
                            </button>
                            <button onClick={handleGenerateReport} disabled={isGenerating}
                                style={{ background: 'transparent', color: 'var(--text-mid)', border: '1px solid var(--border-default)', padding: '0.4rem 1rem', borderRadius: 'var(--radius-sm)', cursor: isGenerating ? 'wait' : 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                                {isGenerating ? 'Generating...' : 'Regenerate'}
                            </button>
                        </>
                    ) : (
                        <button onClick={handleGenerateReport} disabled={isGenerating}
                            style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-sm)', cursor: isGenerating ? 'wait' : 'pointer', fontWeight: 600 }}>
                            {isGenerating ? 'Generating...' : 'Generate Review Report'}
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Coverage Limits — TWO SEPARATE VERTICAL CARDS SIDE BY SIDE    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* FAIR Plan Coverage Limits Card */}
                <Card className={styles.card}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', background: 'rgba(79, 70, 229, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            FAIR PLAN
                        </span>
                        Coverage Limits
                    </h3>
                    {[
                        { label: 'Dwelling (Cov A)', field: 'limit_dwelling', val: declaration.limit_dwelling },
                        { label: 'Other Structures (Cov B)', field: 'limit_other_structures', val: declaration.limit_other_structures },
                        { label: 'Personal Property (Cov C)', field: 'limit_personal_property', val: declaration.limit_personal_property },
                        { label: 'Fair Rental Value', field: 'limit_fair_rental_value', val: declaration.limit_fair_rental_value },
                        { label: 'Ordinance or Law', field: 'limit_ordinance_or_law', val: declaration.limit_ordinance_or_law },
                        { label: 'Debris Removal', field: 'limit_debris_removal', val: declaration.limit_debris_removal },
                        { label: 'Deductible', field: 'deductible', val: declaration.deductible },
                    ].map(item => (
                        <div key={item.field} className={styles.field}>
                            <label>{item.label}:</label>
                            <EditableValue
                                value={getVal(item.field, item.val)}
                                originalValue={item.val}
                                onSave={(v) => handleOverrideSave(item.field, v, item.val || '')}
                                label={item.label}
                            />
                        </div>
                    ))}
                    <div className={styles.field} style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem' }}>
                        <label>Annual Premium:</label>
                        <span className={styles.premium}>{policyDetail?.annual_premium || declaration.total_annual_premium || '—'}</span>
                    </div>
                </Card>

                {/* DIC Coverage Limits Card */}
                <Card className={styles.card} style={{ borderLeft: hasDic ? '3px solid #10b981' : '3px solid var(--border-default)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: hasDic ? '#10b981' : 'var(--text-muted)', background: hasDic ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 114, 128, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            DIC
                        </span>
                        Coverage Limits
                    </h3>
                    {hasDic ? (
                        <>
                            {declaration.dic_company && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                    Carrier: <strong style={{ color: 'var(--text-primary)' }}>{declaration.dic_company}</strong>
                                    {declaration.dic_policy_number && <> · #{declaration.dic_policy_number}</>}
                                </div>
                            )}
                            {[
                                { label: 'Dwelling (Cov A)', val: declaration.dic_limit_dwelling },
                                { label: 'Other Structures (Cov B)', val: declaration.dic_limit_other_structures },
                                { label: 'Personal Property (Cov C)', val: declaration.dic_limit_personal_property },
                                { label: 'Loss of Use (Cov E)', val: declaration.dic_limit_loss_of_use },
                                { label: 'Deductible', val: declaration.dic_deductible },
                            ].map((item, idx) => (
                                <div key={idx} className={styles.field}>
                                    <label>{item.label}:</label>
                                    <span>{item.val || '—'}</span>
                                </div>
                            ))}
                            <div className={styles.field} style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem' }}>
                                <label>Annual Premium:</label>
                                <span className={styles.premium}>
                                    {declaration.dic_annual_premium_raw != null
                                        ? `$${Number(declaration.dic_annual_premium_raw).toLocaleString()}`
                                        : '—'}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem 1rem',
                            textAlign: 'center',
                            gap: '0.75rem',
                            flex: 1,
                        }}>
                            <ShieldCheck size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                No DIC policy linked
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                                Upload a DIC dec page or toggle &quot;DIC Exists&quot; in Edit Policy
                            </span>
                        </div>
                    )}
                </Card>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Bottom Row: Remaining cards in standard grid                   */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className={styles.grid}>
                {/* Property Details */}
                <Card className={styles.card}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Home size={16} style={{ color: 'var(--text-accent)' }} />
                        Property Details
                    </h3>
                    <div className={styles.field}>
                        <label>Year Built:</label>
                        <span>{declaration.year_built > 0 ? declaration.year_built : '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Construction Type:</label>
                        <span>{declaration.construction_type && declaration.construction_type !== 'Unknown' ? declaration.construction_type : '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Occupancy:</label>
                        <span>{declaration.occupancy && declaration.occupancy !== 'Unknown' ? declaration.occupancy : '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Units:</label>
                        <span>{declaration.number_of_units > 0 ? declaration.number_of_units : '—'}</span>
                    </div>
                </Card>

                {/* Status & Policy Period */}
                <Card className={styles.card}>
                    <h3>Status &amp; Policy Period</h3>
                    <div className={styles.field}>
                        <label>Status:</label>
                        <span className={`${styles.status} ${styles[declaration.status.toLowerCase().replace(' ', '')]}`}>
                            {declaration.status}
                        </span>
                    </div>
                    <div className={styles.field}>
                        <label>Effective:</label>
                        <span>{fmtDate(declaration.policy_period_start)}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Expiration:</label>
                        <span>{fmtDate(declaration.policy_period_end)}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Date Issued:</label>
                        <span>{fmtDate(declaration.date_issued)}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Renewal Date:</label>
                        <span>{fmtDate(declaration.renewal_date)}</span>
                    </div>
                </Card>

                {/* Perils Insured Against */}
                <Card className={styles.card}>
                    <h3>Perils Insured Against</h3>
                    <div className={styles.field}>
                        <label>Fire, Lightning &amp; Smoke Damage:</label>
                        <span>{declaration.cb_fire_lightning_smoke_damage || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Extended Coverages:</label>
                        <span>{declaration.cb_extended_coverages || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Vandalism &amp; Malicious Mischief:</label>
                        <span>{declaration.cb_vandalism_malicious_mischief || '—'}</span>
                    </div>
                </Card>

                {/* Mortgagee Info */}
                {(declaration.mortgagee_1_name || declaration.mortgagee_2_name) && (
                    <Card className={styles.card}>
                        <h3>Mortgagees</h3>
                        {declaration.mortgagee_1_name && (
                            <>
                                <div className={styles.field}><label>1st Mortgagee:</label><span>{declaration.mortgagee_1_name}</span></div>
                                <div className={styles.field}><label>Address:</label><span>{declaration.mortgagee_1_address || '—'}</span></div>
                            </>
                        )}
                        {declaration.mortgagee_2_name && (
                            <>
                                <div className={styles.field} style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem' }}>
                                    <label>2nd Mortgagee:</label><span>{declaration.mortgagee_2_name}</span>
                                </div>
                                <div className={styles.field}><label>Address:</label><span>{declaration.mortgagee_2_address || '—'}</span></div>
                            </>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
