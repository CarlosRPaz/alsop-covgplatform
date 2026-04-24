'use client';

import React from 'react';
import { Declaration, PolicyDetail } from '@/lib/api';
import { Card } from '@/components/ui/Card/Card';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import styles from '../PolicyDashboard.module.css';

interface PolicyDicDetailsTabProps {
    declaration: Declaration;
    policyDetail?: PolicyDetail;
}

export function PolicyDicDetailsTab({ declaration, policyDetail }: PolicyDicDetailsTabProps) {
    const hasDic = declaration.dic_exists || !!declaration.dic_limit_dwelling;

    if (!hasDic) {
        return (
            <div className={styles.container}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    gap: '1rem',
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(107, 114, 128, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                    }}>
                        <ShieldCheck size={28} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        No DIC Policy Linked
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.5, margin: 0 }}>
                        No DIC (Difference in Conditions) carrier policy has been uploaded or linked to this policy yet.
                        You can upload a DIC dec page from the action bar above, or toggle &quot;DIC Exists&quot; in the Edit Policy panel.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} style={{ color: '#10b981' }} />
                DIC Policy Details
            </h2>

            <div className={styles.grid}>
                {/* DIC Policy Info */}
                <Card className={styles.card}>
                    <h3>DIC Policy Information</h3>
                    <div className={styles.field}>
                        <label>DIC Company:</label>
                        <span>{declaration.dic_company || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>DIC Policy Number:</label>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {declaration.dic_policy_number || policyDetail?.dic_policy_number || '—'}
                        </span>
                    </div>
                    <div className={styles.field}>
                        <label>DIC Coverage Exists:</label>
                        <span style={{
                            color: '#10b981',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                        }}>
                            <ShieldCheck size={14} /> Active
                        </span>
                    </div>
                </Card>

                {/* DIC Coverage Limits */}
                <Card className={styles.card}>
                    <h3>DIC Coverage Limits</h3>
                    <div className={styles.field}>
                        <label>Cov A — Dwelling:</label>
                        <span>{declaration.dic_limit_dwelling || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Cov B — Other Structures:</label>
                        <span>{declaration.dic_limit_other_structures || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Cov C — Personal Property:</label>
                        <span>{declaration.dic_limit_personal_property || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Cov E — Loss of Use:</label>
                        <span>{declaration.dic_limit_loss_of_use || '—'}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Deductible:</label>
                        <span>{declaration.dic_deductible || '—'}</span>
                    </div>
                </Card>

                {/* DIC Premium */}
                <Card className={styles.card}>
                    <h3>DIC Premium</h3>
                    <div className={styles.field}>
                        <label>Annual Premium:</label>
                        <span className={styles.premium}>
                            {declaration.dic_annual_premium_raw != null
                                ? `$${Number(declaration.dic_annual_premium_raw).toLocaleString()}`
                                : '—'}
                        </span>
                    </div>
                </Card>

                {/* Data Source Info */}
                <Card className={styles.card}>
                    <h3>Data Source</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <AlertCircle size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                            <span>
                                DIC coverage data is extracted automatically from uploaded DIC carrier declaration pages
                                (PSIC, Bamboo, Aegis) using AI extraction.
                                Values may be manually adjusted via the Edit Policy panel.
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            DIC data is stored separately and never overwrites CFP / FAIR Plan policy data.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
