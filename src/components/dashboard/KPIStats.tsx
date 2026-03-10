'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './KPIStats.module.scss';
import { Flag, ShieldAlert, CalendarClock, ArrowRight, AlertTriangle, Search } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    sublabel?: string;
    icon: React.ElementType;
    color: string;
    subIcon?: React.ElementType;
}

function MetricCard({ title, value, sublabel, icon: Icon, color, subIcon: SubIcon }: MetricCardProps) {
    return (
        <div className={styles.statCard} style={{ cursor: 'pointer' }}>
            <div className={styles.decoration} style={{ color: color }} />
            <div className={styles.iconWrapper} style={{ backgroundColor: `${color}15`, color: color }}>
                <Icon size={20} />
            </div>
            <div className={styles.content}>
                <div className={styles.value}>{value}</div>
                <div className={styles.label}>{title}</div>
                {sublabel && (
                    <div className={styles.sublabel}>
                        {SubIcon && <SubIcon size={12} style={{ color: color }} />}
                        {sublabel}
                    </div>
                )}
            </div>
        </div>
    );
}

export function KPIStats() {
    const [stats, setStats] = useState({
        highFlags: 0,
        missingDic: 0,
        expiringSoon: 0,
        loading: true
    });

    useEffect(() => {
        const load = async () => {
            try {
                // 1. High Severity Flags (unresolved critical + warning)
                const { count: flagsCount } = await supabase
                    .from('policy_flags')
                    .select('*', { count: 'exact', head: true })
                    .in('severity', ['critical', 'warning'])
                    .is('resolved_at', null);

                // 2. Missing DIC (Active term, no DIC)
                const today = new Date().toISOString().split('T')[0];
                const { count: dicCount } = await supabase
                    .from('policy_terms')
                    .select('*', { count: 'exact', head: true })
                    .eq('dic_exists', false)
                    .gte('expiration_date', today);

                // 3. Expiring Soon (Next 30 Days)
                const thirtyDays = new Date();
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];

                const { count: expiringCount } = await supabase
                    .from('policy_terms')
                    .select('*', { count: 'exact', head: true })
                    .gte('expiration_date', today)
                    .lte('expiration_date', thirtyDaysStr);

                setStats({
                    highFlags: flagsCount ?? 0,
                    missingDic: dicCount ?? 0,
                    expiringSoon: expiringCount ?? 0,
                    loading: false
                });
            } catch (error) {
                console.error('Error loading operational KPI stats:', error);
                setStats(s => ({ ...s, loading: false }));
            }
        };

        load();
    }, []);

    if (stats.loading) {
        return (
            <div className={styles.statsGrid}>
                {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.statCard} style={{ opacity: 0.5, minHeight: '140px' }}>
                        <div className={styles.iconWrapper} style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                        <div className={styles.content}>
                            <div className={styles.value} style={{ color: 'transparent', backgroundColor: 'rgba(255,255,255,0.1)', width: '50px', borderRadius: '4px' }}>-</div>
                            <div className={styles.label} style={{ color: 'transparent', backgroundColor: 'rgba(255,255,255,0.1)', width: '80px', borderRadius: '4px', marginTop: '4px' }}>-</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={styles.statsGrid}>
            <MetricCard
                title="High Severity Flags"
                value={stats.highFlags.toLocaleString()}
                sublabel={stats.highFlags > 0 ? "Immediate attention required" : "All clear"}
                icon={Flag}
                color={stats.highFlags > 0 ? "#ef4444" : "#10b981"} // Red or Emerald
                subIcon={stats.highFlags > 0 ? AlertTriangle : ArrowRight}
            />
            <MetricCard
                title="Missing DIC Coverage"
                value={stats.missingDic.toLocaleString()}
                sublabel="Current terms missing DIC"
                icon={ShieldAlert}
                color={stats.missingDic > 0 ? "#8b5cf6" : "#64748b"} // Purple or Slate
                subIcon={Search}
            />
            <MetricCard
                title="Expiring Soon"
                value={stats.expiringSoon.toLocaleString()}
                sublabel="Renewals inside 30 days"
                icon={CalendarClock}
                color="#3b82f6" // Blue
                subIcon={ArrowRight}
            />
        </div>
    );
}
