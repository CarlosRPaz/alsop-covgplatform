'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Satellite, Shield, CheckCircle2, XCircle,
    Loader2, AlertTriangle, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { PropertyEnrichment } from '@/lib/api';
import styles from './PolicyStatusBar.module.css';

// Expected enrichment fields — used to determine what's "missing"
const EXPECTED_ENRICHMENT_KEYS = [
    { key: 'year_built', label: 'Year Built' },
    { key: 'square_footage', label: 'Square Footage' },
    { key: 'lot_size', label: 'Lot Size' },
    { key: 'bedrooms', label: 'Bedrooms' },
    { key: 'bathrooms', label: 'Bathrooms' },
    { key: 'stories', label: 'Stories' },
    { key: 'roof_type', label: 'Roof Type' },
    { key: 'roof_age', label: 'Roof Age' },
    { key: 'construction_type', label: 'Construction Type' },
    { key: 'foundation_type', label: 'Foundation Type' },
    { key: 'heating_type', label: 'Heating Type' },
    { key: 'cooling_type', label: 'Cooling Type' },
    { key: 'garage', label: 'Garage' },
    { key: 'pool', label: 'Pool' },
    { key: 'property_image', label: 'Property Image' },
    { key: 'estimated_replacement_cost', label: 'Estimated Replacement Cost' },
    { key: 'flood_zone', label: 'Flood Zone' },
    { key: 'fire_risk', label: 'Fire Risk' },
    { key: 'crime_score', label: 'Crime Score' },
    { key: 'hail_risk', label: 'Hail Risk' },
    { key: 'wind_risk', label: 'Wind Risk' },
    { key: 'earthquake_risk', label: 'Earthquake Risk' },
    { key: 'property_class', label: 'Property Class' },
    { key: 'zoning', label: 'Zoning' },
    { key: 'last_sale_date', label: 'Last Sale Date' },
    { key: 'last_sale_price', label: 'Last Sale Price' },
    { key: 'tax_assessed_value', label: 'Tax Assessed Value' },
    { key: 'front_elevation_analysis', label: 'Front Elevation Analysis' },
];

interface PolicyStatusBarProps {
    isEnriched: boolean;
    enrichmentCount: number;
    lastEnrichedDate?: string | null;
    flagsChecked: boolean;
    openFlagCount: number;
    highestSeverity?: 'critical' | 'high' | 'warning' | 'info' | null;
    lastCheckedDate?: string | null;
    enrichStep?: string | null;
    onEnrich: () => void;
    onRunFlagCheck: () => void;
    flagCheckRunning?: boolean;
    /** Actual enrichment data points for the dropdown */
    enrichments?: PropertyEnrichment[];
}

