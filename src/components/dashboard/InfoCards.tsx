import React from 'react';
import { FileText, Clock, Calendar } from 'lucide-react';
import styles from './InfoCards.module.css';

interface InfoCard {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}

const cards: InfoCard[] = [
    {
        title: 'Policies Uploaded',
        value: '1,248',
        icon: FileText,
        color: '#14b8a6', // Teal
    },
    {
        title: 'Policies Pending Review',
        value: '45',
        icon: Clock,
        color: '#f59e0b', // Amber
    },
    {
        title: 'Renewals This Week',
        value: '28',
        icon: Calendar,
        color: '#3b82f6', // Blue
    },
];

export function InfoCards() {
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
