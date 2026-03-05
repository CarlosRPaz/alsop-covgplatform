'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, FileText, ArrowLeft, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
import { getClientById, ClientRow } from '@/lib/api';
import styles from './ClientInfo.module.css';

interface ClientInfoProps {
    clientId: string;
}

export function ClientInfo({ clientId }: ClientInfoProps) {
    const router = useRouter();
    const [client, setClient] = useState<ClientRow | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const result = await getClientById(clientId);
                setClient(result);
            } catch (error) {
                console.error('Error loading client data:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [clientId]);

    const clientName = client?.named_insured || 'Client Name';
    const clientEmail = client?.email || 'Not on file';
    const clientPhone = client?.phone || 'Not on file';
    const mailingAddress = client?.mailing_address_raw || 'Address not available';

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
                            <div className={styles.infoLabel}>Client Type</div>
                            <div className={styles.infoValue}>{client?.insured_type || 'person'}</div>
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
