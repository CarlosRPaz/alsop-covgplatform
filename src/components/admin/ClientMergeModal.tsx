"use client";

import React, { useState, useMemo } from "react";
import { X, Check, FileStack, ShieldAlert, Merge, RefreshCw, ChevronRight, ChevronLeft, Shield } from "lucide-react";
import styles from "./ClientMergeModal.module.css";

interface PolicyBrief {
    id: string;
    policy_number: string;
    carrier_name?: string;
    property_address_raw?: string;
    status?: string;
    created_at?: string;
}

interface ClientData {
    id: string;
    named_insured: string;
    email?: string;
    phone?: string;
    mailing_address_raw?: string;
    mailing_address_norm?: string;
    policies?: PolicyBrief[];
    dec_pages?: any[];
}

interface ClientMergeModalProps {
    survivor: ClientData;
    candidates: ClientData[];
    onClose: () => void;
    onConfirm: (survivorId: string, mergedIds: string[], consolidatePayload: Record<string, any>, keepDocs: boolean) => Promise<void>;
}

type FieldKey = 'named_insured' | 'email' | 'phone' | 'address';

export default function ClientMergeModal({ survivor, candidates, onClose, onConfirm }: ClientMergeModalProps) {
    // All records: survivor first, then N candidates
    const allRecords = useMemo(() => [survivor, ...candidates], [survivor, candidates]);
    
    // Field selections: which record index to use for each field (0 = survivor)
    const [selections, setSelections] = useState<Record<FieldKey, number>>(() => {
        const defaults: Record<FieldKey, number> = {
            named_insured: 0,
            email: 0,
            phone: 0,
            address: 0,
        };
        // Auto-select first record that has data
        for (const key of ['email', 'phone'] as FieldKey[]) {
            if (!survivor[key]) {
                const idx = allRecords.findIndex((r) => (r as any)[key]);
                if (idx >= 0) defaults[key] = idx;
            }
        }
        if (!survivor.mailing_address_raw) {
            const idx = allRecords.findIndex((r) => r.mailing_address_raw);
            if (idx >= 0) defaults.address = idx;
        }
        return defaults;
    });

    const [keepDocs, setKeepDocs] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Horizontal scroll for 3+ candidate columns
    const [scrollOffset, setScrollOffset] = useState(0);
    const maxVisibleCandidates = 2; // show up to 2 candidates at a time beside survivor
    const canScrollLeft = scrollOffset > 0;
    const canScrollRight = scrollOffset + maxVisibleCandidates < candidates.length;
    const visibleCandidates = candidates.slice(scrollOffset, scrollOffset + maxVisibleCandidates);

    // Collect ALL policies across every record for the policy panel
    const allPolicies = useMemo(() => {
        const map: { policy: PolicyBrief; ownerId: string; ownerName: string }[] = [];
        for (const rec of allRecords) {
            if (rec.policies) {
                for (const p of rec.policies) {
                    map.push({ policy: p, ownerId: rec.id, ownerName: rec.named_insured });
                }
            }
        }
        return map;
    }, [allRecords]);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const payload: Record<string, any> = {};
            const selSource = (key: FieldKey) => allRecords[selections[key]];

            payload.named_insured = selSource('named_insured').named_insured;
            payload.email = selSource('email').email;
            payload.phone = selSource('phone').phone;

            const addrSource = selSource('address');
            payload.mailing_address_raw = addrSource.mailing_address_raw;
            payload.mailing_address_norm = addrSource.mailing_address_norm;

            await onConfirm(survivor.id, candidates.map((c) => c.id), payload, keepDocs);
            onClose();
        } catch (error) {
            console.error("Failed to execute guided merge", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dynamic column count: label + survivor + visible candidates
    const colCount = 1 + 1 + visibleCandidates.length;
    const gridCols = `140px ${'1fr '.repeat(colCount - 1).trim()}`;

    const renderFieldRow = (label: string, fieldKey: FieldKey, valueExtractor: (r: ClientData) => string | undefined) => {
        // All visible records in order: [survivor, ...visibleCandidates]
        const visibleRecords = [survivor, ...visibleCandidates];

        return (
            <div className={styles.fieldRow} style={{ gridTemplateColumns: gridCols }}>
                <div className={styles.fieldLabel}>{label}</div>
                {visibleRecords.map((rec, localIdx) => {
                    const val = valueExtractor(rec);
                    // Map local index to global allRecords index
                    const globalIdx = localIdx === 0 ? 0 : (scrollOffset + localIdx);
                    const isSelected = selections[fieldKey] === globalIdx;

                    return (
                        <div
                            key={rec.id}
                            className={`${styles.valueCard} ${!val ? styles.valueCardEmpty : ''} ${isSelected ? styles.valueCardSelected : ''}`}
                            onClick={() => val && setSelections((s) => ({ ...s, [fieldKey]: globalIdx }))}
                        >
                            {val ? (
                                <>
                                    <div className={styles.valText}>{val}</div>
                                    <div className={styles.radioCircle}><Check size={12} /></div>
                                </>
                            ) : (
                                <div className={styles.emptyText}>No data mapping</div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>

                <div className={styles.header}>
                    <div className={styles.title}>
                        <Merge style={{ color: "var(--accent-primary)" }} />
                        Guided Identity Consolidation
                        {candidates.length > 1 && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-surface-raised)', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
                                {candidates.length} candidates detected
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className={styles.closeButton} disabled={isSubmitting}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>

                    {/* Column Headers with scroll nav */}
                    <div>
                        <div className={styles.gridHeader} style={{ gridTemplateColumns: gridCols }}>
                            <div className={styles.headerCell}>Data Point</div>
                            <div className={`${styles.headerCell} ${styles.survivorHeader}`}>
                                <ShieldAlert size={14} /> Survivor
                            </div>
                            {visibleCandidates.map((c, i) => (
                                <div key={c.id} className={`${styles.headerCell} ${styles.candidateHeader}`}>
                                    Candidate {scrollOffset + i + 1}
                                    {candidates.length > maxVisibleCandidates && (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                            ({scrollOffset + i + 1}/{candidates.length})
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Scroll controls for 3+ candidates */}
                        {candidates.length > maxVisibleCandidates && (
                            <div className={styles.scrollControls}>
                                <button
                                    disabled={!canScrollLeft}
                                    onClick={() => setScrollOffset((o) => Math.max(0, o - 1))}
                                    className={styles.scrollBtn}
                                >
                                    <ChevronLeft size={14} /> Previous
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Showing {scrollOffset + 1}–{Math.min(scrollOffset + maxVisibleCandidates, candidates.length)} of {candidates.length}
                                </span>
                                <button
                                    disabled={!canScrollRight}
                                    onClick={() => setScrollOffset((o) => Math.min(candidates.length - maxVisibleCandidates, o + 1))}
                                    className={styles.scrollBtn}
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        )}

                        {/* Contact Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {renderFieldRow('Named Insured', 'named_insured', (r) => r.named_insured)}
                            {renderFieldRow('Email Address', 'email', (r) => r.email)}
                            {renderFieldRow('Phone Number', 'phone', (r) => r.phone)}
                            {renderFieldRow('Mailing Address', 'address', (r) => r.mailing_address_raw)}
                        </div>
                    </div>

                    {/* ── Policy Inventory Panel ── */}
                    {allPolicies.length > 0 && (
                        <div className={styles.policySection}>
                            <div className={styles.policySectionHeader}>
                                <Shield size={16} style={{ color: 'var(--status-info)' }} />
                                <span>Associated Policy Inventory</span>
                                <span className={styles.policyCount}>{allPolicies.length} total</span>
                            </div>

                            <div className={styles.policyList}>
                                {allPolicies.map(({ policy, ownerName }, i) => {
                                    const isSurvivorPolicy = allRecords[0].policies?.some((p) => p.id === policy.id);
                                    return (
                                        <div key={policy.id} className={styles.policyCard}>
                                            <div className={styles.policyCardTop}>
                                                <div className={styles.policyNumber}>{policy.policy_number}</div>
                                                <div className={`${styles.policyBadge} ${isSurvivorPolicy ? styles.policyBadgeSurvivor : styles.policyBadgeCandidate}`}>
                                                    {isSurvivorPolicy ? 'Survivor' : 'Candidate'}
                                                </div>
                                            </div>
                                            <div className={styles.policyMeta}>
                                                {policy.carrier_name && <span>{policy.carrier_name}</span>}
                                                {policy.property_address_raw && <span className={styles.policyAddr}>{policy.property_address_raw}</span>}
                                            </div>
                                            <div className={styles.policyOwner}>
                                                Linked to: {ownerName}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={styles.policyNote}>
                                When "Migrate External Attachments" is enabled, all candidate policies will be re-parented to the Survivor client record. Duplicate policy numbers across clients will be handled by the Term Downcasting engine.
                            </div>
                        </div>
                    )}

                    {/* ── Options ── */}
                    <div className={styles.optionsSection}>
                        <div className={styles.optionRow} onClick={() => setKeepDocs(!keepDocs)}>
                            <div className={`${styles.checkbox} ${keepDocs ? styles.checkboxChecked : ''}`}>
                                {keepDocs && <Check size={14} strokeWidth={3} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: "var(--text-high)", fontWeight: 600, fontSize: "0.95rem", marginBottom: "2px" }}>
                                    Migrate External Attachments
                                </div>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                    All policies, terms, and DEC pages linked to every target candidate will be structurally re-parented to the Survivor Record.
                                </div>
                            </div>
                            <FileStack className={styles.optionLockIcon} size={24} />
                        </div>
                    </div>

                </div>

                <div className={styles.footer}>
                    <button className={styles.btnCancel} onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button className={styles.btnConfirm} onClick={handleConfirm} disabled={isSubmitting}>
                        {isSubmitting ? <RefreshCw size={16} className={styles.spinAnimation} /> : <Merge size={16} />}
                        Consolidate {candidates.length} Record{candidates.length > 1 ? 's' : ''}
                    </button>
                </div>

            </div>
        </div>
    );
}
