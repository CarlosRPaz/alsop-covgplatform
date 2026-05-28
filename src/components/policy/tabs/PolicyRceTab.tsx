'use client';

import React from 'react';
import { Declaration, PropertyEnrichment, RceDocData } from '@/lib/api';
import { normalizeInputs, calculateEstimate } from '@/lib/rce/InterimEstimator';
import { InterimRceWidget } from '../InterimRceWidget';
import { Shield, FileText, AlertCircle, Home, DollarSign, Hammer, Layers, Thermometer, Warehouse, Calendar, TrendingUp } from 'lucide-react';
import styles from './PolicyRceTab.module.css';

interface PolicyRceTabProps {
    declaration: Declaration;
    enrichments?: PropertyEnrichment[];
    rceDocData?: RceDocData[];
}

/* ── Formatters ──────────────────────────────────────────────── */

function fmtCurrency(val: number | string | null | undefined): string {
    if (val == null) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function fmtNumber(val: number | string | null | undefined): string {
    if (val == null) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US').format(num);
}

function toDisplay(value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    try { return JSON.stringify(value); } catch { return '—'; }
}

/* ── Sub-components ──────────────────────────────────────────── */

function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
    const display = toDisplay(value);
    return (
        <div className={styles.field}>
            <span className={styles.fieldLabel}>{label}</span>
            <span className={`${styles.fieldValue} ${mono ? styles.mono : ''}`}>{display}</span>
        </div>
    );
}

function SectionCard({ icon, title, children, className }: {
    icon: React.ReactNode; title: string; children: React.ReactNode; className?: string;
}) {
    return (
        <div className={`${styles.card} ${className || ''}`}>
            <div className={styles.cardHeader}>
                {icon}
                <h3>{title}</h3>
            </div>
            <div className={styles.cardBody}>
                {children}
            </div>
        </div>
    );
}

/** Render structured data — handles JSONB objects, arrays, and JSON strings */
function BreakdownList({ data }: { data: unknown }) {
    if (data == null || data === '') {
        return <span className={styles.muted}>No data available</span>;
    }

    let parsed: unknown = data;
    if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch { /* keep as string */ }
    }

    if (Array.isArray(parsed)) {
        return (
            <div className={styles.breakdownList}>
                {parsed.map((item: unknown, i: number) => (
                    <div key={i} className={styles.breakdownItem}>
                        {typeof item === 'object' && item !== null
                            ? Object.entries(item)
                                .filter(([, v]) => v != null && v !== '' && v !== 0)
                                .map(([k, v]) => `${k}: ${v}`).join(' · ')
                            : String(item)
                        }
                    </div>
                ))}
            </div>
        );
    }

    if (typeof parsed === 'object' && parsed !== null) {
        return (
            <div className={styles.fieldGrid}>
                {Object.entries(parsed as Record<string, unknown>).map(([k, v], i) => (
                    <Field
                        key={i}
                        label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        value={typeof v === 'number' ? fmtCurrency(v) : v}
                    />
                ))}
            </div>
        );
    }

    return <span className={styles.muted} style={{ whiteSpace: 'pre-wrap' }}>{String(parsed)}</span>;
}


/* ── Main Component ──────────────────────────────────────────── */

