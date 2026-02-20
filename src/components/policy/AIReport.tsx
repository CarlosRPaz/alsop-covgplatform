import { AIReportData } from '@/lib/api';
import styles from './AIReport.module.css';
import { Card } from '../ui/Card/Card';
import { AlertTriangle, Flag, Lightbulb, Sparkles } from 'lucide-react';

interface AIReportProps {
    data: AIReportData;
}

export function AIReport({ data }: AIReportProps) {
    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <Sparkles className={styles.aiIcon} size={24} />
                <h2>AI Generated Report</h2>
            </div>

            <div className={styles.grid}>
                {/* Coverage Gaps */}
                <div className={`${styles.section} ${styles.gaps}`}>
                    <div className={styles.sectionHeader}>
                        <AlertTriangle size={20} />
                        <h3>Coverage Gaps</h3>
                    </div>
                    <ul className={styles.list}>
                        {data.coverageGaps.map((gap, index) => (
                            <li key={index}>{gap}</li>
                        ))}
                    </ul>
                </div>

                {/* Specific Flags */}
                <div className={`${styles.section} ${styles.flags}`}>
                    <div className={styles.sectionHeader}>
                        <Flag size={20} />
                        <h3>Specific Flags</h3>
                    </div>
                    <ul className={styles.list}>
                        {data.flagDetails.map((flag, index) => (
                            <li key={index}>{flag}</li>
                        ))}
                    </ul>
                </div>

                {/* Suggestions */}
                <div className={`${styles.section} ${styles.suggestions}`}>
                    <div className={styles.sectionHeader}>
                        <Lightbulb size={20} />
                        <h3>Suggestions</h3>
                    </div>
                    <ul className={styles.list}>
                        {data.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </Card>
    );
}
