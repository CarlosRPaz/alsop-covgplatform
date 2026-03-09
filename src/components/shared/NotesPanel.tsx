'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageSquarePlus, Pin, PinOff, Archive, ArchiveRestore,
    Pencil, Send, X, FileText, AlertCircle
} from 'lucide-react';
import {
    NoteRow, fetchNotes, fetchClientOnlyNotes, createNote, updateNote,
    getCurrentUserId, getCurrentUserRole
} from '@/lib/notes';
import styles from './NotesPanel.module.css';

interface NotesPanelProps {
    clientId: string;
    policyId?: string;
    /** If true, shows policy-specific notes + general client notes in separate sections */
    showPolicySections?: boolean;
}

export function NotesPanel({ clientId, policyId, showPolicySections }: NotesPanelProps) {
    const [notes, setNotes] = useState<NoteRow[]>([]);
    const [clientNotes, setClientNotes] = useState<NoteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [newBody, setNewBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentRole, setCurrentRole] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const showToast = useCallback((type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadNotes = useCallback(async () => {
        setLoading(true);
        try {
            if (policyId && showPolicySections) {
                // Policy page: fetch policy-specific notes AND general client notes
                const [policyNotes, generalNotes] = await Promise.all([
                    fetchNotes({ policyId, includeArchived: showArchived }),
                    fetchClientOnlyNotes(clientId, showArchived),
                ]);
                setNotes(policyNotes);
                setClientNotes(generalNotes);
            } else if (policyId) {
                // Policy page without sections: just policy notes
                const data = await fetchNotes({ policyId, includeArchived: showArchived });
                setNotes(data);
            } else {
                // Client page: all client notes
                const data = await fetchNotes({ clientId, includeArchived: showArchived });
                setNotes(data);
            }
        } catch {
            showToast('error', 'Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, [clientId, policyId, showPolicySections, showArchived, showToast]);

    useEffect(() => {
        loadNotes();
        getCurrentUserId().then(setCurrentUserId);
        getCurrentUserRole().then(setCurrentRole);
    }, [loadNotes]);

    const canEdit = (note: NoteRow) =>
        currentRole === 'admin' || note.author_user_id === currentUserId;

    const handleCreate = async () => {
        if (!newBody.trim()) return;
        setSaving(true);
        try {
            await createNote({
                client_id: clientId,
                policy_id: policyId || null,
                body: newBody.trim(),
            });
            setNewBody('');
            showToast('success', 'Note added');
            await loadNotes();
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (noteId: string, updates: { body?: string; is_pinned?: boolean; is_archived?: boolean }) => {
        try {
            await updateNote(noteId, updates);
            if (updates.body !== undefined) {
                setEditingId(null);
                showToast('success', 'Note updated');
            } else if (updates.is_pinned !== undefined) {
                showToast('success', updates.is_pinned ? 'Pinned' : 'Unpinned');
            } else if (updates.is_archived !== undefined) {
                showToast('success', updates.is_archived ? 'Archived' : 'Restored');
            }
            await loadNotes();
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Not allowed');
        }
    };

    const formatTime = (ts: string) => {
        try {
            return new Date(ts).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });
        } catch {
            return ts;
        }
    };

    const renderNote = (note: NoteRow) => (
        <div
            key={note.id}
            className={`${styles.note} ${note.is_pinned ? styles.pinned : ''} ${note.is_archived ? styles.archived : ''}`}
        >
            <div className={styles.noteHeader}>
                <div className={styles.noteMeta}>
                    {note.is_pinned && <Pin size={12} className={styles.pinIcon} />}
                    <span className={styles.noteTime}>{formatTime(note.updated_at)}</span>
                    {note.policy_id && !policyId && (
                        <span className={styles.policyBadge}>
                            <FileText size={10} /> Policy
                        </span>
                    )}
                    {note.is_archived && <span className={styles.archivedBadge}>Archived</span>}
                </div>
                {canEdit(note) && (
                    <div className={styles.noteActions}>
                        <button
                            title={note.is_pinned ? 'Unpin' : 'Pin'}
                            onClick={() => handleUpdate(note.id, { is_pinned: !note.is_pinned })}
                            className={styles.noteAction}
                        >
                            {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                        <button
                            title="Edit"
                            onClick={() => { setEditingId(note.id); setEditBody(note.body); }}
                            className={styles.noteAction}
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            title={note.is_archived ? 'Restore' : 'Archive'}
                            onClick={() => handleUpdate(note.id, { is_archived: !note.is_archived })}
                            className={styles.noteAction}
                        >
                            {note.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                    </div>
                )}
            </div>

            {editingId === note.id ? (
                <div className={styles.editArea}>
                    <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className={styles.textarea}
                        rows={3}
                    />
                    <div className={styles.editActions}>
                        <button
                            onClick={() => handleUpdate(note.id, { body: editBody.trim() })}
                            disabled={!editBody.trim()}
                            className={styles.saveBtn}
                        >
                            Save
                        </button>
                        <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>
                            <X size={14} /> Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <p className={styles.noteBody}>{note.body}</p>
            )}
        </div>
    );

    return (
        <div className={styles.container}>
            {/* Toast */}
            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`}>
                    {toast.type === 'error' && <AlertCircle size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* New note form */}
            <div className={styles.newNote}>
                <textarea
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    placeholder="Write a note…"
                    className={styles.textarea}
                    rows={2}
                />
                <button
                    onClick={handleCreate}
                    disabled={saving || !newBody.trim()}
                    className={styles.addBtn}
                >
                    {saving ? 'Saving…' : (
                        <>
                            <MessageSquarePlus size={14} />
                            Add Note
                        </>
                    )}
                </button>
            </div>

            {/* Archived toggle */}
            <label className={styles.toggle}>
                <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
            </label>

            {loading ? (
                <p className={styles.loading}>Loading notes…</p>
            ) : (
                <>
                    {/* Policy page: two sections */}
                    {showPolicySections && policyId ? (
                        <>
                            <h4 className={styles.sectionLabel}>Policy Notes</h4>
                            {notes.length > 0 ? notes.map(renderNote) : (
                                <p className={styles.empty}>No policy notes yet.</p>
                            )}
                            <h4 className={styles.sectionLabel} style={{ marginTop: '1.5rem' }}>
                                Client Notes <span className={styles.sectionSub}>(general, not policy-specific)</span>
                            </h4>
                            {clientNotes.length > 0 ? clientNotes.map(renderNote) : (
                                <p className={styles.empty}>No general client notes.</p>
                            )}
                        </>
                    ) : (
                        /* Client page or simple mode */
                        notes.length > 0 ? notes.map(renderNote) : (
                            <p className={styles.empty}>No notes yet.</p>
                        )
                    )}
                </>
            )}
        </div>
    );
}
