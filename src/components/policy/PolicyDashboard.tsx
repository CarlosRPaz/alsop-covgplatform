'use client';

import { useRouter } from 'next/navigation';
import { Declaration, PropertyEnrichment } from '@/lib/api';
import styles from './PolicyDashboard.module.css';
import { Card } from '../ui/Card/Card';

interface PolicyDashboardProps {
    declaration: Declaration;
    enrichments?: PropertyEnrichment[];
}

export function PolicyDashboard({ declaration, enrichments = [] }: PolicyDashboardProps) {
    const router = useRouter();

    // Helper to pull enrichment values
    const getEnrichment = (key: string) => enrichments.find(e => e.field_key === key);
    const enrichVal = (key: string) => getEnrichment(key)?.field_value || null;

    const fireRiskLabel = enrichVal('fire_risk_label');
    const fireRiskClass = enrichVal('fire_risk_class');
    const latitude = enrichVal('latitude');
    const longitude = enrichVal('longitude');
    const propertyImage = enrichVal('property_image');

    // Most recent enrichment fetch date
    const latestFetch = enrichments.length > 0
        ? enrichments.reduce((latest, e) => {
            const t = new Date(e.fetched_at).getTime();
            return t > latest ? t : latest;
        }, 0)
        : null;
    const lastFetchedStr = latestFetch
        ? new Date(latestFetch).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    // Unique sources used
    const uniqueSources = [...new Set(enrichments.map(e => e.source_name))];

    // AI Vision observations — parse structured notes from ai_* enrichment rows
    interface ParsedAiObs {
        key: string;
        label: string;
        detected: boolean;
        confidence: 'high' | 'medium' | 'low';
        rationale: string;
        manualReview: boolean;
    }

    const aiObservations: ParsedAiObs[] = enrichments
        .filter(e => e.field_key.startsWith('ai_') && e.field_key !== 'ai_vision_summary')
        .map(e => {
            try {
                const meta = JSON.parse(e.notes || '{}');
                return {
                    key: e.field_key,
                    label: meta.label || e.field_key.replace('ai_', '').replace(/_/g, ' '),
                    detected: e.field_value === 'detected',
                    confidence: (e.confidence as 'high' | 'medium' | 'low') || 'medium',
                    rationale: meta.rationale || '',
                    manualReview: meta.manual_review || false,
                };
            } catch {
                return null;
            }
        })
        .filter((o): o is ParsedAiObs => o !== null);

    const detectedFeatures = aiObservations.filter(o => o.detected);

    // Vision summary metadata
    const visionSummaryEnrichment = enrichments.find(e => e.field_key === 'ai_vision_summary');
    const visionSummaryValue = visionSummaryEnrichment?.field_value || null;
    const visionSummaryMeta = (() => {
        try {
            const meta = JSON.parse(visionSummaryEnrichment?.notes || '{}');
            return { imageQuality: meta.image_quality as string | undefined };
        } catch {
            return null;
        }
    })();

    // Fire risk color
    const fireRiskColor = (cls: string | null) => {
        switch (cls) {
            case '1': return '#4ade80';
            case '2': return '#86efac';
            case '3': return '#facc15';
            case '4': return '#fb923c';
            case '5': return '#ef4444';
            default: return '#64748b';
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Policy Overview</h2>
            <div className={styles.grid}>
                {/* Insured Information */}
                <Card className={styles.card}>
                    <h3>Insured Information</h3>
                    <div className={styles.field}>
                        <label>Insured Name:</label>
                        <span
                            style={{ color: '#60a5fa', cursor: 'pointer' }}
                            onClick={() => declaration.client_id && router.push(`/client/${declaration.client_id}`)}
                        >
                            {declaration.insured_name}
                        </span>
                    </div>
                    {declaration.secondary_insured_name && (
                        <div className={styles.field}>
                            <label>Secondary Insured:</label>
                            <span>{declaration.secondary_insured_name}</span>
                        </div>
                    )}
                    <div className={styles.field}>
                        <label>Email:</label>
                        <span>{declaration.client_email || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Phone:</label>
                        <span>{declaration.client_phone || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Mailing Address:</label>
                        <span>{declaration.mailing_address || '—'}</span>
                    </div>
                </Card>

                {/* Property Details */}
                <Card className={styles.card}>
                    <h3>Property Details</h3>
                    <div className={styles.field}>
                        <label>Location:</label>
                        <span>{declaration.property_location || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Year Built:</label>
                        <span>{declaration.year_built || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Construction:</label>
                        <span>{declaration.construction_type || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Occupancy:</label>
                        <span>{declaration.occupancy || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label># of Units:</label>
                        <span>{declaration.number_of_units || '—'}</span>
                    </div>
                </Card>

                {/* Property Enrichment Data */}
                <Card className={styles.card}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                        </span>
                        Property Enrichment
                    </h3>
                    {enrichments.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', padding: '0.5rem 0' }}>
                            No enrichment data yet. Click <strong>Enrich Property Data</strong> above to fetch.
                        </div>
                    ) : (
                        <>
                            {/* Fire Risk */}
                            {fireRiskLabel && (
                                <div className={styles.field}>
                                    <label>Fire Risk:</label>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{
                                            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                                            background: fireRiskColor(fireRiskClass),
                                            boxShadow: `0 0 6px ${fireRiskColor(fireRiskClass)}40`,
                                        }} />
                                        <span style={{ fontWeight: 600, color: fireRiskColor(fireRiskClass) }}>{fireRiskLabel}</span>
                                        {fireRiskClass && <span style={{ fontSize: '0.68rem', color: '#64748b' }}>(Class {fireRiskClass})</span>}
                                    </span>
                                </div>
                            )}

                            {/* Coordinates */}
                            {latitude && longitude && (
                                <div className={styles.field}>
                                    <label>Coordinates:</label>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
                                    </span>
                                </div>
                            )}

                            {/* Satellite Image */}
                            {propertyImage && (
                                <div className={styles.field}>
                                    <label>Satellite:</label>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#4ade80', fontSize: '0.78rem' }}>
                                        ✓ Image available
                                    </span>
                                </div>
                            )}

                            {/* AI Vision Analysis Section */}
                            {aiObservations.length > 0 && (
                                <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '3px', background: 'rgba(249,115,22,0.15)', flexShrink: 0 }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                        </span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Vision Analysis</span>
                                        {visionSummaryMeta && (
                                            <span style={{
                                                fontSize: '0.58rem', padding: '0.1rem 0.35rem', borderRadius: '3px',
                                                color: '#fb923c', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                                            }}>AI-Inferred</span>
                                        )}
                                    </div>

                                    {/* Detected features */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {detectedFeatures.map(obs => (
                                            <div key={obs.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                                                <span style={{ color: '#4ade80', flexShrink: 0, fontSize: '0.7rem' }}>✓</span>
                                                <span style={{ color: 'var(--text-high)', fontWeight: 500, flex: 1 }}>{obs.label}</span>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.08rem 0.3rem', borderRadius: '3px',
                                                    fontSize: '0.58rem', fontWeight: 600,
                                                    color: obs.confidence === 'high' ? '#4ade80' : obs.confidence === 'medium' ? '#facc15' : '#fb923c',
                                                    background: obs.confidence === 'high' ? 'rgba(34,197,94,0.1)' : obs.confidence === 'medium' ? 'rgba(234,179,8,0.1)' : 'rgba(249,115,22,0.1)',
                                                    border: `1px solid ${obs.confidence === 'high' ? 'rgba(34,197,94,0.2)' : obs.confidence === 'medium' ? 'rgba(234,179,8,0.2)' : 'rgba(249,115,22,0.2)'}`,
                                                }}>{obs.confidence}</span>
                                                {obs.manualReview && (
                                                    <span style={{ fontSize: '0.58rem', color: '#facc15' }} title="Manual review recommended">⚠</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Summary */}
                                    <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.6rem', color: '#475569' }}>
                                            {detectedFeatures.length} detected · {aiObservations.length - detectedFeatures.length} not found
                                        </span>
                                        {visionSummaryMeta?.imageQuality && (
                                            <span style={{ fontSize: '0.6rem', color: '#475569' }}>
                                                Image: {visionSummaryMeta.imageQuality}
                                            </span>
                                        )}
                                    </div>

                                    {/* Overall AI notes */}
                                    {visionSummaryValue && (
                                        <div style={{ marginTop: '0.3rem', fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>
                                            {visionSummaryValue}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sources */}
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Sources</div>
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    {uniqueSources.map(src => (
                                        <span key={src} style={{
                                            display: 'inline-block', padding: '0.15rem 0.45rem',
                                            borderRadius: '4px', fontSize: '0.62rem', fontWeight: 600,
                                            color: src === 'Satellite Vision AI' ? '#fb923c' : '#a5b4fc',
                                            background: src === 'Satellite Vision AI' ? 'rgba(249,115,22,0.1)' : 'rgba(99,102,241,0.1)',
                                            border: `1px solid ${src === 'Satellite Vision AI' ? 'rgba(249,115,22,0.2)' : 'rgba(99,102,241,0.2)'}`,
                                        }}>{src}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Meta */}
                            <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.62rem', color: '#475569' }}>
                                    {enrichments.length} data point{enrichments.length !== 1 ? 's' : ''}
                                </span>
                                {lastFetchedStr && (
                                    <span style={{ fontSize: '0.62rem', color: '#475569' }}>
                                        Last fetched {lastFetchedStr}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </Card>

                {/* Coverage Limits */}
                <Card className={styles.card}>
                    <h3>Coverage Limits</h3>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Dwelling:</label>
                            <span>{declaration.limit_dwelling || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Other Structures:</label>
                            <span>{declaration.limit_other_structures || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Personal Property:</label>
                            <span>{declaration.limit_personal_property || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Fair Rental Value:</label>
                            <span>{declaration.limit_fair_rental_value || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Ordinance or Law:</label>
                            <span>{declaration.limit_ordinance_or_law || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Debris Removal:</label>
                            <span>{declaration.limit_debris_removal || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Extended Dwelling:</label>
                            <span>{declaration.limit_extended_dwelling_coverage || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Deductible:</label>
                            <span>{declaration.deductible || '—'}</span>
                        </div>
                    </div>
                </Card>

                {/* Additional Coverages */}
                <Card className={styles.card}>
                    <h3>Additional Coverages</h3>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Dwelling Replacement Cost:</label>
                            <span>{declaration.limit_dwelling_replacement_cost || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Inflation Guard:</label>
                            <span>{declaration.limit_inflation_guard || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Personal Property RC:</label>
                            <span>{declaration.limit_personal_property_replacement_cost || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Fences:</label>
                            <span>{declaration.limit_fences || '—'}</span>
                        </div>
                    </div>
                </Card>

                {/* Premium & Status */}
                <Card className={styles.card}>
                    <h3>Premium & Status</h3>
                    <div className={styles.field}>
                        <label>Total Premium:</label>
                        <span className={styles.premium}>{declaration.total_annual_premium || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Status:</label>
                        <span className={`${styles.status} ${styles[declaration.status.toLowerCase().replace(' ', '')]}`}>
                            {declaration.status}
                        </span>
                    </div>
                    <div className={styles.field}>
                        <label>Date Issued:</label>
                        <span>{declaration.date_issued || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Policy Period:</label>
                        <span>
                            {declaration.policy_period_start && declaration.policy_period_end
                                ? `${declaration.policy_period_start} to ${declaration.policy_period_end}`
                                : '—'}
                        </span>
                    </div>
                    <div className={styles.field}>
                        <label>Renewal Date:</label>
                        <span>{declaration.renewal_date || '—'}</span>
                    </div>
                </Card>

                {/* Broker Info */}
                <Card className={styles.card}>
                    <h3>Broker Information</h3>
                    <div className={styles.field}>
                        <label>Broker:</label>
                        <span>{declaration.broker_name || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Address:</label>
                        <span>{declaration.broker_address || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Phone:</label>
                        <span>{declaration.broker_phone_number || '—'}</span>
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
                                <div className={styles.field}>
                                    <label>1st Mortgagee:</label>
                                    <span>{declaration.mortgagee_1_name}</span>
                                </div>
                                <div className={styles.field}>
                                    <label>Address:</label>
                                    <span>{declaration.mortgagee_1_address || '—'}</span>
                                </div>
                                <div className={styles.field}>
                                    <label>Code:</label>
                                    <span>{declaration.mortgagee_1_code || '—'}</span>
                                </div>
                            </>
                        )}
                        {declaration.mortgagee_2_name && (
                            <>
                                <div className={styles.field} style={{ marginTop: '0.75rem', borderTop: '1px solid #333', paddingTop: '0.75rem' }}>
                                    <label>2nd Mortgagee:</label>
                                    <span>{declaration.mortgagee_2_name}</span>
                                </div>
                                <div className={styles.field}>
                                    <label>Address:</label>
                                    <span>{declaration.mortgagee_2_address || '—'}</span>
                                </div>
                                <div className={styles.field}>
                                    <label>Code:</label>
                                    <span>{declaration.mortgagee_2_code || '—'}</span>
                                </div>
                            </>
                        )}
                    </Card>
                )}

                {/* Optional & Special Coverages */}
                <Card className={styles.card}>
                    <h3>Optional &amp; Special Coverages</h3>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Actual Cash Value:</label>
                            <span>{declaration.limit_actual_cash_value_coverage || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Replacement Cost:</label>
                            <span>{declaration.limit_replacement_cost_coverage || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Extended Replacement:</label>
                            <span>{declaration.limit_extended_replacement_cost_coverage || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Guaranteed Replacement:</label>
                            <span>{declaration.limit_guaranteed_replacement_cost_coverage || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Building Code Upgrade:</label>
                            <span>{declaration.limit_building_code_upgrade_coverage || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Incidental Occupancy:</label>
                            <span>{declaration.limit_permitted_incidental_occupancy || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Plants, Shrubs, Trees:</label>
                            <span>{declaration.limit_plants_shrubs_trees || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Outdoor Radio/TV:</label>
                            <span>{declaration.limit_outdoor_radio_tv_equipment || '—'}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Awnings:</label>
                            <span>{declaration.limit_awnings || '—'}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Signs:</label>
                            <span>{declaration.limit_signs || '—'}</span>
                        </div>
                    </div>
                    {declaration.dic_exists && (
                        <div className={styles.field} style={{ marginTop: '0.5rem' }}>
                            <label>DIC Policy Number:</label>
                            <span>{declaration.dic_policy_number || '—'}</span>
                        </div>
                    )}
                    {declaration.dic_company && (
                        <div className={styles.field} style={{ marginTop: '0.5rem' }}>
                            <label>DIC Company:</label>
                            <span>{declaration.dic_company}</span>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

