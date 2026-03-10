'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Clock, Calendar, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import styles from './InfoCards.module.css';

interface InfoCard {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}

export function InfoCards() {
    const [cards, setCards] = useState<InfoCard[]>([
        { title: 'Policies', value: '—', icon: FileText, color: '#14b8a6' },
        { title: 'Clients', value: '—', icon: Users, color: '#8b5cf6' },
        { title: 'Policies Pending Review', value: '—', icon: Clock, color: '#f59e0b' },
        { title: 'Renewals This Week', value: '—', icon: Calendar, color: '#3b82f6' },
    ]);

    useEffect(() => {
        const load = async () => {
            try {
                // Total policies count
                const { count: totalPolicies } = await supabase
                    .from('policies')
                    .select('*', { count: 'exact', head: true });

                // Total clients count
                const { count: totalClients } = await supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true });

                // Policies pending review (status = 'pending_review' or 'unknown')
                const { count: pendingReview } = await supabase
                    .from('policies')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['pending_review', 'unknown']);

                // Renewals this week: policy_terms with expiration_date within next 7 days
                const today = new Date();
                const weekFromNow = new Date(today);
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                const todayStr = today.toISOString().split('T')[0];
                const weekStr = weekFromNow.toISOString().split('T')[0];

                const { count: renewalsThisWeek } = await supabase
                    .from('policy_terms')
                    .select('*', { count: 'exact', head: true })
                    .gte('expiration_date', todayStr)
                    .lte('expiration_date', weekStr);

                setCards([
                    { title: 'Policies', value: (totalPolicies ?? 0).toLocaleString(), icon: FileText, color: '#14b8a6' },
                    { title: 'Clients', value: (totalClients ?? 0).toLocaleString(), icon: Users, color: '#8b5cf6' },
                    { title: 'Policies Pending Review', value: (pendingReview ?? 0).toLocaleString(), icon: Clock, color: '#f59e0b' },
                    { title: 'Renewals This Week', value: (renewalsThisWeek ?? 0).toLocaleString(), icon: Calendar, color: '#3b82f6' },
                ]);
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
            }
        };

        load();
    }, []);

    return (
        <div className={styles.grid}>
            {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <div key={index} className={styles.card}>
                        <div className={styles.iconWrapper} style={{ backgroundColor: `${card.color}15` }}>
                            <Icon className={styles.icon} style={{ color: card.color }} />
                        </div>
                        <div className={styles.content}>
                            <div className={styles.title}>{card.title}</div>
                            <div className={styles.value}>{card.value}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
