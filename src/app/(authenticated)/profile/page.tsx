'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getUserProfile, UserProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { UserCircle, Mail, Phone, Shield, Building2, Calendar, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // Edit form state
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editPhone, setEditPhone] = useState('');

    const loadProfile = useCallback(async () => {
        setLoading(true);
        const p = await getUserProfile();
        setProfile(p);
        if (p) {
            setEditFirstName(p.first_name);
            setEditLastName(p.last_name);
            setEditPhone(p.phone);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        setSaveMessage('');

        const { error } = await supabase
            .from('accounts')
            .update({
                first_name: editFirstName.trim(),
                last_name: editLastName.trim(),
                phone: editPhone.trim(),
            })
            .eq('id', profile.id);

        if (error) {
            setSaveMessage('Failed to save. Please try again.');
        } else {
            setSaveMessage('Profile updated!');
            setEditing(false);
            loadProfile();
        }
        setSaving(false);
        setTimeout(() => setSaveMessage(''), 3000);
    };

    const handleCancel = () => {
        if (profile) {
            setEditFirstName(profile.first_name);
            setEditLastName(profile.last_name);
            setEditPhone(profile.phone);
        }
        setEditing(false);
    };

    const roleBadge = (role: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            admin: { bg: 'rgba(239, 68, 68, 0.12)', text: '#f87171' },
            service: { bg: 'rgba(99, 102, 241, 0.12)', text: '#818cf8' },
            user: { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399' },
            customer: { bg: 'rgba(59, 130, 246, 0.12)', text: '#60a5fa' },
        };
        const c = colors[role] || colors.user;
        return (
            <span style={{
                display: 'inline-block',
                padding: '0.2rem 0.625rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: c.text,
                background: c.bg,
                borderRadius: '999px',
                textTransform: 'capitalize',
            }}>
                {role}
            </span>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
                <UserCircle size={48} style={{ color: '#475569' }} />
                <p style={{ color: 'var(--text-mid)', fontSize: '0.875rem' }}>Unable to load your profile. Please log in again.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '0 1.5rem' }}>
            {/* Page header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem' }}>My Profile</h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your staff account information</p>
            </div>

            {/* Profile card */}
            <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
            }}>
                {/* Avatar header */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.08))',
                    padding: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    borderBottom: '1px solid var(--border-default)',
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: '#818cf8',
                        flexShrink: 0,
                    }}>
                        {(profile.first_name?.[0] || profile.email?.[0] || '?').toUpperCase()}
                        {(profile.last_name?.[0] || '').toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-high)' }}>
                            {profile.first_name} {profile.last_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {roleBadge(profile.role)}
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        {!editing ? (
                            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                                <Pencil size={13} style={{ marginRight: '0.375rem' }} /> Edit
                            </Button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', marginRight: '0.375rem' }} /> : <Check size={13} style={{ marginRight: '0.375rem' }} />}
                                    Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancel}>
                                    <X size={13} style={{ marginRight: '0.25rem' }} /> Cancel
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save message */}
                {saveMessage && (
                    <div style={{
                        padding: '0.5rem 1.5rem',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        color: saveMessage.includes('Failed') ? '#f87171' : '#34d399',
                        background: saveMessage.includes('Failed') ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                    }}>
                        {saveMessage}
                    </div>
                )}

                {/* Info rows */}
                <div style={{ padding: '0.5rem 0' }}>
                    <InfoRow icon={UserCircle} label="First Name" value={editing ? undefined : profile.first_name || '—'}>
                        {editing && (
                            <input
                                type="text"
                                value={editFirstName}
                                onChange={(e) => setEditFirstName(e.target.value)}
                                style={inputStyle}
                                placeholder="First name"
                            />
                        )}
                    </InfoRow>
                    <InfoRow icon={UserCircle} label="Last Name" value={editing ? undefined : profile.last_name || '—'}>
                        {editing && (
                            <input
                                type="text"
                                value={editLastName}
                                onChange={(e) => setEditLastName(e.target.value)}
                                style={inputStyle}
                                placeholder="Last name"
                            />
                        )}
                    </InfoRow>
                    <InfoRow icon={Mail} label="Email" value={profile.email || '—'} />
                    <InfoRow icon={Phone} label="Phone" value={editing ? undefined : profile.phone || '—'}>
                        {editing && (
                            <input
                                type="text"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                style={inputStyle}
                                placeholder="Phone number"
                            />
                        )}
                    </InfoRow>
                    <InfoRow icon={Shield} label="Role" value={roleBadge(profile.role)} />
                    <InfoRow icon={Calendar} label="Account Created" value={
                        profile.created_at
                            ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                            : '—'
                    } />
                </div>
            </div>

            {/* Security note */}
            <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.12)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.75rem',
                color: 'var(--text-mid)',
            }}>
                <strong>Security:</strong> To change your email or password, contact your administrator. Role and email changes require admin approval.
            </div>
        </div>
    );
}

// ── Small component for info rows ──
function InfoRow({
    icon: Icon,
    label,
    value,
    children,
}: {
    icon: React.ElementType;
    label: string;
    value?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}>
            <Icon size={15} style={{ color: '#64748b', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', width: '100px', flexShrink: 0, fontWeight: 500 }}>{label}</span>
            {children || (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-high)', fontWeight: 500 }}>
                    {value}
                </span>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    padding: '0.4rem 0.6rem',
    fontSize: '0.85rem',
    color: 'var(--text-high)',
    width: '100%',
    maxWidth: '280px',
    outline: 'none',
};
