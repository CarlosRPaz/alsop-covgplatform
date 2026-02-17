'use client';

import React from 'react';
import styles from './DashboardChart.module.css';

interface ChartData {
    label: string;
    value1: number;
    value2: number;
}

const mockData: ChartData[] = [
    { label: 'S', value1: 120, value2: 80 },
    { label: 'M', value1: 180, value2: 140 },
    { label: 'T', value1: 220, value2: 180 },
    { label: 'W', value1: 160, value2: 120 },
    { label: 'T', value1: 200, value2: 160 },
    { label: 'F', value1: 240, value2: 200 },
    { label: 'S', value1: 140, value2: 100 },
    { label: 'S', value1: 110, value2: 70 },
    { label: 'M', value1: 190, value2: 150 },
    { label: 'T', value1: 210, value2: 170 },
    { label: 'W', value1: 180, value2: 140 },
    { label: 'T', value1: 220, value2: 180 },
    { label: 'F', value1: 260, value2: 220 },
    { label: 'S', value1: 150, value2: 110 },
];

export function DashboardChart() {
    const maxValue = Math.max(...mockData.flatMap(d => [d.value1, d.value2]));

    return (
        <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                    <div className={styles.mainTitle}>Wednesday, December 3</div>
                    <div className={styles.subtitle}>342 Applicants / 27 Interviews</div>
                </div>
                <div className={styles.chartLegend}>
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ backgroundColor: '#14b8a6' }}></div>
                        <span>Applicants</span>
                    </div>
                    <div className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ backgroundColor: '#6366f1' }}></div>
                        <span>Interviews</span>
                    </div>
                </div>
            </div>

            <div className={styles.chart}>
                <div className={styles.yAxis}>
                    <span>600</span>
                    <span>450</span>
                    <span>300</span>
                    <span>150</span>
                    <span>0</span>
                </div>
                <div className={styles.chartContent}>
                    {mockData.map((data, index) => {
                        const height1 = (data.value1 / maxValue) * 100;
                        const height2 = (data.value2 / maxValue) * 100;

                        return (
                            <div key={index} className={styles.barGroup}>
                                <div className={styles.bars}>
                                    <div
                                        className={styles.bar}
                                        style={{
                                            height: `${height1}%`,
                                            backgroundColor: '#14b8a6'
                                        }}
                                    ></div>
                                    <div
                                        className={styles.bar}
                                        style={{
                                            height: `${height2}%`,
                                            backgroundColor: '#6366f1'
                                        }}
                                    ></div>
                                </div>
                                <div className={styles.barLabel}>{data.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={styles.chartFooter}>
                <span>APPLICANTS/DAY</span>
            </div>
        </div>
    );
}
