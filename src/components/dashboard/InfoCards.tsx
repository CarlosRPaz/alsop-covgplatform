'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Clock, Calendar, AlertCircle } from 'lucide-react';
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
        { title: 'Active Policies', value: '—', icon: FileText, color: '#14b8a6' },
        { title: 'Missing Premium Data', value: '—', icon: AlertCircle, color: '#f43f5e' }, // Rose
        { title: 'Policies Pending Review', value: '—', icon: Clock, color: '#f59e0b' },
        { title: 'Renewals This Week', value: '—', icon: Calendar, color: '#3b82f6' },
    ]);

    useEffect(() => {
        const load = async () => {
            try {
                // Active policies count
                const { count: activePolicies } = await supabase
                    .from('policies')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'active');

                // Missing Premium Data (is_current = true and premium is null or 0)
                const { count: missingPremium } = await supabase
                    .from('policy_terms')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_current', true)
                    .or('annual_premium.is.null,annual_premium.eq.0');

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
                    { title: 'Active Policies', value: (activePolicies ?? 0).toLocaleString(), icon: FileText, color: '#14b8a6' },
                    { title: 'Missing Premium Data', value: (missingPremium ?? 0).toLocaleString(), icon: AlertCircle, color: '#f43f5e' },
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
