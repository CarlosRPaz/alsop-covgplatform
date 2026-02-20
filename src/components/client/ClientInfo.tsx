'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, FileText, ArrowLeft, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
import { fetchDeclarationsByClientId, Declaration } from '@/lib/api';
import styles from './ClientInfo.module.css';

interface ClientInfoProps {
    clientId: string;
}

export function ClientInfo({ clientId }: ClientInfoProps) {
    const router = useRouter();
    const [declarations, setDeclarations] = useState<Declaration[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const results = await fetchDeclarationsByClientId(clientId);
                setDeclarations(results);
            } catch (error) {
                console.error('Error loading client data:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [clientId]);

    // Derive client info from the first declaration (primary policy)
    const primary = declarations[0];

    const clientName = primary
        ? [primary.insured_name, primary.secondary_insured_name].filter(Boolean).join(' & ')
        : 'Client Name';

    const clientEmail = primary?.client_email || 'Not on file';
    const clientPhone = primary?.client_phone || primary?.broker_phone_number || 'Not on file';
    const mailingAddress = primary?.mailing_address || 'Address not available';
    const policyCount = declarations.length;

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                        className={styles.backButton}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                </div>
                <div className={styles.card}>
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        Loading client information...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className={styles.backButton}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.iconWrapper}>
                        <User className={styles.icon} />
                    </div>
                    <div>
                        <h1 className={styles.title}>{clientName}</h1>
                        <p className={styles.subtitle}>Client ID: {clientId}</p>
                    </div>
                </div>

                <div className={styles.grid}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Mail />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Email</div>
                            <div className={styles.infoValue}>{clientEmail}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Phone />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Phone</div>
                            <div className={styles.infoValue}>{clientPhone}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <FileText />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Total Policies</div>
                            <div className={styles.infoValue}>{policyCount}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <MapPin />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Mailing Address</div>
                            <div className={styles.infoValue}>{mailingAddress}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
