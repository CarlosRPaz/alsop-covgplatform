'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    fetchFlagsByPolicyId,
    resolveFlag,
    unresolveFlag,
    updateFlag,
    createFlag,
    PolicyFlagRow,
} from '@/lib/api';
import { Button } from '@/components/ui/Button/Button';
import {
    Flag,
    CheckCircle,
    RotateCcw,
    Pencil,
    Plus,
    X,
    AlertTriangle,
    Info,
    AlertCircle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import styles from './PolicyFlags.module.scss';

interface PolicyFlagsProps {
    policyId: string;
}

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
    critical: <AlertCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
};

export function PolicyFlags({ policyId }: PolicyFlagsProps) {
    const [flags, setFlags] = useState<PolicyFlagRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showResolved, setShowResolved] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', message: '', severity: 'info' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ code: '', severity: 'info', title: '', message: '' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadFlags = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFlagsByPolicyId(policyId);
            setFlags(data);
        } catch (error) {
            console.error('Error loading flags:', error);
        } finally {
            setLoading(false);
        }
    }, [policyId]);

    useEffect(() => {
        loadFlags();
    }, [loadFlags]);

    const activeFlags = flags.filter(f => !f.resolved_at);
    const resolvedFlags = flags.filter(f => !!f.resolved_at);

    const handleResolve = async (flagId: string) => {
        setActionLoading(flagId);
        const ok = await resolveFlag(flagId);
        if (ok) await loadFlags();
        setActionLoading(null);
    };

    const handleUnresolve = async (flagId: string) => {
        setActionLoading(flagId);
        const ok = await unresolveFlag(flagId);
        if (ok) await loadFlags();
        setActionLoading(null);
    };

    const startEdit = (flag: PolicyFlagRow) => {
        setEditingId(flag.id);
        setEditForm({
            title: flag.title,
            message: flag.message || '',
            severity: flag.severity,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        setActionLoading(editingId);
        const ok = await updateFlag(editingId, editForm);
        if (ok) {
            setEditingId(null);
            await loadFlags();
        }
        setActionLoading(null);
    };

    const handleAddFlag = async () => {
        if (!addForm.code.trim() || !addForm.title.trim()) return;
        setActionLoading('add');
        const result = await createFlag(policyId, addForm);
        if (result) {
            setShowAddForm(false);
            setAddForm({ code: '', severity: 'info', title: '', message: '' });
            await loadFlags();
        }
        setActionLoading(null);
    };

    const formatDate = (d?: string | null) => {
        if (!d) return '';
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderFlagCard = (flag: PolicyFlagRow) => {
        const isEditing = editingId === flag.id;
        const isResolved = !!flag.resolved_at;
        const isLoading = actionLoading === flag.id;

        return (
            <div
                key={flag.id}
                className={`${styles.flagCard} ${isResolved ? styles.flagResolved : ''} ${styles[`severity${flag.severity}`]}`}
            >
                {isEditing ? (
                    <div className={styles.editForm}>
                        <div className={styles.editRow}>
                            <label>Title</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.editRow}>
                            <label>Severity</label>
                            <select
                                value={editForm.severity}
                                onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))}
                                className={styles.select}
                            >
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div className={styles.editRow}>
                            <label>Message</label>
                            <textarea
                                value={editForm.message}
                                onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                                className={styles.textarea}
                                rows={2}
                            />
                        </div>
                        <div className={styles.editActions}>
                            <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={isLoading}>
                                Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.flagHeader}>
                            <span className={`${styles.severityBadge} ${styles[`sev${flag.severity}`]}`}>
                                {SEVERITY_ICONS[flag.severity]}
                                {flag.severity}
                            </span>
                            <span className={styles.flagCode}>{flag.code}</span>
                            <span className={styles.flagSource}>
                                {flag.source === 'ai' ? 'AI' : flag.source === 'rule' ? 'Rule' : flag.source === 'user' ? 'Manual' : flag.source}
                            </span>
                            {isResolved && (
                                <span className={styles.resolvedBadge}>
                                    <CheckCircle size={12} /> Resolved
                                </span>
                            )}
                        </div>
                        <div className={styles.flagTitle}>{flag.title}</div>
                        {flag.message && <div className={styles.flagMessage}>{flag.message}</div>}
                        <div className={styles.flagMeta}>
                            <span>{formatDate(flag.created_at)}</span>
                            {flag.resolved_at && <span>Resolved {formatDate(flag.resolved_at)}</span>}
                        </div>
                        <div className={styles.flagActions}>
                            {!isResolved ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResolve(flag.id)}
                                    disabled={isLoading}
                                    className={styles.actionBtn}
                                >
                                    <CheckCircle size={14} /> Resolve
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnresolve(flag.id)}
                                    disabled={isLoading}
                                    className={styles.actionBtn}
                                >
                                    <RotateCcw size={14} /> Unresolve
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(flag)}
                                className={styles.actionBtn}
                            >
                                <Pencil size={14} /> Edit
                            </Button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading flags...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Flag size={20} />
                    <h2 className={styles.title}>Policy Flags</h2>
                    <span className={styles.countBadge}>{activeFlags.length} active</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                    className={styles.addButton}
                >
                    <Plus size={14} /> Add Flag
                </Button>
            </div>

            {/* Add flag form */}
            {showAddForm && (
                <div className={styles.addFormCard}>
                    <div className={styles.addFormHeader}>
                        <span>Add New Flag</span>
                        <button className={styles.closeBtn} onClick={() => setShowAddForm(false)}>
                            <X size={16} />
                        </button>
                    </div>
                    <div className={styles.formGrid}>
                        <div className={styles.formField}>
                            <label>Code *</label>
                            <input
                                type="text"
                                placeholder="e.g. RENEWAL_SOON"
                                value={addForm.code}
                                onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.formField}>
                            <label>Severity *</label>
                            <select
                                value={addForm.severity}
                                onChange={e => setAddForm(f => ({ ...f, severity: e.target.value }))}
                                className={styles.select}
                            >
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div className={`${styles.formField} ${styles.fullWidth}`}>
                            <label>Title *</label>
                            <input
                                type="text"
                                placeholder="Short descriptive title"
                                value={addForm.title}
                                onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                className={styles.input}
                            />
                        </div>
                        <div className={`${styles.formField} ${styles.fullWidth}`}>
                            <label>Message</label>
                            <textarea
                                placeholder="Optional details..."
                                value={addForm.message}
                                onChange={e => setAddForm(f => ({ ...f, message: e.target.value }))}
                                className={styles.textarea}
                                rows={2}
                            />
                        </div>
                    </div>
                    <div className={styles.formActions}>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAddFlag}
                            disabled={!addForm.code.trim() || !addForm.title.trim() || actionLoading === 'add'}
                        >
                            Create Flag
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Active flags */}
            {activeFlags.length === 0 && !showAddForm ? (
                <div className={styles.emptyState}>
                    <CheckCircle size={24} />
                    <p>No active flags on this policy.</p>
                </div>
            ) : (
                <div className={styles.flagList}>
                    {activeFlags.map(renderFlagCard)}
                </div>
            )}

            {/* Resolved flags toggle */}
            {resolvedFlags.length > 0 && (
                <div className={styles.resolvedSection}>
                    <button
                        className={styles.resolvedToggle}
                        onClick={() => setShowResolved(!showResolved)}
                    >
                        {showResolved ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {resolvedFlags.length} resolved {resolvedFlags.length === 1 ? 'flag' : 'flags'}
                    </button>
                    {showResolved && (
                        <div className={styles.flagList}>
                            {resolvedFlags.map(renderFlagCard)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
