"use client";

import React, { useState } from "react";
import { Copy, AlertCircle, CheckCircle2, X, Merge, RefreshCw, Users, ShieldAlert } from "lucide-react";
import ClientMergeModal from "./ClientMergeModal";
import styles from "./DuplicateReview.module.css";

export default function DuplicateReview() {
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
    const [isMerging, setIsMerging] = useState(false);
    const [loading, setLoading] = useState(true);
    // Modal State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [activeMergeGroup, setActiveMergeGroup] = useState<any | null>(null);

    // Live State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [duplicateClients, setDuplicateClients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [duplicatePolicies, setDuplicatePolicies] = useState<any[]>([]);

    React.useEffect(() => {
        fetchDuplicates();
    }, []);

    const fetchDuplicates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/duplicates/find');
            const data = await res.json();
            if (data.success) {
                setDuplicateClients(data.clients || []);
                setDuplicatePolicies(data.policies || []);
            }
        } catch (err) {
            console.error("Failed to load duplicates:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMergeClient = async (survivorId: string, mergedIds: string[], consolidatedFields: Record<string, any> = {}, keepDocs: boolean = true) => {
        setIsMerging(true);
        try {
            for (const mergedId of mergedIds) {
                const res = await fetch('/api/merge/clients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        survivor_id: survivorId,
                        merged_id: mergedId,
                        consolidated_fields: consolidatedFields,
                        keep_documents: keepDocs
                    })
                });
                if (!res.ok) throw new Error("Merge failed");
            }

            setDuplicateClients(prev => prev.filter(c => c.survivor_id !== survivorId));
            setSelectedClient(null);
        } catch (err) {
            console.error(err);
            alert("Failed to merge client. Please see console.");
        } finally {
            setIsMerging(false);
        }
    };

    const handleMergePolicy = async (groupId: string, survivorId: string, mergedIds: string[]) => {
        setIsMerging(true);
        try {
            for (const mergedId of mergedIds) {
                const res = await fetch('/api/merge/policies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ survivor_id: survivorId, merged_id: mergedId })
                });
                if (!res.ok) throw new Error("Merge failed");
            }

            setDuplicatePolicies(prev => prev.filter(p => p.survivor_id !== survivorId));
            setSelectedPolicy(null);
        } catch (err) {
            console.error(err);
            alert("Failed to merge policy. Please check console.");
        } finally {
            setIsMerging(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
                <RefreshCw className={styles.spinAnimation} size={18} />
                <span>Running duplicate algorithms...</span>
            </div>
        );
    }

    return (
        <div className={styles.workspace}>
            {/* Clients Column */}
            <div className={styles.column}>
                <div className={styles.header}>
                    <h3 className={styles.headerTitle}>
                        <Users size={18} style={{ color: "var(--status-success)" }} />
                        Identified Client Duplicates
                    </h3>
                    {duplicateClients.length > 0 && (
                        <span className={styles.badge}>{duplicateClients.length} Actionable</span>
                    )}
                </div>

                {duplicateClients.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle2 size={32} className="icon" />
                        <h4 style={{ color: "var(--text-high)", fontWeight: 600, marginBottom: "0.25rem" }}>All Clear</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No duplicate clients found matching the identity footprint limit.</p>
                    </div>
                ) : (
                    duplicateClients.map((group, groupIdx) => (
                        <div
                            key={group.survivor_id}
                            className={`${styles.card} ${selectedClient === group.survivor_id ? styles.cardActiveClient : ''}`}
                            onClick={() => setSelectedClient(group.survivor_id === selectedClient ? null : group.survivor_id)}
                        >
                            <div className={styles.metaBar}>
                                <div className={styles.confidenceScore}>
                                    <AlertCircle size={14} style={{ color: "var(--status-warning)" }} />
                                    <span>Match Confidence: </span>
                                    <span className={styles.confidenceHigh}>{group.confidence}%</span>
                                </div>
                                <button
                                    className={styles.dismissButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDuplicateClients(prev => prev.filter(g => g.survivor_id !== group.survivor_id));
                                    }}
                                >
                                    Dismiss
                                </button>
                            </div>

                            <div className={styles.entityList}>
                                {/* Survivor */}
                                <div className={styles.entityItem}>
                                    <div className={`${styles.iconMarker} ${styles.iconSurvivorClient}`}>S</div>
                                    <div className={styles.entityDetails}>
                                        <div className={styles.entityTitle}>{group.details.survivor.named_insured}</div>
                                        <div className={styles.entitySubtext}>
                                            <span style={{ color: "var(--status-success)", fontWeight: 600 }}>Survivor Record</span>
                                            <span>Age: {new Date(group.details.survivor.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Duplicates */}
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {group.details.duplicates.map((rec: any, i: number) => (
                                    <div key={rec.id} className={styles.entityItem}>
                                        <div className={`${styles.iconMarker} ${styles.iconTarget}`}>{i + 1}</div>
                                        <div className={styles.entityDetails}>
                                            <div className={`${styles.entityTitle} ${styles.targetText}`}>{rec.named_insured}</div>
                                            <div className={styles.entitySubtext}>
                                                <span>Merge Candidate</span>
                                                <span>Age: {new Date(rec.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedClient === group.survivor_id && (
                                <div className={styles.actionFooter}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMergeGroup({
                                                survivor_id: group.survivor_id,
                                                merged_ids: group.merged_ids,
                                                survivor: group.details.survivor,
                                                candidates: group.details.duplicates
                                            });
                                        }}
                                        disabled={isMerging}
                                        className={styles.actionButton}
                                    >
                                        <Merge size={16} />
                                        Launch Interactive Consolidation
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Policies Column */}
            <div className={styles.column}>
                <div className={styles.header}>
                    <h3 className={styles.headerTitle}>
                        <ShieldAlert size={18} style={{ color: "var(--status-info)" }} />
                        Suspected Policy Mergers
                    </h3>
                    {duplicatePolicies.length > 0 && (
                        <span className={styles.badge}>{duplicatePolicies.length} Actionable</span>
                    )}
                </div>

                {duplicatePolicies.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle2 size={32} className="icon" />
                        <h4 style={{ color: "var(--text-high)", fontWeight: 600, marginBottom: "0.25rem" }}>All Clear</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>All policy variants are correctly tracked to their base numbers.</p>
                    </div>
                ) : (
                    duplicatePolicies.map((group, groupIdx) => (
                        <div
                            key={group.survivor_id}
                            className={`${styles.card} ${selectedPolicy === group.survivor_id ? styles.cardActivePolicy : ''}`}
                            onClick={() => setSelectedPolicy(group.survivor_id === selectedPolicy ? null : group.survivor_id)}
                        >
                            <div className={styles.metaBar}>
                                <div className={styles.confidenceScore}>
                                    <Copy size={13} style={{ color: "var(--status-info)", marginTop: "1px" }} />
                                    <span>{group.reason.replace('Shares identical Base Policy Number: ', 'Base Alignment: ')}</span>
                                </div>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>{group.confidence}% Match</span>
                            </div>

                            <div className={styles.entityList}>
                                {/* Survivor */}
                                <div className={styles.entityItem}>
                                    <div className={`${styles.iconMarker} ${styles.iconSurvivorPolicy}`}>S</div>
                                    <div className={styles.entityDetails}>
                                        <div className={styles.entityTitle}>{group.details.survivor.policy_number}</div>
                                        <div className={styles.entitySubtext}>
                                            <span style={{ color: "var(--status-info)", fontWeight: 600 }}>Root Policy</span>
                                            <span style={{ maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {group.details.survivor.property_address_norm}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Duplicates */}
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {group.details.duplicates.map((rec: any, i: number) => (
                                    <div key={rec.id} className={styles.entityItem}>
                                        <div className={`${styles.iconMarker} ${styles.iconTarget}`}>{i + 1}</div>
                                        <div className={styles.entityDetails}>
                                            <div className={`${styles.entityTitle} ${styles.targetText}`}>{rec.policy_number}</div>
                                            <div className={styles.entitySubtext}>
                                                <span>Sub-Term (Will link to Root)</span>
                                                <span style={{ maxWidth: '40%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {rec.property_address_norm || '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedPolicy === group.survivor_id && (
                                <div className={styles.actionFooter}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMergePolicy(`policy-${groupIdx}`, group.survivor_id, group.merged_ids); }}
                                        disabled={isMerging}
                                        className={`${styles.actionButton} ${styles.actionButtonBlue}`}
                                    >
                                        {isMerging ? <RefreshCw className={styles.spinAnimation} size={16} /> : <Merge size={16} />}
                                        Bind to Root Policy
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Launch Interactive Overlay */}
            {activeMergeGroup && (
                <ClientMergeModal
                    survivor={activeMergeGroup.survivor}
                    candidates={activeMergeGroup.candidates}
                    onClose={() => setActiveMergeGroup(null)}
                    onConfirm={handleMergeClient}
                />
            )}
        </div>
    );
}
