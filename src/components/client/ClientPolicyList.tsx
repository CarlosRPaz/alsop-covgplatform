'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { fetchDeclarationsByClientId, Declaration } from '@/lib/api';
import styles from './ClientPolicyList.module.css';

interface ClientPolicyListProps {
    clientId: string;
}

export function ClientPolicyList({ clientId }: ClientPolicyListProps) {
    const router = useRouter();
    const [policies, setPolicies] = React.useState<Declaration[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const loadPolicies = async () => {
            try {
                const clientPolicies = await fetchDeclarationsByClientId(clientId);
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
                            <th className={styles.th}>DIC Coverage</th>
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
                                <td className={styles.td}>{policy.property_location}</td>
                                <td className={styles.td}>
                                    <span
                                        className={`${styles.dicBadge} ${policy.dic_company === 'None' || !policy.dic_company
                                            ? styles.dicNone
                                            : styles.dicActive
                                            }`}
                                    >
                                        {policy.dic_company || 'None'}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <span className={`${styles.statusBadge} ${styles[`status${policy.status.replace(/\s/g, '')}`]}`}>
                                        {policy.status}
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
