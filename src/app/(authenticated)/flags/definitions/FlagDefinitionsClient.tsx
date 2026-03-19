'use client';

import React, { useState, useMemo } from 'react';
import { Search, Info, ShieldAlert, AlertTriangle, AlertCircle, Info as InfoIcon, X } from 'lucide-react';
import { FlagDefinition } from '@/lib/api';
import styles from './page.module.css';

interface FlagDefinitionsClientProps {
    initialDefinitions: FlagDefinition[];
}

export default function FlagDefinitionsClient({ initialDefinitions }: FlagDefinitionsClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [selectedFlag, setSelectedFlag] = useState<FlagDefinition | null>(null);

    // Categories
    const categories = useMemo(() => Array.from(new Set(initialDefinitions.map(f => f.category))), [initialDefinitions]);

    // Derived states
    const filteredDefs = useMemo(() => {
        return initialDefinitions.filter(def => {
            const matchesSearch = def.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                def.label.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = categoryFilter === 'all' || def.category === categoryFilter;
            const matchesSev = severityFilter === 'all' || def.default_severity === severityFilter;
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && def.is_active) ||
                (statusFilter === 'deferred' && !def.is_active);

            return matchesSearch && matchesCat && matchesSev && matchesStatus;
        });
    }, [initialDefinitions, searchTerm, categoryFilter, severityFilter, statusFilter]);

    // Summary counts
    const totalCount = initialDefinitions.length;
    const activeCount = initialDefinitions.filter(d => d.is_active).length;
    const deferredCount = initialDefinitions.filter(d => !d.is_active).length;

    const getSeverityDetails = (sev: string) => {
        switch (sev.toLowerCase()) {
            case 'critical': return { icon: <ShieldAlert size={14} />, colorClass: styles.sevCritical };
            case 'high': return { icon: <AlertTriangle size={14} />, colorClass: styles.sevHigh };
            case 'warning': return { icon: <AlertCircle size={14} />, colorClass: styles.sevWarning };
            case 'info': return { icon: <InfoIcon size={14} />, colorClass: styles.sevInfo };
            default: return { icon: <InfoIcon size={14} />, colorClass: styles.sevInfo };
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Flag Catalog</h1>
                <p className={styles.subtitle}>
                    This page shows all flags currently defined in the platform, including active, deferred, and future flags. It is the working reference for how the platform identifies issues and work items.
                </p>

                {/* Summary Strip */}
                <div className={styles.summaryStrip}>
                    <div className={styles.summaryMetric}>
                        <span className={styles.summaryLabel}>Total Flags</span>
                        <span className={styles.summaryValue}>{totalCount}</span>
                    </div>
                    <div className={styles.summaryMetric}>
                        <span className={styles.summaryLabel}>Active</span>
                        <span className={styles.summaryValue} style={{ color: 'var(--success-green)' }}>{activeCount}</span>
                    </div>
                    <div className={styles.summaryMetric}>
                        <span className={styles.summaryLabel}>Deferred</span>
                        <span className={styles.summaryValue} style={{ color: 'var(--text-muted)' }}>{deferredCount}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.controlsBar}>
                <div className={styles.searchBox}>
                    <Search className={styles.searchIcon} size={16} />
                    <input
                        type="text"
                        placeholder="Search flag codes or labels..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.filterGroup}>
                    <select className={styles.filterDropdown} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select className={styles.filterDropdown} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                    </select>

                    <select className={styles.filterDropdown} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="deferred">Deferred</option>
                    </select>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className={styles.layout}>

                {/* Table Area */}
                <div className={styles.tableRefContainer}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.flagsTable}>
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Label</th>
                                    <th>Category</th>
                                    <th>Severity</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDefs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className={styles.emptyState}>No flags found matching filters.</td>
                                    </tr>
                                )}
                                {filteredDefs.map(def => {
                                    const dev = getSeverityDetails(def.default_severity);
                                    const isSelected = selectedFlag?.code === def.code;

                                    return (
                                        <tr
                                            key={def.code}
                                            className={`${styles.flagRow} ${isSelected ? styles.selectedRow : ''}`}
                                            onClick={() => setSelectedFlag(def)}
                                        >
                                            <td><code className={styles.codeBadge}>{def.code}</code></td>
                                            <td className={styles.boldCell}>{def.label}</td>
                                            <td>
                                                <span className={styles.categoryPill}>{def.category}</span>
                                            </td>
                                            <td>
                                                <div className={`${styles.sevBadge} ${dev.colorClass}`}>
                                                    {dev.icon} <span className={styles.sevText}>{def.default_severity}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {def.is_active ?
                                                    <span className={styles.statusActive}>Active</span> :
                                                    <span className={styles.statusDeferred}>Deferred</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Side Panel (Static) */}
                <div className={styles.sideDrawer}>
                    {!selectedFlag ? (
                        <div className={styles.emptyDrawer}>
                            <Info size={40} className={styles.emptyDrawerIcon} />
                            <h3>No Flag Selected</h3>
                            <p>Select a flag from the table to view its detailed trigger logic and system configuration.</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.drawerHeader}>
                                <h2 className={styles.drawerTitle}>Flag Details</h2>
                            </div>

                            <div className={styles.drawerContent}>
                                <div className={styles.detailBlock}>
                                    <label>Label</label>
                                    <div className={styles.detailValueBold}>{selectedFlag.label}</div>
                                </div>

                                <div className={styles.detailBlock}>
                                    <label>Code</label>
                                    <div><code className={styles.codeBadgeLg}>{selectedFlag.code}</code></div>
                                </div>

                                <div className={styles.detailBlock}>
                                    <label>What triggers this?</label>
                                    <div className={styles.detailCard}>
                                        <Info size={16} className={styles.detailIcon} />
                                        <span>{selectedFlag.description || 'No description provided.'}</span>
                                    </div>
                                </div>

                                <div className={styles.grid2}>
                                    <div className={styles.detailBlock}>
                                        <label>Category</label>
                                        <div className={styles.categoryPill}>{selectedFlag.category}</div>
                                    </div>
                                    <div className={styles.detailBlock}>
                                        <label>Severity</label>
                                        <div className={`${styles.sevBadge} ${getSeverityDetails(selectedFlag.default_severity).colorClass}`} style={{ display: 'inline-flex' }}>
                                            {getSeverityDetails(selectedFlag.default_severity).icon}
                                            <span className={styles.sevText}>{selectedFlag.default_severity}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.grid2}>
                                    <div className={styles.detailBlock}>
                                        <label>Status</label>
                                        <div>
                                            {selectedFlag.is_active ?
                                                <span className={styles.statusActive}>Active</span> :
                                                <span className={styles.statusDeferred}>Deferred</span>
                                            }
                                        </div>
                                    </div>
                                    <div className={styles.detailBlock}>
                                        <label>Scope</label>
                                        <div className={styles.scopeBadge}>{selectedFlag.entity_scope}</div>
                                    </div>
                                </div>

                                <div className={styles.detailBlock}>
                                    <label>System Behaviors</label>
                                    <ul className={styles.behaviorList}>
                                        <li><strong>Auto-Resolve:</strong> {selectedFlag.auto_resolve ? 'Yes (Clears automatically if fixed)' : 'No (Requires manual dismissal)'}</li>
                                        <li><strong>Manual Triggers:</strong> {selectedFlag.is_manual_allowed ? 'Allowed' : 'Not Allowed'}</li>
                                    </ul>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
