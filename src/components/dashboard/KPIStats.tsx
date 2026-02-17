import React from 'react';
import styles from './KPIStats.module.scss';

interface KPI {
    label: string;
    value: number;
    total: number;
    color: string;
}

const stats: KPI[] = [
    { label: 'DECLARATIONS', value: 3154, total: 5000, color: '#14b8a6' }, // Teal
    { label: 'APPROVED', value: 1546, total: 3154, color: '#3b82f6' }, // Blue
    { label: 'PENDING', value: 912, total: 3154, color: '#a855f7' }, // Purple
];

function CircularProgress({ percentage, color, size = 120 }: { percentage: number; color: string; size?: number }) {
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
                strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="8"
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
    return (
        <div className={styles.statsContainer}>
            <div className={styles.statsGrid}>
                {stats.map((stat, index) => {
                    const percentage = Math.round((stat.value / stat.total) * 100);

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
                <span className={styles.totalsValue}>Out of 5,231 views</span>
            </div>
        </div>
    );
}
