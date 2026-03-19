'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    onClick?: () => void;
}

function MetricCard({ title, value, sublabel, icon: Icon, color, subIcon: SubIcon, onClick }: MetricCardProps) {
    return (
        <div className={styles.statCard} style={{ cursor: 'pointer' }} onClick={onClick} role="link">
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
    const router = useRouter();
    const [stats, setStats] = useState({
        highFlags: 0,
        missingDicPolicies: 0,
        expiringSoon: 0,
        loading: true
    });

    useEffect(() => {
        const load = async () => {
            try {
                // 1. High Severity Flags — exact count of critical + high flags
                const { count: flagsCount } = await supabase
                    .from('policy_flags')
                    .select('*', { count: 'exact', head: true })
                    .in('severity', ['critical', 'high'])
                    .eq('status', 'open');

                // 2. Missing DIC — count of POLICIES (not terms) missing DIC
                // We count current terms where dic_exists = false, grouped by policy
                const today = new Date().toISOString().split('T')[0];
                const { data: dicData } = await supabase
                    .from('policy_terms')
                    .select('policy_id')
                    .eq('dic_exists', false)
                    .eq('is_current', true)
                    .gte('expiration_date', today);

                // Deduplicate by policy_id
                const uniquePolicies = new Set((dicData || []).map(d => d.policy_id));

                // 3. Expiring Soon — count of POLICIES expiring within 30 days
                const thirtyDays = new Date();
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];

                const { data: expiringData } = await supabase
                    .from('policy_terms')
                    .select('policy_id')
                    .eq('is_current', true)
                    .gte('expiration_date', today)
                    .lte('expiration_date', thirtyDaysStr);

                const uniqueExpiringPolicies = new Set((expiringData || []).map(d => d.policy_id));

                setStats({
                    highFlags: flagsCount ?? 0,
                    missingDicPolicies: uniquePolicies.size,
                    expiringSoon: uniqueExpiringPolicies.size,
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
                sublabel={stats.highFlags > 0 ? "Critical & high flags open" : "All clear"}
                icon={Flag}
                color={stats.highFlags > 0 ? "#ef4444" : "#10b981"}
                subIcon={stats.highFlags > 0 ? AlertTriangle : ArrowRight}
                onClick={() => router.push('/flags?severity=critical')}
            />
            <MetricCard
                title="Policies Missing DIC"
                value={stats.missingDicPolicies.toLocaleString()}
                sublabel="Active policies without DIC"
                icon={ShieldAlert}
                color={stats.missingDicPolicies > 0 ? "#8b5cf6" : "#64748b"}
                subIcon={Search}
                onClick={() => router.push('/flags?code=NO_DIC')}
            />
            <MetricCard
                title="Expiring Soon"
                value={stats.expiringSoon.toLocaleString()}
                sublabel="Policies renewing in 30 days"
                icon={CalendarClock}
                color="#3b82f6"
                subIcon={ArrowRight}
                onClick={() => router.push('/dashboard?renewal_window=30')}
            />
        </div>
    );
}
