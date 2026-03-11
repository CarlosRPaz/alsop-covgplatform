'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, FileText, ArrowLeft, MapPin, GitMerge, Pencil, Save, X, Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
import { getClientById, updateClient, ClientRow } from '@/lib/api';
import { insertActivityEvent } from '@/lib/notes';
import styles from './ClientInfo.module.css';

interface ClientInfoProps {
    clientId: string;
}

export function ClientInfo({ clientId }: ClientInfoProps) {
    const router = useRouter();
    const [client, setClient] = useState<ClientRow | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editForm, setEditForm] = useState({
        named_insured: '',
        email: '',
        phone: '',
        mailing_address_raw: '',
    });

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

    const enterEditMode = () => {
        if (!client) return;
        setEditForm({
            named_insured: client.named_insured || '',
            email: client.email || '',
            phone: client.phone || '',
            mailing_address_raw: client.mailing_address_raw || '',
        });
        setSaveMessage(null);
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setSaveMessage(null);
    };

    const handleSave = async () => {
        if (!client) return;
        setSaving(true);
        setSaveMessage(null);

        // Determine what changed
        const changes: Record<string, string> = {};
        const changedFields: string[] = [];
        if (editForm.named_insured !== (client.named_insured || '')) {
            changes.named_insured = editForm.named_insured;
            changedFields.push('named_insured');
        }
        if (editForm.email !== (client.email || '')) {
            changes.email = editForm.email;
            changedFields.push('email');
        }
        if (editForm.phone !== (client.phone || '')) {
            changes.phone = editForm.phone;
            changedFields.push('phone');
        }
        if (editForm.mailing_address_raw !== (client.mailing_address_raw || '')) {
            changes.mailing_address_raw = editForm.mailing_address_raw;
            changedFields.push('mailing_address_raw');
        }

        if (changedFields.length === 0) {
            setIsEditing(false);
            setSaving(false);
            return;
        }

        const result = await updateClient(clientId, changes);
        if (result.success) {
            // Log activity event
            await insertActivityEvent({
                event_type: 'client.updated',
                title: 'Client profile updated',
                detail: `Updated: ${changedFields.join(', ')}`,
                client_id: clientId,
                meta: { changed_fields: changedFields },
            });

            // Reload client data
            const refreshed = await getClientById(clientId);
            setClient(refreshed);
            setIsEditing(false);
            setSaveMessage({ type: 'success', text: 'Client saved successfully' });
            setTimeout(() => setSaveMessage(null), 3000);
        } else {
            setSaveMessage({ type: 'error', text: result.error || 'Failed to save' });
        }
        setSaving(false);
    };

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
                    <div style={{ flex: 1 }}>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editForm.named_insured}
                                onChange={(e) => setEditForm(f => ({ ...f, named_insured: e.target.value }))}
                                style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                    color: 'var(--text-high)',
                                    background: 'var(--bg-surface-raised)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.75rem',
                                    width: '100%',
                                    outline: 'none',
                                }}
                                placeholder="Named Insured"
                            />
                        ) : (
                            <>
                                <h1 className={styles.title}>{clientName}</h1>
                                <p className={styles.subtitle}>Client ID: {clientId}</p>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.actions}>
                    {isEditing ? (
                        <>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                                className={styles.actionButton}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={saving}
                                className={styles.actionButton}
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={enterEditMode}
                                className={styles.actionButton}
                            >
                                <Pencil className="w-4 h-4" />
                                Edit Client
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { /* TODO: open merge modal */ }}
                                className={styles.actionButton}
                            >
                                <GitMerge className="w-4 h-4" />
                                Merge Client Profile
                            </Button>
                        </>
                    )}
                </div>

                {/* Toast message */}
                {saveMessage && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        marginBottom: '1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        background: saveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: saveMessage.type === 'success' ? '#10b981' : '#ef4444',
                        border: `1px solid ${saveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    }}>
                        {saveMessage.type === 'success' && <CheckCircle size={16} />}
                        {saveMessage.text}
                    </div>
                )}

                <div className={styles.grid}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Mail />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className={styles.infoLabel}>Email</div>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="Email address"
                                    style={{
                                        color: 'var(--text-high)',
                                        background: 'var(--bg-surface-raised)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.75rem',
                                        width: '100%',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <div className={styles.infoValue}>{clientEmail}</div>
                            )}
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <Phone />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className={styles.infoLabel}>Phone</div>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="Phone number"
                                    style={{
                                        color: 'var(--text-high)',
                                        background: 'var(--bg-surface-raised)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.75rem',
                                        width: '100%',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <div className={styles.infoValue}>{clientPhone}</div>
                            )}
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
                        <div style={{ flex: 1 }}>
                            <div className={styles.infoLabel}>Mailing Address</div>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.mailing_address_raw}
                                    onChange={(e) => setEditForm(f => ({ ...f, mailing_address_raw: e.target.value }))}
                                    placeholder="Mailing address"
                                    style={{
                                        color: 'var(--text-high)',
                                        background: 'var(--bg-surface-raised)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.75rem',
                                        width: '100%',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <div className={styles.infoValue}>{mailingAddress}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
