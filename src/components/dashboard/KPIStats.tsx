'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './KPIStats.module.scss';

interface KPI {
    label: string;
    value: number;
    total: number;
    color: string;
}

function CircularProgress({ percentage, color, size = 80 }: { percentage: number; color: string; size?: number }) {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" className={styles.circularProgress}>
            {/* Background circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="9"
            />
            {/* Progress circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className={styles.progressCircle}
            />
        </svg>
    );
}

export function KPIStats() {
    const [stats, setStats] = useState<KPI[]>([
        { label: 'DECLARATIONS', value: 0, total: 1, color: '#14b8a6' },
        { label: 'PARSED', value: 0, total: 1, color: '#3b82f6' },
        { label: 'PENDING', value: 0, total: 1, color: '#a855f7' },
    ]);
    const [totalLabel, setTotalLabel] = useState('Loading...');

    useEffect(() => {
        const load = async () => {
            try {
                // Total dec pages
                const { count: totalDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true });

                // Parsed (complete) dec pages
                const { count: parsedDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true })
                    .eq('parse_status', 'complete');

                // Pending/processing dec pages
                const { count: pendingDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true })
                    .in('parse_status', ['pending', 'processing', 'partial']);

                const total = totalDecs ?? 0;
                const parsed = parsedDecs ?? 0;
                const pending = pendingDecs ?? 0;

                setStats([
                    { label: 'DECLARATIONS', value: total, total: Math.max(total, 1), color: '#14b8a6' },
                    { label: 'PARSED', value: parsed, total: Math.max(total, 1), color: '#3b82f6' },
                    { label: 'PENDING', value: pending, total: Math.max(total, 1), color: '#a855f7' },
                ]);
                setTotalLabel(`${total.toLocaleString()} total declarations`);
            } catch (error) {
                console.error('Error loading KPI stats:', error);
                setTotalLabel('Error loading data');
            }
        };

        load();
    }, []);

    return (
        <div className={styles.statsContainer}>
            <div className={styles.statsGrid}>
                {stats.map((stat, index) => {
                    const percentage = stat.total > 0 ? Math.round((stat.value / stat.total) * 100) : 0;

                    return (
                        <div key={index} className={styles.statCard}>
                            <div className={styles.circularWrapper}>
                                <CircularProgress percentage={percentage} color={stat.color} />
                                <div className={styles.statValue}>
                                    <div className={styles.number}>{stat.value.toLocaleString()}</div>
                                    <div className={styles.label}>{stat.label}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className={styles.totalsInfo}>
                <span className={styles.totalsLabel}>TOTALS</span>
                <span className={styles.totalsValue}>{totalLabel}</span>
            </div>
        </div>
    );
}