export function PolicyStatusBar({
    isEnriched,
    enrichmentCount,
    lastEnrichedDate,
    flagsChecked,
    openFlagCount,
    highestSeverity,
    lastCheckedDate,
    enrichStep,
    onEnrich,
    onRunFlagCheck,
    flagCheckRunning = false,
    enrichments = [],
}: PolicyStatusBarProps) {
    const enrichRunning = !!enrichStep && enrichStep !== '✓ Complete!' && enrichStep !== '✗ Failed — try again';
    const enrichDone = enrichStep === '✓ Complete!';
    const enrichFailed = enrichStep === '✗ Failed — try again';
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDropdown]);

    // Build found/missing lists
    const foundKeys = new Set(enrichments.map(e => e.field_key));
    const foundItems = enrichments.filter(e => e.field_key !== 'property_image'); // skip image in list
    const missingItems = EXPECTED_ENRICHMENT_KEYS.filter(e => !foundKeys.has(e.key) && e.key !== 'property_image');
    // Any enrichment keys found that aren't in our expected list
    const extraItems = enrichments.filter(e => !EXPECTED_ENRICHMENT_KEYS.some(ex => ex.key === e.field_key) && e.field_key !== 'property_image');

    // Severity color
    const severityColor = highestSeverity === 'critical' ? '#ef4444'
        : highestSeverity === 'high' ? '#f97316'
            : highestSeverity === 'warning' ? '#eab308'
                : highestSeverity === 'info' ? '#3b82f6'
                    : '#64748b';

    const formatFieldKey = (key: string) => {
        const match = EXPECTED_ENRICHMENT_KEYS.find(e => e.key === key);
        if (match) return match.label;
        return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const confDot = (conf: string) => {
        const color = conf === 'high' ? '#10b981' : conf === 'medium' ? '#f59e0b' : '#ef4444';
        return <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: color, marginRight: '4px', flexShrink: 0 }} />;
    };

    return (
        <div className={styles.bar}>
            {/* ── Enrichment Status ── */}
            <div className={`${styles.segment} ${!isEnriched ? styles.segmentPending : ''}`} style={{ position: 'relative' }} ref={dropdownRef}>
                <div className={`${styles.indicator} ${isEnriched ? styles.indicatorDone : styles.indicatorPending}`}>
                    {isEnriched ? (
                        <CheckCircle2 size={15} />
                    ) : (
                        <XCircle size={15} />
                    )}
                </div>
                <div className={styles.segmentInfo}>
                    <span className={styles.segmentLabel}>Property Enrichment</span>
                    <span className={styles.segmentValue}>
                        {isEnriched ? (
                            <>
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className={styles.dataPointsBtn}
                                    title="Click to see data points"
                                >
                                    <span className={styles.done}>{enrichmentCount} data points</span>
                                    {showDropdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {lastEnrichedDate && (
                                    <span className={styles.subtle}> · {lastEnrichedDate}</span>
                                )}
                            </>
                        ) : (
                            <span className={styles.pending}>Not enriched — action required</span>
                        )}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={enrichRunning}
                    onClick={onEnrich}
                    className={isEnriched ? styles.actionBtn : styles.actionBtnUrgent}
                >
                    {enrichRunning ? (
                        <>
                            <Loader2 size={13} className={styles.spin} />
                            <span className={styles.actionLabel}>{enrichStep}</span>
                        </>
                    ) : enrichDone ? (
                        <>
                            <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                            <span className={styles.actionLabel} style={{ color: '#22c55e' }}>Complete!</span>
                        </>
                    ) : enrichFailed ? (
                        <>
                            <XCircle size={13} style={{ color: '#ef4444' }} />
                            <span className={styles.actionLabel} style={{ color: '#ef4444' }}>Failed — retry</span>
                        </>
                    ) : isEnriched ? (
                        <>
                            <Satellite size={13} />
                            <span className={styles.actionLabel}>Re-Enrich</span>
                        </>
                    ) : (
                        <>
                            <Satellite size={13} />
                            <span className={styles.actionLabel}>Enrich Now</span>
                        </>
                    )}
                </Button>

                {/* ── Data Points Dropdown ── */}
                {showDropdown && isEnriched && (
                    <div className={styles.dropdown}>
                        <div className={styles.dropdownHeader}>
                            <span className={styles.dropdownTitle}>Enrichment Data Points</span>
                            <span className={styles.dropdownCount}>
                                <span style={{ color: '#10b981' }}>{foundItems.length + extraItems.length} found</span>
                                {missingItems.length > 0 && (
                                    <> · <span style={{ color: '#94a3b8' }}>{missingItems.length} missing</span></>
                                )}
                            </span>
                        </div>

                        <div className={styles.dropdownBody}>
                            {/* Found items */}
                            {(foundItems.length > 0 || extraItems.length > 0) && (
                                <div className={styles.dropdownGroup}>
                                    <div className={styles.dropdownGroupLabel}>
                                        <CheckCircle2 size={11} style={{ color: '#10b981' }} />
                                        Found
                                    </div>
                                    {[...foundItems, ...extraItems].map((e, i) => (
                                        <div key={i} className={styles.dropdownRow}>
                                            <span className={styles.dropdownKey}>
                                                {confDot(e.confidence)}
                                                {formatFieldKey(e.field_key)}
                                            </span>
                                            <span className={styles.dropdownValue} title={e.field_value || ''}>
                                                {e.field_value && e.field_value.length > 30
                                                    ? e.field_value.slice(0, 30) + '…'
                                                    : e.field_value || '—'}
                                            </span>
                                            <span className={styles.dropdownSource}>{e.source_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Missing items */}
                            {missingItems.length > 0 && (
                                <div className={styles.dropdownGroup}>
                                    <div className={styles.dropdownGroupLabel} style={{ color: '#94a3b8' }}>
                                        <XCircle size={11} style={{ color: '#94a3b8' }} />
                                        Not Found
                                    </div>
                                    {missingItems.map((e, i) => (
                                        <div key={i} className={`${styles.dropdownRow} ${styles.dropdownRowMissing}`}>
                                            <span className={styles.dropdownKey}>{e.label}</span>
                                            <span className={styles.dropdownValue} style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div className={styles.divider} />

            {/* ── Flag Check Status ── */}
            <div className={`${styles.segment} ${!flagsChecked ? styles.segmentPending : ''}`}>
                <div className={`${styles.indicator} ${flagsChecked ? styles.indicatorDone : styles.indicatorPending}`}
                    style={flagsChecked && openFlagCount > 0 ? { background: `${severityColor}18`, color: severityColor, borderColor: `${severityColor}40`, animation: 'none' } : undefined}
                >
                    {flagsChecked ? (
                        openFlagCount > 0 ? (
                            <AlertTriangle size={15} />
                        ) : (
                            <Shield size={15} />
                        )
                    ) : (
                        <XCircle size={15} />
                    )}
                </div>
                <div className={styles.segmentInfo}>
                    <span className={styles.segmentLabel}>Flag Check</span>
                    <span className={styles.segmentValue}>
                        {flagsChecked ? (
                            openFlagCount > 0 ? (
                                <>
                                    <span style={{ color: severityColor, fontWeight: 600 }}>
                                        {openFlagCount} open flag{openFlagCount !== 1 ? 's' : ''}
                                    </span>
                                    {lastCheckedDate && (
                                        <span className={styles.subtle}> · {lastCheckedDate}</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className={styles.done}>All clear — no issues</span>
                                    {lastCheckedDate && (
                                        <span className={styles.subtle}> · {lastCheckedDate}</span>
                                    )}
                                </>
                            )
                        ) : (
                            <span className={styles.pending}>Not checked — action required</span>
                        )}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={flagCheckRunning}
                    onClick={onRunFlagCheck}
                    className={flagsChecked ? styles.actionBtn : styles.actionBtnUrgent}
                >
                    {flagCheckRunning ? (
                        <>
                            <Loader2 size={13} className={styles.spin} />
                            <span className={styles.actionLabel}>Checking…</span>
                        </>
                    ) : (
                        <>
                            <Zap size={13} />
                            <span className={styles.actionLabel}>{flagsChecked ? 'Re-Check Flags' : 'Check Now'}</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
