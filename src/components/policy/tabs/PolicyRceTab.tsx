'use client';

import React from 'react';
import { Declaration, PropertyEnrichment, RceDocData } from '@/lib/api';
import { normalizeInputs, calculateEstimate } from '@/lib/rce/InterimEstimator';
import { InterimRceWidget } from '../InterimRceWidget';
import { Shield, FileText, AlertCircle, Home, DollarSign, Hammer, Layers, Thermometer, Warehouse, Calendar, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card/Card';
import styles from '../PolicyDashboard.module.css';

interface PolicyRceTabProps {
    declaration: Declaration;
    enrichments?: PropertyEnrichment[];
    rceDocData?: RceDocData[];
}

/** Format a number as currency */
function fmtCurrency(val: number | string | null | undefined): string {
    if (val == null) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

/** Format a number with commas */
function fmtNumber(val: number | string | null | undefined): string {
    if (val == null) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US').format(num);
}

/** Safely convert any value to a display string */
function toDisplayString(value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    // Objects/arrays — compact JSON representation
    try { return JSON.stringify(value); } catch { return '—'; }
}

/** Render a field row */
function Field({ label, value }: { label: string; value: unknown }) {
    const display = toDisplayString(value);
    return (
        <div className={styles.field}>
            <label>{label}</label>
            <span>{display}</span>
        </div>
    );
}

/** Render structured data — handles both pre-parsed objects (JSONB) and JSON strings */
function BreakdownList({ data }: { data: unknown }) {
    if (data == null || data === '') {
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No data available</span>;
    }

    // Normalize: if already an object, use directly; if string, try parsing
    let parsed: unknown = data;
    if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch { /* keep as string */ }
    }

    // Render arrays
    if (Array.isArray(parsed)) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {parsed.map((item: unknown, i: number) => (
                    <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {typeof item === 'object' && item !== null
                            ? Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' · ')
                            : String(item)
                        }
                    </div>
                ))}
            </div>
        );
    }

    // Render plain objects
    if (typeof parsed === 'object' && parsed !== null) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {Object.entries(parsed as Record<string, unknown>).map(([k, v], i) => (
                    <div key={i} className={styles.field}>
                        <label>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                        <span>{typeof v === 'number' ? fmtCurrency(v) : String(v ?? '—')}</span>
                    </div>
                ))}
            </div>
        );
    }

    // Fallback: plain text
    return <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{String(parsed)}</span>;
}

