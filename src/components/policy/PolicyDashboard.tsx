import { Declaration } from '@/lib/api';
import styles from './PolicyDashboard.module.css';
import { Card } from '../ui/Card/Card';

interface PolicyDashboardProps {
    declaration: Declaration;
}

export function PolicyDashboard({ declaration }: PolicyDashboardProps) {
    return (
        <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Policy Overview</h2>
            <div className={styles.grid}>
                {/* Insured Information */}
                <Card className={styles.card}>
                    <h3>Insured Information</h3>
                    <div className={styles.field}>
                        <label>Insured Name:</label>
                        <span>{declaration.insured_name}</span>
                    </div>
                    {declaration.secondary_insured_name && (
                        <div className={styles.field}>
                            <label>Secondary Insured:</label>
                            <span>{declaration.secondary_insured_name}</span>
                        </div>
                    )}
                    <div className={styles.field}>
                        <label>Mailing Address:</label>
                        <span>{declaration.mailing_address}</span>
                    </div>
                </Card>

                {/* Property Details */}
                <Card className={styles.card}>
                    <h3>Property Details</h3>
                    <div className={styles.field}>
                        <label>Location:</label>
                        <span>{declaration.property_location}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Year Built:</label>
                        <span>{declaration.year_built}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Construction:</label>
                        <span>{declaration.construction_type}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Occupancy:</label>
                        <span>{declaration.occupancy}</span>
                    </div>
                </Card>

                {/* Coverage */}
                <Card className={styles.card}>
                    <h3>Coverage Limits</h3>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Dwelling:</label>
                            <span>{declaration.limit_dwelling}</span>
                        </div>
                        <div className={styles.field}>
                            <label>Personal Prop:</label>
                            <span>{declaration.limit_personal_property}</span>
                        </div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Liability:</label>
                            <span>$500,000 (Mock)</span>
                        </div>
                        <div className={styles.field}>
                            <label>Deductible:</label>
                            <span>{declaration.deductible}</span>
                        </div>
                    </div>
                </Card>

                {/* Financials */}
                <Card className={styles.card}>
                    <h3>Premium & Status</h3>
                    <div className={styles.field}>
                        <label>Total Premium:</label>
                        <span className={styles.premium}>{declaration.total_annual_premium}</span>
                    </div>
                    <div className={styles.field}>
                        <label>Status:</label>
                        <span className={`${styles.status} ${styles[declaration.status.toLowerCase().replace(' ', '')]}`}>
                            {declaration.status}
                        </span>
                    </div>
                    <div className={styles.field}>
                        <label>Issued:</label>
                        <span>{declaration.date_issued}</span>
                    </div>
                </Card>
            </div>
        </div>
    );
}
