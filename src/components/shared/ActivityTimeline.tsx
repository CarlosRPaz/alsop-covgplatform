'use client';

import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, UserPlus, Clock } from 'lucide-react';
import styles from './ActivityTimeline.module.css';
import { supabase } from '@/lib/supabaseClient';

interface ActivityEvent {
    id: string;
    type: 'dec_upload' | 'term_renewal' | 'client_created' | 'policy_created';
    title: string;
    detail?: string;
    timestamp: string;
}

interface ActivityTimelineProps {
    clientId?: string;
    policyId?: string;
}

export function ActivityTimeline({ clientId, policyId }: ActivityTimelineProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const items: ActivityEvent[] = [];

                if (policyId) {
                    // Dec pages for this policy
                    const { data: decPages } = await supabase
                        .from('dec_pages')
                        .select('id, created_at, insured_name, policy_number, parse_status')
                        .eq('policy_id', policyId)
                        .order('created_at', { ascending: false });

                    (decPages || []).forEach((dp: { id: string; created_at: string; insured_name?: string; policy_number?: string; parse_status?: string }) => {
                        items.push({
                            id: `dec-${dp.id}`,
                            type: 'dec_upload',
                            title: `Dec page uploaded`,
                            detail: dp.policy_number
                                ? `Policy ${dp.policy_number} — ${dp.parse_status || 'processing'}`
                                : dp.parse_status || 'processing',
                            timestamp: dp.created_at,
                        });
                    });

                    // Policy terms for this policy
                    const { data: terms } = await supabase
                        .from('policy_terms')
                        .select('id, created_at, effective_date, expiration_date, annual_premium')
                        .eq('policy_id', policyId)
                        .order('created_at', { ascending: false });

                    (terms || []).forEach((t: { id: string; created_at: string; effective_date?: string; expiration_date?: string; annual_premium?: number }) => {
                        items.push({
                            id: `term-${t.id}`,
                            type: 'term_renewal',
                            title: `Policy term recorded`,
                            detail: t.effective_date && t.expiration_date
                                ? `${t.effective_date} to ${t.expiration_date}${t.annual_premium ? ` • $${Number(t.annual_premium).toLocaleString()}` : ''}`
                                : 'Dates pending',
                            timestamp: t.created_at,
                        });
                    });
                }

                if (clientId) {
                    // Dec pages for this client
                    const { data: decPages } = await supabase
                        .from('dec_pages')
                        .select('id, created_at, insured_name, policy_number, parse_status')
                        .eq('client_id', clientId)
                        .order('created_at', { ascending: false });

                    (decPages || []).forEach((dp: { id: string; created_at: string; insured_name?: string; policy_number?: string; parse_status?: string }) => {
                        items.push({
                            id: `dec-${dp.id}`,
                            type: 'dec_upload',
                            title: `Dec page uploaded`,
                            detail: dp.policy_number
                                ? `Policy ${dp.policy_number}`
                                : dp.parse_status || 'processing',
                            timestamp: dp.created_at,
                        });
                    });

                    // Policies for this client
                    const { data: policies } = await supabase
                        .from('policies')
                        .select('id, created_at, policy_number, property_address_raw')
                        .eq('client_id', clientId)
                        .order('created_at', { ascending: false });

                    (policies || []).forEach((p: { id: string; created_at: string; policy_number?: string; property_address_raw?: string }) => {
                        items.push({
                            id: `policy-${p.id}`,
                            type: 'policy_created',
                            title: `Policy created`,
                            detail: p.policy_number || 'No policy number',
                            timestamp: p.created_at,
                        });
                    });
                }

                // Sort all events by timestamp descending
                items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
                setEvents(items);
            } catch (error) {
                console.error('Error loading activity:', error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [clientId, policyId]);

    const getIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'dec_upload': return <FileText size={16} />;
            case 'term_renewal': return <RefreshCw size={16} />;
            case 'client_created': return <UserPlus size={16} />;
            case 'policy_created': return <FileText size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });
        } catch {
            return ts;
        }
    };

    if (loading) {
        return <div className={styles.container}><p className={styles.loading}>Loading activity...</p></div>;
    }

    if (events.length === 0) {
        return <div className={styles.container}><p className={styles.empty}>No activity yet.</p></div>;
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Activity Timeline</h3>
            <div className={styles.timeline}>
                {events.map((e) => (
                    <div key={e.id} className={styles.event}>
                        <div className={`${styles.icon} ${styles[e.type]}`}>
                            {getIcon(e.type)}
                        </div>
                        <div className={styles.content}>
                            <div className={styles.eventTitle}>{e.title}</div>
                            {e.detail && <div className={styles.eventDetail}>{e.detail}</div>}
                            <div className={styles.eventTime}>{formatTime(e.timestamp)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
