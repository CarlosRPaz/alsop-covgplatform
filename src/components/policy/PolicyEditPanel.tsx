'use client';

import React, { useState } from 'react';
import { X, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { updatePolicy, updatePolicyTerm, PolicyDetail } from '@/lib/api';
import { insertActivityEvent } from '@/lib/notes';
import styles from './PolicyEditPanel.module.css';

interface PolicyEditPanelProps {
    policyDetail: PolicyDetail;
    onClose: () => void;
    onSaved: () => void;
}

// Parse a formatted currency string like "$1,234.56" into a number
function parseCurrency(value: string): number | null {
    const cleaned = value.replace(/[$,\s]/g, '');
    if (cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

export function PolicyEditPanel({ policyDetail, onClose, onSaved }: PolicyEditPanelProps) {
    // Policy header form
    const [policyForm, setPolicyForm] = useState({
        policy_number: policyDetail.policy_number || '',
        carrier_name: policyDetail.carrier_name || '',
        status: policyDetail.status || '',
    });

    // Current term form
    const [termForm, setTermForm] = useState({
        effective_date: policyDetail.effective_date || '',
        expiration_date: policyDetail.expiration_date || '',
        annual_premium: policyDetail.annual_premium_raw != null ? String(policyDetail.annual_premium_raw) : '',
        policy_activity: policyDetail.policy_activity || '',
        carrier_status: policyDetail.carrier_status || '',
        payment_status: policyDetail.payment_status || '',
        payment_plan: policyDetail.payment_plan || '',
        cancellation_reason: policyDetail.cancellation_reason || '',
        dic_exists: policyDetail.dic_exists ?? false,
        dic_policy_number: policyDetail.dic_policy_number || '',
        sold_by: policyDetail.sold_by || '',
        office: policyDetail.office || '',
        is_current: policyDetail.is_current ?? true,
    });

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        // --- Determine changed policy header fields ---
        const policyChanges: Record<string, string> = {};
        const policyChangedFields: string[] = [];
        if (policyForm.policy_number !== (policyDetail.policy_number || '')) {
            policyChanges.policy_number = policyForm.policy_number;
            policyChangedFields.push('policy_number');
        }
        if (policyForm.carrier_name !== (policyDetail.carrier_name || '')) {
            policyChanges.carrier_name = policyForm.carrier_name;
            policyChangedFields.push('carrier_name');
        }
        if (policyForm.status !== (policyDetail.status || '')) {
            policyChanges.status = policyForm.status;
            policyChangedFields.push('status');
        }

        // --- Determine changed term fields ---
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const termChanges: Record<string, any> = {};
        const termChangedFields: string[] = [];

        if (termForm.effective_date !== (policyDetail.effective_date || '')) {
            if (termForm.effective_date && isNaN(Date.parse(termForm.effective_date))) {
                setMessage({ type: 'error', text: 'Invalid effective date format' });
                setSaving(false);
                return;
            }
            termChanges.effective_date = termForm.effective_date || null;
            termChangedFields.push('effective_date');
        }
        if (termForm.expiration_date !== (policyDetail.expiration_date || '')) {
            if (termForm.expiration_date && isNaN(Date.parse(termForm.expiration_date))) {
                setMessage({ type: 'error', text: 'Invalid expiration date format' });
                setSaving(false);
                return;
            }
            termChanges.expiration_date = termForm.expiration_date || null;
            termChangedFields.push('expiration_date');
        }

        const premiumRawStr = String(policyDetail.annual_premium_raw ?? '');
        if (termForm.annual_premium !== premiumRawStr) {
            if (termForm.annual_premium) {
                const parsed = parseCurrency(termForm.annual_premium);
                if (parsed === null) {
                    setMessage({ type: 'error', text: 'Invalid premium value. Enter a number like 1234.56 or $1,234.56' });
                    setSaving(false);
                    return;
                }
                termChanges.annual_premium = parsed;
            } else {
                termChanges.annual_premium = null;
            }
            termChangedFields.push('annual_premium');
        }

        if (termForm.policy_activity !== (policyDetail.policy_activity || '')) {
            termChanges.policy_activity = termForm.policy_activity || null;
            termChangedFields.push('policy_activity');
        }
        if (termForm.carrier_status !== (policyDetail.carrier_status || '')) {
            termChanges.carrier_status = termForm.carrier_status || null;
            termChangedFields.push('carrier_status');
        }
        if (termForm.payment_status !== (policyDetail.payment_status || '')) {
            termChanges.payment_status = termForm.payment_status || null;
            termChangedFields.push('payment_status');
        }
        if (termForm.payment_plan !== (policyDetail.payment_plan || '')) {
            termChanges.payment_plan = termForm.payment_plan || null;
            termChangedFields.push('payment_plan');
        }
        if (termForm.cancellation_reason !== (policyDetail.cancellation_reason || '')) {
            termChanges.cancellation_reason = termForm.cancellation_reason || null;
            termChangedFields.push('cancellation_reason');
        }
        if (termForm.dic_exists !== (policyDetail.dic_exists ?? false)) {
            termChanges.dic_exists = termForm.dic_exists;
            termChangedFields.push('dic_exists');
        }
        if (termForm.dic_policy_number !== (policyDetail.dic_policy_number || '')) {
            termChanges.dic_policy_number = termForm.dic_policy_number || null;
            termChangedFields.push('dic_policy_number');
        }
        if (termForm.sold_by !== (policyDetail.sold_by || '')) {
            termChanges.sold_by = termForm.sold_by || null;
            termChangedFields.push('sold_by');
        }
        if (termForm.office !== (policyDetail.office || '')) {
            termChanges.office = termForm.office || null;
            termChangedFields.push('office');
        }
        if (termForm.is_current !== (policyDetail.is_current ?? true)) {
            termChanges.is_current = termForm.is_current;
            termChangedFields.push('is_current');
        }

        // Check if anything changed at all
        if (policyChangedFields.length === 0 && termChangedFields.length === 0) {
            onClose();
            return;
        }

        // --- Save policy header ---
        if (policyChangedFields.length > 0) {
            const result = await updatePolicy(policyDetail.id, policyChanges);
            if (!result.success) {
                setMessage({ type: 'error', text: `Policy save failed: ${result.error}` });
                setSaving(false);
                return;
            }
            await insertActivityEvent({
                event_type: 'policy.updated',
                title: 'Policy updated',
                detail: `Updated: ${policyChangedFields.join(', ')}`,
                policy_id: policyDetail.id,
                client_id: policyDetail.client_id,
                meta: { changed_fields: policyChangedFields },
            });
        }

        // --- Save current term ---
        if (termChangedFields.length > 0 && policyDetail.policy_term_id) {
            const result = await updatePolicyTerm(policyDetail.policy_term_id, termChanges);
            if (!result.success) {
                setMessage({ type: 'error', text: `Term save failed: ${result.error}` });
                setSaving(false);
                return;
            }
            await insertActivityEvent({
                event_type: 'policy_term.updated',
                title: 'Policy term updated',
                detail: `Updated: ${termChangedFields.join(', ')}`,
                policy_id: policyDetail.id,
                client_id: policyDetail.client_id,
                meta: { changed_fields: termChangedFields },
            });
        }

        setSaving(false);
        setMessage({ type: 'success', text: 'Saved successfully' });
        setTimeout(() => {
            onSaved();
        }, 600);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.panelHeader}>
                    <h2 className={styles.panelTitle}>Edit Policy</h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                {/* Toast */}
                {message && (
                    <div className={message.type === 'success' ? styles.toastSuccess : styles.toastError}>
                        {message.type === 'success' && <CheckCircle size={16} />}
                        {message.text}
                    </div>
                )}

                {/* POLICY HEADER SECTION */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        Policy Header
                        <span className={styles.sectionDivider} />
                    </div>

                    <div className={styles.fieldGroup}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Policy Number</label>
                            <input
                                className={styles.fieldInput}
                                value={policyForm.policy_number}
                                onChange={(e) => setPolicyForm(f => ({ ...f, policy_number: e.target.value }))}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Carrier Name</label>
                            <input
                                className={styles.fieldInput}
                                value={policyForm.carrier_name}
                                onChange={(e) => setPolicyForm(f => ({ ...f, carrier_name: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className={styles.fieldGroupFull}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Status</label>
                            <select
                                className={styles.fieldSelect}
                                value={policyForm.status}
                                onChange={(e) => setPolicyForm(f => ({ ...f, status: e.target.value }))}
                            >
                                <option value="active">Active</option>
                                <option value="pending_review">Pending Review</option>
                                <option value="unknown">Unknown</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="expired">Expired</option>
                                <option value="non_renewed">Non-Renewed</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* CURRENT TERM SECTION */}
                {policyDetail.policy_term_id ? (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            Current Term
                            <span className={styles.sectionDivider} />
                        </div>

                        <div className={styles.fieldGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Effective Date</label>
                                <input
                                    type="date"
                                    className={styles.fieldInput}
                                    value={termForm.effective_date}
                                    onChange={(e) => setTermForm(f => ({ ...f, effective_date: e.target.value }))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Expiration Date</label>
                                <input
                                    type="date"
                                    className={styles.fieldInput}
                                    value={termForm.expiration_date}
                                    onChange={(e) => setTermForm(f => ({ ...f, expiration_date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Annual Premium</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.annual_premium}
                                    onChange={(e) => setTermForm(f => ({ ...f, annual_premium: e.target.value }))}
                                    placeholder="e.g. 1234.56 or $1,234.56"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Policy Activity</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.policy_activity}
                                    onChange={(e) => setTermForm(f => ({ ...f, policy_activity: e.target.value }))}
                                    placeholder="e.g. New Business, Renewal"
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Carrier Status</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.carrier_status}
                                    onChange={(e) => setTermForm(f => ({ ...f, carrier_status: e.target.value }))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Payment Status</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.payment_status}
                                    onChange={(e) => setTermForm(f => ({ ...f, payment_status: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Payment Plan</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.payment_plan}
                                    onChange={(e) => setTermForm(f => ({ ...f, payment_plan: e.target.value }))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Cancellation Reason</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.cancellation_reason}
                                    onChange={(e) => setTermForm(f => ({ ...f, cancellation_reason: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Sold By</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.sold_by}
                                    onChange={(e) => setTermForm(f => ({ ...f, sold_by: e.target.value }))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Office</label>
                                <input
                                    className={styles.fieldInput}
                                    value={termForm.office}
                                    onChange={(e) => setTermForm(f => ({ ...f, office: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={styles.toggle}>
                            <button
                                type="button"
                                className={styles.toggleSwitch}
                                data-active={termForm.dic_exists}
                                onClick={() => setTermForm(f => ({ ...f, dic_exists: !f.dic_exists }))}
                            >
                                <span className={styles.toggleKnob} />
                            </button>
                            <span className={styles.fieldLabel} style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem' }}>
                                DIC Coverage Exists
                            </span>
                        </div>

                        {termForm.dic_exists && (
                            <div className={styles.fieldGroupFull} style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>DIC Policy Number</label>
                                    <input
                                        className={styles.fieldInput}
                                        value={termForm.dic_policy_number}
                                        onChange={(e) => setTermForm(f => ({ ...f, dic_policy_number: e.target.value }))}
                                        placeholder="Enter associated DIC policy number"
                                    />
                                </div>
                            </div>
                        )}

                        <div className={styles.toggle}>
                            <button
                                type="button"
                                className={styles.toggleSwitch}
                                data-active={termForm.is_current}
                                onClick={() => setTermForm(f => ({ ...f, is_current: !f.is_current }))}
                            >
                                <span className={styles.toggleKnob} />
                            </button>
                            <span className={styles.fieldLabel} style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem' }}>
                                Is Current Term
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            Current Term
                            <span className={styles.sectionDivider} />
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            No current term found for this policy. Term data will be available once a declaration or CSV import is processed.
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className={styles.footer}>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}