export function PolicyRceTab({ declaration, enrichments = [], rceDocData = [] }: PolicyRceTabProps) {
    const policyId = declaration.policy_id || declaration.id;
    const rceInput = normalizeInputs({ id: policyId, property_address_raw: declaration.property_location }, enrichments);
    const rceEstimate = calculateEstimate(rceInput);

    // Check if we have any uploaded RCE documents via enrichments
    const hasRceEnrichments = enrichments.some(e =>
        e.source_name === 'rce_360value' || e.source_name === 'dic_embedded_360value'
    );

    // Use the first (most recent) RCE doc data record
    const rce = rceDocData.length > 0 ? rceDocData[0] : null;
    const hasRceDocData = rce !== null;

    return (
        <div className={styles.container}>
            <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} style={{ color: '#3b82f6' }} />
                Replacement Cost Estimate (RCE)
            </h2>

            <div style={{ maxWidth: '900px' }}>
                {/* Interim RCE Widget — the modeled estimate */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <InterimRceWidget estimate={rceEstimate} />
                </div>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* 360Value RCE Document Data                               */}
                {/* ══════════════════════════════════════════════════════════ */}
                {hasRceDocData ? (
                    <>
                        {/* Source Banner */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.65rem 1rem',
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(59, 130, 246, 0.06))',
                            borderRadius: '8px',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            marginBottom: '1rem',
                        }}>
                            <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-high)' }}>
                                    360Value RCE Document Loaded
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                                    {rce!.file_name || 'RCE Report'} · {rce!.date_calculated || rce!.date_entered || new Date(rce!.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* ── Replacement Cost Summary ── */}
                        <Card className={styles.card} style={{ marginBottom: '1rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <DollarSign size={16} style={{ color: '#22c55e' }} />
                                Replacement Cost Summary
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '0.25rem 2rem',
                            }}>
                                <Field label="Replacement Cost" value={fmtCurrency(rce!.replacement_cost)} />
                                <Field label="Range (Low)" value={fmtCurrency(rce!.replacement_range_low)} />
                                <Field label="Range (High)" value={fmtCurrency(rce!.replacement_range_high)} />
                                <Field label="Actual Cash Value" value={fmtCurrency(rce!.actual_cash_value)} />
                                <Field label="Cost per Sq Ft" value={rce!.cost_per_sqft ? fmtCurrency(rce!.cost_per_sqft) : '—'} />
                                <Field label="ACV Age" value={rce!.acv_age} />
                                <Field label="ACV Condition" value={rce!.acv_condition} />
                                <Field label="Quality Grade" value={rce!.quality_grade} />
                            </div>
                        </Card>

                        {/* ── Property Overview ── */}
                        <Card className={styles.card} style={{ marginBottom: '1rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Home size={16} style={{ color: '#6366f1' }} />
                                Property Overview
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '0.25rem 2rem',
                            }}>
                                <Field label="Square Feet" value={rce!.sq_feet ? fmtNumber(rce!.sq_feet) : null} />
                                <Field label="Stories" value={rce!.stories} />
                                <Field label="Year Built" value={rce!.year_built} />
                                <Field label="Use Type" value={rce!.use_type} />
                                <Field label="Style" value={rce!.style} />
                                <Field label="Site Access" value={rce!.site_access} />
                                <Field label="Property Slope" value={rce!.property_slope} />
                            </div>
                        </Card>

                        {/* ── Construction Details ── */}
                        <div className={styles.grid} style={{ marginBottom: '1rem' }}>
                            {/* Roof */}
                            <Card className={styles.card}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Layers size={16} style={{ color: '#f59e0b' }} />
                                    Roof
                                </h3>
                                <Field label="Roof Year" value={rce!.roof_year} />
                                <Field label="Roof Cover" value={rce!.roof_cover} />
                                <Field label="Roof Shape" value={rce!.roof_shape} />
                                <Field label="Roof Construction" value={rce!.roof_construction} />
                                <Field label="Dormers" value={rce!.num_dormers} />
                            </Card>

                            {/* Foundation */}
                            <Card className={styles.card}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Hammer size={16} style={{ color: '#8b5cf6' }} />
                                    Foundation
                                </h3>
                                <Field label="Shape" value={rce!.foundation_shape} />
                                <Field label="Material" value={rce!.foundation_material} />
                                <Field label="Type" value={rce!.foundation_type} />
                            </Card>

                            {/* Walls */}
                            <Card className={styles.card}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Hammer size={16} style={{ color: '#06b6d4' }} />
                                    Walls
                                </h3>
                                <Field label="Wall Finish" value={rce!.wall_finish} />
                                <Field label="Wall Construction" value={rce!.wall_construction} />
                                <Field label="Avg Wall Height" value={rce!.avg_wall_height} />
                            </Card>
                        </div>

                        {/* ── Interior ── */}
                        <Card className={styles.card} style={{ marginBottom: '1rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Home size={16} style={{ color: '#ec4899' }} />
                                Interior
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '0.25rem 2rem',
                            }}>
                                <Field label="Floor Coverings" value={rce!.floor_coverings} />
                                <Field label="Ceiling Finish" value={rce!.ceiling_finish} />
                                <Field label="Interior Wall Material" value={rce!.interior_wall_material} />
                                <Field label="Interior Wall Finish" value={rce!.interior_wall_finish} />
                            </div>
                            {!!rce!.rooms && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '0.4rem' }}>
                                        Rooms
                                    </label>
                                    <BreakdownList data={rce!.rooms} />
                                </div>
                            )}
                        </Card>

                        {/* ── Systems & Extras ── */}
                        <div className={styles.grid} style={{ marginBottom: '1rem' }}>
                            {/* Systems */}
                            <Card className={styles.card}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Thermometer size={16} style={{ color: '#ef4444' }} />
                                    Systems
                                </h3>
                                <Field label="Heating" value={rce!.heating} />
                                <Field label="Air Conditioning" value={rce!.air_conditioning} />
                                <Field label="Fireplace" value={rce!.fireplace_info} />
                            </Card>

                            {/* Extras */}
                            <Card className={styles.card}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Warehouse size={16} style={{ color: '#14b8a6' }} />
                                    Additional Structures
                                </h3>
                                <Field label="Garage" value={rce!.garage_info} />
                                <Field label="Porch" value={rce!.porch_info} />
                                {!!rce!.home_features && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '0.25rem' }}>
                                            Home Features
                                        </label>
                                        <BreakdownList data={rce!.home_features} />
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* ── Cost Breakdown ── */}
                        {!!rce!.cost_breakdown && (
                            <Card className={styles.card} style={{ marginBottom: '1rem' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <DollarSign size={16} style={{ color: '#22c55e' }} />
                                    Cost Breakdown
                                </h3>
                                <BreakdownList data={rce!.cost_breakdown} />
                            </Card>
                        )}

                        {/* ── Document Metadata ── */}
                        <Card className={styles.card} style={{ marginBottom: '1rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                                Document Info
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '0.25rem 2rem',
                            }}>
                                <Field label="Valuation ID" value={rce!.valuation_id} />
                                <Field label="Date Entered" value={rce!.date_entered} />
                                <Field label="Date Calculated" value={rce!.date_calculated} />
                                <Field label="Created By" value={rce!.created_by} />
                                <Field label="Source File" value={rce!.file_name} />
                            </div>
                        </Card>
                    </>
                ) : (
                    /* ── No RCE Doc Data — Enrichment fallback ── */
                    <Card className={styles.card}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} />
                            RCE Data Sources
                        </h3>
                        
                        {hasRceEnrichments ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {enrichments
                                    .filter(e => e.source_name === 'rce_360value' || e.source_name === 'dic_embedded_360value')
                                    .map(e => (
                                        <div key={e.field_key} className={styles.field}>
                                            <label>{e.field_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:</label>
                                            <span>{e.field_value || '—'}</span>
                                        </div>
                                    ))}
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                    Source: 360Value data {enrichments.some(e => e.source_name === 'dic_embedded_360value') ? '(embedded in DIC dec page)' : '(standalone upload)'}
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                background: 'rgba(59, 130, 246, 0.05)',
                                borderRadius: '6px',
                                border: '1px solid rgba(59, 130, 246, 0.1)',
                            }}>
                                <AlertCircle size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <strong>No standalone RCE document uploaded.</strong> The estimate above is a modeled
                                    interim calculation based on enrichment data. Upload a certified 360Value or e2Value RCE
                                    document via the Files tab for an authoritative replacement cost figure.
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
