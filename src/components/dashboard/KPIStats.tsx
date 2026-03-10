'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './KPIStats.module.scss';
import { FileUp, Loader2, CheckCircle, TrendingUp, AlertCircle, Clock } from 'lucide-react';

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
        <div className={styles.statCard}>
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
        totalUploads: 0,
        pendingProcessing: 0,
        successRate: 0,
        loading: true
    });

    useEffect(() => {
        const load = async () => {
            try {
                // 1. Total uploads (all dec pages)
                const { count: totalDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true });

                const total = totalDecs ?? 0;

                // 2. Pending processing (pending, processing, partial)
                const { count: pendingDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true })
                    .in('parse_status', ['pending', 'processing', 'partial']);

                const pending = pendingDecs ?? 0;

                // 3. Success rate (policies successfully linked to dec pages)
                // Since this might be complex to join properly to get a true 1:1, 
                // we can look at dec pages that are 'complete'
                const { count: completedDecs } = await supabase
                    .from('dec_pages')
                    .select('*', { count: 'exact', head: true })
                    .eq('parse_status', 'complete');

                const completed = completedDecs ?? 0;
                const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

                setStats({
                    totalUploads: total,
                    pendingProcessing: pending,
                    successRate: successRate,
                    loading: false
                });
            } catch (error) {
                console.error('Error loading KPI stats:', error);
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
                title="Total Uploads"
                value={stats.totalUploads.toLocaleString()}
                sublabel="Lifetime declarations"
                icon={FileUp}
                color="#6366f1" // Indigo
                subIcon={TrendingUp}
            />
            <MetricCard
                title="Parsing Queue"
                value={stats.pendingProcessing.toLocaleString()}
                sublabel={stats.pendingProcessing > 0 ? "Worker actively processing" : "All files processed"}
                icon={Loader2}
                color={stats.pendingProcessing > 0 ? "#f59e0b" : "#10b981"} // Amber or Emerald
                subIcon={stats.pendingProcessing > 0 ? Clock : CheckCircle}
            />
            <MetricCard
                title="Success Rate"
                value={`${stats.successRate}%`}
                sublabel={stats.successRate < 90 && stats.totalUploads > 0 ? "Review failed parses" : "High accuracy"}
                icon={CheckCircle}
                color={stats.successRate < 90 && stats.totalUploads > 0 ? "#ef4444" : "#14b8a6"} // Red or Teal
                subIcon={stats.successRate < 90 && stats.totalUploads > 0 ? AlertCircle : TrendingUp}
            />
        </div>
    );
}
