'use client';

import React, { useState, useEffect } from 'react';
import {
    FileText, RefreshCw, UserPlus, Clock, MessageSquare,
    Pin, Archive, Pencil
} from 'lucide-react';
import styles from './ActivityTimeline.module.css';
import { fetchActivityEvents, ActivityEventRow } from '@/lib/notes';

interface ActivityTimelineProps {
    clientId?: string;
    policyId?: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; css: string }> = {
    'note.added': { icon: <MessageSquare size={16} />, css: 'note_event' },
    'note.edited': { icon: <Pencil size={16} />, css: 'note_event' },
    'note.archived': { icon: <Archive size={16} />, css: 'note_event' },
    'note.unarchived': { icon: <Archive size={16} />, css: 'note_event' },
    'note.pinned': { icon: <Pin size={16} />, css: 'note_event' },
    'note.unpinned': { icon: <Pin size={16} />, css: 'note_event' },
    'dec.uploaded': { icon: <FileText size={16} />, css: 'dec_upload' },
    'dec.parsed': { icon: <FileText size={16} />, css: 'dec_upload' },
    'term.created': { icon: <RefreshCw size={16} />, css: 'term_renewal' },
    'policy.created': { icon: <FileText size={16} />, css: 'policy_created' },
    'client.created': { icon: <UserPlus size={16} />, css: 'client_created' },
};

export function ActivityTimeline({ clientId, policyId }: ActivityTimelineProps) {
    const [events, setEvents] = useState<ActivityEventRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchActivityEvents({
                    clientId,
                    policyId,
                    limit: 50,
                });
                setEvents(data);
            } catch (error) {
                console.error('Error loading activity:', error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [clientId, policyId]);

    const getConfig = (eventType: string) => {
        return EVENT_CONFIG[eventType] || { icon: <Clock size={16} />, css: '' };
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
                {events.map((e) => {
                    const config = getConfig(e.event_type);
                    return (
                        <div key={e.id} className={styles.event}>
                            <div className={`${styles.icon} ${config.css ? styles[config.css] : ''}`}>
                                {config.icon}
                            </div>
                            <div className={styles.content}>
                                <div className={styles.eventTitle}>
                                    {e.title || e.event_type}
                                </div>
                                {e.detail && <div className={styles.eventDetail}>{e.detail}</div>}
                                <div className={styles.eventTime}>{formatTime(e.created_at)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
