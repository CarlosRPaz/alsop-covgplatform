'use client';

import React from 'react';
import { User, Mail, Phone, FileText, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
import styles from './ClientInfo.module.css';

interface ClientInfoProps {
    clientId: string;
}

// Mock client data - in real app, fetch from API
const getClientData = (id: string) => {
    const clients: Record<string, any> = {
        'client-001': {
            id: 'client-001',
            name: 'John & Jane Doe',
            email: 'johndoe@email.com',
            phone: '(555) 234-5678',
            policyCount: 2,
            mailingAddress: '123 Maple St, Springfield, IL 62704',
        },
        'client-002': {
            id: 'client-002',
            name: 'Robert Smith',
            email: 'robert.smith@email.com',
            phone: '(555) 345-6789',
            policyCount: 1,
            mailingAddress: '456 Elm St, Denver, CO 80014',
        },
        // Add more clients as needed
    };

    return clients[id] || {
        id,
        name: 'Client Name',
        email: 'client@email.com',
        phone: '(555) 000-0000',
        policyCount: 1,
        mailingAddress: 'Address not available',
    };
};

export function ClientInfo({ clientId }: ClientInfoProps) {
    const router = useRouter();
    const client = getClientData(clientId);

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
                        <h1 className={styles.title}>{client.name}</h1>
                        <p className={styles.subtitle}>Client ID: {client.id}</p>
                    </div>
                </div>

                <div className={styles.grid}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Mail />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Email</div>
                            <div className={styles.infoValue}>{client.email}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Phone />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Phone</div>
                            <div className={styles.infoValue}>{client.phone}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <FileText />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Total Policies</div>
                            <div className={styles.infoValue}>{client.policyCount}</div>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <User />
                        </div>
                        <div>
                            <div className={styles.infoLabel}>Mailing Address</div>
                            <div className={styles.infoValue}>{client.mailingAddress}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