export function PolicyRceTab({ declaration, enrichments = [], rceDocData = [] }: PolicyRceTabProps) {
    const policyId = declaration.policy_id || declaration.id;
    const rceInput = normalizeInputs({ id: policyId, property_address_raw: declaration.property_location }, enrichments);
    const rceEstimate = calculateEstimate(rceInput);

    const hasRceEnrichments = enrichments.some(e =>
        e.source_name === 'rce_360value' || e.source_name === 'dic_embedded_360value'
    );

    const rce = rceDocData.length > 0 ? rceDocData[0] : null;
    const hasRceDocData = rce !== null;

    return (
        <div className={styles.wrapper}>
            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
                <Shield size={20} />
                <h2>Replacement Cost Estimate</h2>
            </div>

            {/* ── Interim Widget (only when NO actual RCE) ── */}
            {!hasRceDocData && (
                <div style={{ marginBottom: '1rem' }}>
                    <InterimRceWidget estimate={rceEstimate} />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* 360Value RCE Document Data                               */}
            {/* ══════════════════════════════════════════════════════════ */}
            {hasRceDocData ? (
                <>
                    {/* ── Hero: Replacement Cost ── */}
                    <div className={styles.hero}>
                        <div className={styles.heroMain}>
                            <span className={styles.heroLabel}>Estimated Replacement Cost</span>
                            <span className={styles.heroCost}>{fmtCurrency(rce!.replacement_cost)}</span>
                            {(rce!.replacement_range_low || rce!.replacement_range_high) && (
                                <span className={styles.heroRange}>
                                    Range: {fmtCurrency(rce!.replacement_range_low)} – {fmtCurrency(rce!.replacement_range_high)}
                                </span>
                            )}
                        </div>
                        <div className={styles.heroMeta}>
                            <div className={styles.heroStat}>
                                <span className={styles.heroStatLabel}>Actual Cash Value</span>
                                <span className={styles.heroStatValue}>{fmtCurrency(rce!.actual_cash_value)}</span>
                            </div>
                            <div className={styles.heroStat}>
                                <span className={styles.heroStatLabel}>Cost / Sq Ft</span>
                                <span className={styles.heroStatValue}>{rce!.cost_per_sqft ? fmtCurrency(rce!.cost_per_sqft) : '—'}</span>
                            </div>
                            <div className={styles.heroStat}>
                                <span className={styles.heroStatLabel}>Quality Grade</span>
                                <span className={styles.heroStatValue}>{rce!.quality_grade || '—'}</span>
                            </div>
                            <div className={styles.heroStat}>
                                <span className={styles.heroStatLabel}>ACV Condition</span>
                                <span className={styles.heroStatValue}>{rce!.acv_condition || '—'}{rce!.acv_age ? ` (Age: ${rce!.acv_age})` : ''}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Property Overview ── */}
                    <SectionCard
                        icon={<Home size={15} style={{ color: '#6366f1' }} />}
                        title="Property Overview"
                    >
                        <div className={styles.fieldGrid}>
                            <Field label="Square Feet" value={rce!.sq_feet ? fmtNumber(rce!.sq_feet) : null} mono />
                            <Field label="Stories" value={rce!.stories} />
                            <Field label="Year Built" value={rce!.year_built} mono />
                            <Field label="Use Type" value={rce!.use_type} />
                            <Field label="Style" value={rce!.style} />
                            <Field label="Site Access" value={rce!.site_access} />
                            <Field label="Property Slope" value={rce!.property_slope} />
                        </div>
                    </SectionCard>

                    {/* ── Construction: Roof / Foundation / Walls ── */}
                    <div className={styles.triGrid}>
                        <SectionCard
                            icon={<Layers size={15} style={{ color: '#f59e0b' }} />}
                            title="Roof"
                        >
                            <Field label="Year" value={rce!.roof_year} />
                            <Field label="Cover" value={rce!.roof_cover} />
                            <Field label="Shape" value={rce!.roof_shape} />
                            <Field label="Construction" value={rce!.roof_construction} />
                            <Field label="Dormers" value={rce!.num_dormers} />
                        </SectionCard>

                        <SectionCard
                            icon={<Hammer size={15} style={{ color: '#8b5cf6' }} />}
                            title="Foundation"
                        >
                            <Field label="Shape" value={rce!.foundation_shape} />
                            <Field label="Material" value={rce!.foundation_material} />
                            <Field label="Type" value={rce!.foundation_type} />
                        </SectionCard>

                        <SectionCard
                            icon={<Hammer size={15} style={{ color: '#06b6d4' }} />}
                            title="Walls"
                        >
                            <Field label="Finish" value={rce!.wall_finish} />
                            <Field label="Construction" value={rce!.wall_construction} />
                            <Field label="Avg Height" value={rce!.avg_wall_height} />
                        </SectionCard>
                    </div>

                    {/* ── Interior ── */}
                    <SectionCard
                        icon={<Home size={15} style={{ color: '#ec4899' }} />}
                        title="Interior"
                    >
                        <div className={styles.fieldGrid}>
                            <Field label="Floor Coverings" value={rce!.floor_coverings} />
                            <Field label="Ceiling Finish" value={rce!.ceiling_finish} />
                            <Field label="Wall Material" value={rce!.interior_wall_material} />
                            <Field label="Wall Finish" value={rce!.interior_wall_finish} />
                        </div>
                        {!!rce!.rooms && (
                            <div className={styles.subSection}>
                                <span className={styles.subSectionLabel}>Rooms</span>
                                <BreakdownList data={rce!.rooms} />
                            </div>
                        )}
                    </SectionCard>

                    {/* ── Systems & Extras ── */}
                    <div className={styles.dualGrid}>
                        <SectionCard
                            icon={<Thermometer size={15} style={{ color: '#ef4444' }} />}
                            title="Systems"
                        >
                            <Field label="Heating" value={rce!.heating} />
                            <Field label="Air Conditioning" value={rce!.air_conditioning} />
                            <Field label="Fireplace" value={rce!.fireplace_info} />
                        </SectionCard>

                        <SectionCard
                            icon={<Warehouse size={15} style={{ color: '#14b8a6' }} />}
                            title="Additional Structures"
                        >
                            <Field label="Garage" value={rce!.garage_info} />
                            <Field label="Porch" value={rce!.porch_info} />
                            {!!rce!.home_features && (
                                <div className={styles.subSection}>
                                    <span className={styles.subSectionLabel}>Home Features</span>
                                    <BreakdownList data={rce!.home_features} />
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* ── Cost Breakdown ── */}
                    {!!rce!.cost_breakdown && (
                        <SectionCard
                            icon={<TrendingUp size={15} style={{ color: '#22c55e' }} />}
                            title="Cost Breakdown"
                        >
                            <BreakdownList data={rce!.cost_breakdown} />
                        </SectionCard>
                    )}

                    {/* ── Document Info (compact footer) ── */}
                    <div className={styles.docInfo}>
                        <Calendar size={12} />
                        <span>
                            {[
                                rce!.valuation_id && `ID: ${rce!.valuation_id}`,
                                rce!.date_calculated && `Calculated: ${rce!.date_calculated}`,
                                rce!.date_entered && `Entered: ${rce!.date_entered}`,
                                rce!.created_by && `By: ${rce!.created_by}`,
                                rce!.file_name && `File: ${rce!.file_name}`,
                            ].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                </>
            ) : (
                /* ── No RCE Doc Data — Enrichment fallback ── */
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <FileText size={15} />
                        <h3>RCE Data Sources</h3>
                    </div>
                    <div className={styles.cardBody}>
                        {hasRceEnrichments ? (
                            <div className={styles.fieldGrid}>
                                {enrichments
                                    .filter(e => e.source_name === 'rce_360value' || e.source_name === 'dic_embedded_360value')
                                    .map(e => (
                                        <Field
                                            key={e.field_key}
                                            label={e.field_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                            value={e.field_value || '—'}
                                        />
                                    ))}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>
                                <AlertCircle size={16} />
                                <div>
                                    <strong>No standalone RCE document uploaded.</strong> Upload a certified 360Value or
                                    e2Value RCE document via the Files tab for an authoritative replacement cost figure.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
