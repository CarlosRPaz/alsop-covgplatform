'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { fetchPoliciesByClientId, DashboardPolicy } from '@/lib/api';
import styles from './ClientPolicyList.module.css';

interface ClientPolicyListProps {
    clientId: string;
}

export function ClientPolicyList({ clientId }: ClientPolicyListProps) {
    const router = useRouter();
    const [policies, setPolicies] = React.useState<DashboardPolicy[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const loadPolicies = async () => {
            try {
                const clientPolicies = await fetchPoliciesByClientId(clientId);
                setPolicies(clientPolicies);
            } catch (error) {
                console.error('Error loading policies:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPolicies();
    }, [clientId]);

    if (loading) {
        return <div className={styles.loading}>Loading policies...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Client Policies</h2>
                <p className={styles.subtitle}>{policies.length} total {policies.length === 1 ? 'policy' : 'policies'}</p>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.th}>Policy Number</th>
                            <th className={styles.th}>Property Address</th>
                            <th className={styles.th}>Effective Date</th>
                            <th className={styles.th}>Expiration Date</th>
                            <th className={styles.th}>Premium</th>
                            <th className={styles.th}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {policies.map((policy) => (
                            <tr
                                key={policy.id}
                                className={`${styles.tr} ${styles.clickable}`}
                                onClick={() => router.push(`/policy/${policy.id}`)}
                            >
                                <td className={styles.td}>
                                    <span className={styles.policyNumber}>{policy.policy_number}</span>
                                </td>
                                <td className={styles.td}>{policy.property_address}</td>
                                <td className={styles.td}>{policy.effective_date || '—'}</td>
                                <td className={styles.td}>{policy.expiration_date || '—'}</td>
                                <td className={styles.td}>{policy.annual_premium || '—'}</td>
                                <td className={styles.td}>
                                    <span className={`${styles.statusBadge} ${styles[`status${(policy.status || 'unknown').replace(/\s/g, '')}`]}`}>
                                        {policy.status || 'unknown'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {policies.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>No policies found for this client.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
