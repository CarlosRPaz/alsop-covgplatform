'use client';

import React from 'react';
import { Declaration, PropertyEnrichment } from '@/lib/api';
import { normalizeInputs, calculateEstimate } from '@/lib/rce/InterimEstimator';
import { InterimRceWidget } from '../InterimRceWidget';
import { Shield, FileText, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card/Card';
import styles from '../PolicyDashboard.module.css';

interface PolicyRceTabProps {
    declaration: Declaration;
    enrichments?: PropertyEnrichment[];
}

export function PolicyRceTab({ declaration, enrichments = [] }: PolicyRceTabProps) {
    const policyId = declaration.policy_id || declaration.id;
    const rceInput = normalizeInputs({ id: policyId, property_address_raw: declaration.property_location }, enrichments);
    const rceEstimate = calculateEstimate(rceInput);

    // Check if we have any uploaded RCE documents via enrichments
    const hasRceEnrichments = enrichments.some(e =>
        e.source_name === 'rce_360value' || e.source_name === 'dic_embedded_360value'
    );

    return (
        <div className={styles.container}>
            <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} style={{ color: '#3b82f6' }} />
                Replacement Cost Estimate (RCE)
            </h2>

            <div style={{ maxWidth: '800px' }}>
                {/* Interim RCE Widget — the modeled estimate */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <InterimRceWidget estimate={rceEstimate} />
                </div>

                {/* RCE Data Sources */}
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
            </div>
        </div>
    );
}
