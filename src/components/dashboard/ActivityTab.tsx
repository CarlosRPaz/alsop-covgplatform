'use client';

import React from 'react';
import { AlertTriangle, TrendingUp, Users, FileText } from 'lucide-react';
import styles from './ActivityTab.module.css';

interface ActivityItem {
    id: string;
    type: 'upload' | 'review' | 'approval' | 'flag';
    title: string;
    description: string;
    timestamp: string;
    user: string;
}

const sampleActivities: ActivityItem[] = [
    {
        id: '1',
        type: 'upload',
        title: 'New Policy Uploaded',
        description: 'Policy HO-555013-13 uploaded by Sarah Martinez',
        timestamp: '2 minutes ago',
        user: 'Sarah Martinez',
    },
    {
        id: '2',
        type: 'review',
        title: 'Policy Review Completed',
        description: 'Review completed for Policy HO-983274-23',
        timestamp: '15 minutes ago',
        user: 'John Smith',
    },
    {
        id: '3',
        type: 'flag',
        title: 'High Severity Flag Detected',
        description: 'Wildfire Zone flag added to Policy HO-555005-05',
        timestamp: '1 hour ago',
        user: 'System',
    },
    {
        id: '4',
        type: 'approval',
        title: 'Policy Approved',
        description: 'Policy HO-555006-06 approved by David Chen',
        timestamp: '2 hours ago',
        user: 'David Chen',
    },
    {
        id: '5',
        type: 'upload',
        title: 'Bulk Upload Completed',
        description: '15 policies uploaded successfully',
        timestamp: '3 hours ago',
        user: 'Emily Rodriguez',
    },
    {
        id: '6',
        type: 'review',
        title: 'Policy Review Started',
        description: 'Review initiated for Policy HO-555007-07',
        timestamp: '4 hours ago',
        user: 'Michael Brown',
    },
];

function getActivityIcon(type: ActivityItem['type']) {
    switch (type) {
        case 'upload':
            return FileText;
        case 'review':
            return TrendingUp;
        case 'approval':
            return Users;
        case 'flag':
            return AlertTriangle;
    }
}

function getActivityColor(type: ActivityItem['type']) {
    switch (type) {
        case 'upload':
            return '#14b8a6'; // Teal
        case 'review':
            return '#3b82f6'; // Blue
        case 'approval':
            return '#10b981'; // Green
        case 'flag':
            return '#ef4444'; // Red
    }
}

export function ActivityTab() {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Recent Activity</h2>
                <p className={styles.subtitle}>Track all actions and updates across your policies</p>
            </div>

            <div className={styles.timeline}>
                {sampleActivities.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    const color = getActivityColor(activity.type);

                    return (
                        <div key={activity.id} className={styles.activityItem}>
                            <div className={styles.iconWrapper} style={{ backgroundColor: `${color}15` }}>
                                <Icon className={styles.icon} style={{ color }} />
                            </div>
                            <div className={styles.content}>
                                <div className={styles.activityTitle}>{activity.title}</div>
                                <div className={styles.description}>{activity.description}</div>
                                <div className={styles.meta}>
                                    <span className={styles.timestamp}>{activity.timestamp}</span>
                                    <span className={styles.separator}>•</span>
                                    <span className={styles.user}>{activity.user}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
