'use client';

import { useRouter } from 'next/navigation';
import { Declaration } from '@/lib/api';
import styles from './PolicyDashboard.module.css';
import { Card } from '../ui/Card/Card';

interface PolicyDashboardProps {
    declaration: Declaration;
}

export function PolicyDashboard({ declaration }: PolicyDashboardProps) {
    const router = useRouter();

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
            </div>
        </div>
    );
}
