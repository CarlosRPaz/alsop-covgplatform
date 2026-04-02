'use client';

import React, { useState, useEffect } from 'react';
import { getUserProfile, UserProfile, isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from '@/components/layout/SidebarContext';
import {
    Settings as SettingsIcon, User, Bell, Palette, Shield, ChevronRight,
    Mail, Key, Monitor, Globe, Database, Lock, Loader2, Satellite, FileText
} from 'lucide-react';
import DataSourcesCatalog from '@/components/settings/DataSourcesCatalog';

type Section = 'account' | 'notifications' | 'display' | 'admin' | 'data_sources' | 'report_editor';

const SECTIONS = [
    { id: 'account' as Section, label: 'Account', icon: User, description: 'Name, email, password' },
    { id: 'notifications' as Section, label: 'Notifications', icon: Bell, description: 'Email & alert preferences' },
    { id: 'display' as Section, label: 'Display', icon: Palette, description: 'Theme & layout preferences' },
    { id: 'data_sources' as Section, label: 'Data Sources', icon: Satellite, description: 'Enrichment pipeline catalog', agentOnly: true },
    { id: 'report_editor' as Section, label: 'Report Editor', icon: FileText, description: 'Report template & section controls', adminOnly: true },
    { id: 'admin' as Section, label: 'Admin Settings', icon: Shield, description: 'Branding, integrations, global config', adminOnly: true },
];

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<Section>('account');
    const { isMobile } = useSidebar();

    useEffect(() => {
        getUserProfile().then(p => {
            setProfile(p);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    const showAdmin = profile && isAdmin(profile.role);

    return (
        <div style={{ maxWidth: activeSection === 'data_sources' || activeSection === 'report_editor' ? '1200px' : '900px', margin: isMobile ? '1rem auto' : '2rem auto', padding: isMobile ? '0 0.5rem' : '0 1.5rem', transition: 'max-width 0.3s ease' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SettingsIcon size={22} style={{ color: 'var(--accent-primary)' }} />
                    Settings
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage your preferences and account configuration</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: isMobile ? '0.75rem' : '1.25rem', minHeight: isMobile ? 'auto' : '500px' }}>
                {/* Left nav — horizontal scroll on mobile, vertical sidebar on desktop */}
                <nav style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.5rem',
                    height: 'fit-content',
                    ...(isMobile ? {
                        display: 'flex',
                        overflowX: 'auto',
                        gap: '0.25rem',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                    } : {}),
                }}>
                    {SECTIONS.map(s => {
                        if (s.adminOnly && !showAdmin) return null;
                        if ((s as any).agentOnly && !showAdmin && profile?.role === 'customer') return null;
                        const Icon = s.icon;
                        const isActive = activeSection === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    width: isMobile ? 'auto' : '100%',
                                    padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 0.75rem',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: isActive ? 'var(--accent-primary-muted)' : 'transparent',
                                    color: isActive ? 'var(--accent-primary)' : 'var(--text-mid)',
                                    fontSize: '0.8rem',
                                    fontWeight: isActive ? 600 : 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s',
                                    marginBottom: isMobile ? '0' : '0.125rem',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }}
                            >
                                <Icon size={15} />
                                <span style={{ flex: 1 }}>{s.label}</span>
                                {isActive && <ChevronRight size={13} style={{ color: 'var(--accent-primary)' }} />}
                            </button>
                        );
                    })}
                </nav>

                {/* Right content */}
                <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                }}>
                    {activeSection === 'account' && <AccountSection profile={profile} />}
                    {activeSection === 'notifications' && <NotificationsSection />}
                    {activeSection === 'display' && <DisplaySection />}
                    {activeSection === 'data_sources' && <DataSourcesCatalog />}
                    {activeSection === 'report_editor' && <ReportEditorSection />}
                    {activeSection === 'admin' && <AdminSection />}
                </div>
            </div>
        </div>
    );
}

// ─── Account Section (full inline editing) ─────────────────────
function AccountSection({ profile }: { profile: UserProfile | null }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const isAgent = profile?.role === 'admin' || profile?.role === 'service';
    const [editFirst, setEditFirst] = useState(profile?.first_name || '');
    const [editLast, setEditLast] = useState(profile?.last_name || '');
    const [editEmail, setEditEmail] = useState(profile?.email || '');
    const [editPhone, setEditPhone] = useState(profile?.phone || '');

    // Password state
    const [changingPw, setChangingPw] = useState(false);
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState('');

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        setSaveMsg('');

        const { error } = await supabase
            .from('accounts')
            .update({
                first_name: editFirst.trim(),
                last_name: editLast.trim(),
                phone: editPhone.trim(),
                email: editEmail.trim(),
            })
            .eq('id', profile.id);

        if (error) {
            setSaveMsg('Failed to save. Please try again.');
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 3000);
            return;
        }

        if (editEmail.trim() !== profile.email) {
            const { error: authErr } = await supabase.auth.updateUser({ email: editEmail.trim() });
            if (authErr) {
                setSaveMsg('Saved, but email change failed: ' + authErr.message);
            } else {
                setSaveMsg('Saved! Check your new email for a confirmation link.');
            }
        } else {
            setSaveMsg('Account updated!');
        }
        setEditing(false);
        setSaving(false);
        setTimeout(() => setSaveMsg(''), 5000);
    };

    const handleCancel = () => {
        setEditFirst(profile?.first_name || '');
        setEditLast(profile?.last_name || '');
        setEditEmail(profile?.email || '');
        setEditPhone(profile?.phone || '');
        setEditing(false);
    };

    const handlePasswordChange = async () => {
        if (newPw.length < 6) { setPwMsg('Password must be at least 6 characters.'); return; }
        if (newPw !== confirmPw) { setPwMsg('Passwords do not match.'); return; }
        setPwSaving(true); setPwMsg('');
        const { error } = await supabase.auth.updateUser({ password: newPw });
        if (error) { setPwMsg('Failed: ' + error.message); }
        else { setPwMsg('Password changed!'); setNewPw(''); setConfirmPw(''); setChangingPw(false); }
        setPwSaving(false);
        setTimeout(() => setPwMsg(''), 4000);
    };

    const inputStyle: React.CSSProperties = {
        background: 'var(--bg-surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: '6px',
        padding: '0.4rem 0.6rem',
        fontSize: '0.8rem',
        color: 'var(--text-high)',
        width: '100%',
        maxWidth: '240px',
        outline: 'none',
    };

    return (
        <div>
            <SectionHeader title="Account" description="Your personal and security settings" />

            {/* Save/error message */}
            {saveMsg && (
                <div style={{
                    padding: '0.5rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, borderRadius: '6px', marginBottom: '1rem',
                    color: saveMsg.includes('Failed') ? 'var(--status-error)' : 'var(--bg-success-subtle)',
                    background: saveMsg.includes('Failed') ? 'var(--bg-error-subtle)' : 'var(--bg-success-subtle)',
                }}>
                    {saveMsg}
                </div>
            )}

            <SettingGroup title="Personal Information" icon={User}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.375rem 0.875rem 0' }}>
                    {!editing ? (
                        <button onClick={() => setEditing(true)} style={{
                            fontSize: '0.72rem', color: 'var(--accent-primary)', background: 'none',
                            border: 'none', fontWeight: 500, cursor: 'pointer',
                        }}>
                            Edit
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={handleSave} disabled={saving} style={{
                                fontSize: '0.72rem', color: 'var(--status-success)', background: 'none',
                                border: 'none', fontWeight: 600, cursor: 'pointer',
                            }}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={handleCancel} style={{
                                fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none',
                                border: 'none', fontWeight: 500, cursor: 'pointer',
                            }}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                {editing ? (
                    <>
                        {isAgent ? (
                            <>
                                <EditableRow label="First Name" value={editFirst} onChange={setEditFirst} inputStyle={inputStyle} />
                                <EditableRow label="Last Name" value={editLast} onChange={setEditLast} inputStyle={inputStyle} />
                            </>
                        ) : (
                            <>
                                <SettingRow label="First Name" value={editFirst || '—'} note="Contact support to change" />
                                <SettingRow label="Last Name" value={editLast || '—'} note="Contact support to change" />
                            </>
                        )}
                        <EditableRow label="Email" value={editEmail} onChange={setEditEmail} inputStyle={inputStyle} type="email" />
                        <EditableRow label="Phone" value={editPhone} onChange={setEditPhone} inputStyle={inputStyle} type="tel" />
                    </>
                ) : (
                    <>
                        <SettingRow label="Display Name" value={profile ? `${profile.first_name} ${profile.last_name}` : '—'} />
                        <SettingRow label="Email" value={profile?.email || '—'} />
                        <SettingRow label="Phone" value={profile?.phone || 'Not set'} />
                    </>
                )}
            </SettingGroup>

            <SettingGroup title="Security" icon={Key}>
                {pwMsg && (
                    <div style={{
                        padding: '0.4rem 0.875rem', fontSize: '0.75rem', fontWeight: 500,
                        color: pwMsg.includes('Failed') || pwMsg.includes('must') || pwMsg.includes('match') ? 'var(--status-error)' : 'var(--status-success)',
                        background: pwMsg.includes('Failed') || pwMsg.includes('must') || pwMsg.includes('match') ? 'var(--bg-error-subtle)' : 'var(--bg-success-subtle)',
                    }}>
                        {pwMsg}
                    </div>
                )}
                {changingPw ? (
                    <div style={{ padding: '0.625rem 0.875rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            <EditableRow label="New Password" value={newPw} onChange={setNewPw} inputStyle={inputStyle} type="password" />
                            <EditableRow label="Confirm" value={confirmPw} onChange={setConfirmPw} inputStyle={inputStyle} type="password" />
                            <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '160px' }}>
                                <button onClick={handlePasswordChange} disabled={pwSaving} style={{
                                    fontSize: '0.72rem', color: 'var(--status-success)', background: 'none',
                                    border: 'none', fontWeight: 600, cursor: 'pointer',
                                }}>
                                    {pwSaving ? 'Saving...' : 'Save Password'}
                                </button>
                                <button onClick={() => { setChangingPw(false); setNewPw(''); setConfirmPw(''); setPwMsg(''); }} style={{
                                    fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none',
                                    border: 'none', fontWeight: 500, cursor: 'pointer',
                                }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <SettingRow label="Password" value="••••••••" actionLabel="Change" onAction={() => setChangingPw(true)} />
                )}
                <SettingRow label="Two-Factor Auth" value="Not enabled" actionLabel="Enable" placeholder />
                <SettingRow label="Active Sessions" value="1 active session" note="Current session" />
            </SettingGroup>

            {isAgent && (
                <SettingGroup title="Email Signature" icon={Mail}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0.875rem' }}>
                        Configure your email signature for outbound communications. <em>Coming soon.</em>
                    </div>
                </SettingGroup>
            )}

            <div style={{
                padding: '0.625rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)',
                background: 'var(--bg-info-subtle)', border: '1px solid var(--border-default)',
                borderRadius: '8px', marginTop: '0.5rem',
            }}>
                <strong>Security:</strong> Email changes require confirmation via a link sent to your new address.
            </div>
        </div>
    );
}

// ─── Notifications Section ───────────────────────────────────
function NotificationsSection() {
    return (
        <div>
            <SectionHeader title="Notifications" description="Control how and when you receive alerts" />

            <SettingGroup title="Email Notifications" icon={Mail}>
                <ToggleRow label="Flag Alerts" description="Get emailed when new high priority flags are created" defaultOn />
                <ToggleRow label="Renewal Reminders" description="Get reminded about upcoming policy renewals" defaultOn />
                <ToggleRow label="System Updates" description="Receive platform news and feature updates" />
            </SettingGroup>

            <SettingGroup title="In-App Notifications" icon={Bell}>
                <ToggleRow label="Desktop Notifications" description="Browser push notifications for urgent items" />
                <ToggleRow label="Dashboard Alerts" description="Show alert banners on the dashboard" defaultOn />
            </SettingGroup>
        </div>
    );
}

// ─── Display Section ─────────────────────────────────────────
function DisplaySection() {
    return (
        <div>
            <SectionHeader title="Display & Preferences" description="Customize your workspace appearance and defaults" />

            <SettingGroup title="Theme" icon={Monitor}>
                <SettingRow label="Appearance" value="Dark" note="Theme switching coming soon" />
                <SettingRow label="Sidebar" value="Auto-collapse" note="Adjusts based on screen width" />
            </SettingGroup>

            <SettingGroup title="Dashboard Defaults" icon={Globe}>
                <SettingRow label="Default Tab" value="Policy Table" actionLabel="Change" placeholder />
                <SettingRow label="Rows Per Page" value="10" actionLabel="Change" placeholder />
                <SettingRow label="Default Date Range" value="14 days" actionLabel="Change" placeholder />
            </SettingGroup>
        </div>
    );
}

// ─── Admin Section ───────────────────────────────────────────
function AdminSection() {
    return (
        <div>
            <SectionHeader title="Admin Settings" description="Platform-wide configuration (admin only)" />

            <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-error-subtle)',
                border: '1px solid rgba(191,25,50,0.12)',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                fontSize: '0.75rem',
                color: 'var(--status-error)',
            }}>
                ⚠️ Changes in this section affect all users. Proceed with care.
            </div>

            <SettingGroup title="Branding" icon={Palette}>
                <SettingRow label="Company Name" value="Alsop Inc" actionLabel="Edit" placeholder />
                <SettingRow label="Logo" value="CoverageCheckNow shield" actionLabel="Upload" placeholder />
                <SettingRow label="Primary Color" value="#3b82f6" actionLabel="Change" placeholder />
            </SettingGroup>

            <SettingGroup title="Integrations" icon={Database}>
                <SettingRow label="Email Provider" value="Not configured" actionLabel="Configure" placeholder />
                <SettingRow label="Data Source / API" value="Supabase" note="Managed internally" />
                <SettingRow label="Document Storage" value="Supabase Storage" note="Managed internally" />
            </SettingGroup>

            <SettingGroup title="Policies & Retention" icon={Lock}>
                <SettingRow label="Data Retention" value="Indefinite" actionLabel="Configure" placeholder />
                <SettingRow label="Privacy Settings" value="Default" actionLabel="Configure" placeholder />
                <SettingRow label="Office Defaults" value="Auto-assign" actionLabel="Configure" placeholder />
            </SettingGroup>
        </div>
    );
}

// ─── Shared Components ───────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem' }}>{title}</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{description}</p>
        </div>
    );
}

function SettingGroup({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <Icon size={14} style={{ color: 'var(--accent-secondary)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
            </div>
            <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                overflow: 'hidden',
            }}>
                {children}
            </div>
        </div>
    );
}

function SettingRow({ label, value, note, actionLabel, actionHref, placeholder, onAction }: {
    label: string;
    value: React.ReactNode;
    note?: string;
    actionLabel?: string;
    actionHref?: string;
    placeholder?: boolean;
    onAction?: () => void;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.875rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '0.75rem',
        }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-high)', fontWeight: 500, width: '160px', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-mid)', flex: 1 }}>
                {value}
                {note && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>({note})</span>}
            </span>
            {actionLabel && (
                actionHref ? (
                    <a href={actionHref} style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>{actionLabel}</a>
                ) : (
                    <button onClick={onAction} style={{
                        fontSize: '0.72rem',
                        color: placeholder ? 'var(--text-muted)' : 'var(--accent-primary)',
                        background: 'none',
                        border: 'none',
                        fontWeight: 500,
                        cursor: placeholder ? 'default' : 'pointer',
                        opacity: placeholder ? 0.6 : 1,
                        flexShrink: 0,
                    }}>
                        {actionLabel} {placeholder && <span style={{ fontSize: '0.65rem' }}>soon</span>}
                    </button>
                )
            )}
        </div>
    );
}

function EditableRow({ label, value, onChange, inputStyle, type = 'text' }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    inputStyle: React.CSSProperties;
    type?: string;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem 0.875rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '0.75rem',
        }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-high)', fontWeight: 500, width: '160px', flexShrink: 0 }}>{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={inputStyle}
            />
        </div>
    );
}

function ToggleRow({ label, description, defaultOn }: { label: string; description: string; defaultOn?: boolean }) {
    const [on, setOn] = useState(defaultOn || false);
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.875rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '0.75rem',
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-high)', fontWeight: 500, marginBottom: '0.15rem' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{description}</div>
            </div>
            <button
                onClick={() => setOn(!on)}
                style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: on ? 'var(--accent-primary)' : 'var(--bg-surface-raised)',
                    border: '1px solid ' + (on ? 'var(--accent-primary-hover)' : 'var(--border-default)'),
                    padding: '2px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                }}
            >
                <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: on ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                    transform: on ? 'translateX(16px)' : 'translateX(0)',
                }} />
            </button>
        </div>
    );
}

// ─── Report Editor Section ──────────────────────────────────────
interface ReportSectionConfig {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    order: number;
}

const DEFAULT_REPORT_SECTIONS: ReportSectionConfig[] = [
    { id: 'executive_summary', label: 'Executive Summary', description: '2-4 sentence overview of findings and risk posture.', enabled: true, order: 0 },
    { id: 'key_findings', label: 'Key Findings', description: 'Top 3-5 concerns sorted by priority.', enabled: true, order: 1 },
    { id: 'coverage_review', label: 'Coverage Review', description: 'Compact table of coverage lines with limits and adequacy status.', enabled: true, order: 2 },
    { id: 'next_steps', label: 'Next Steps', description: 'Merged recommendations, action items, and data gaps by urgency.', enabled: true, order: 3 },
    { id: 'sources', label: 'Sources & Credits', description: 'Named data sources used in the analysis.', enabled: true, order: 4 },
];

function ReportEditorSection() {
    const [sections, setSections] = useState<ReportSectionConfig[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('report_template_config');
            if (saved) try { return JSON.parse(saved); } catch { /* ignore */ }
        }
        return DEFAULT_REPORT_SECTIONS;
    });
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const handleSave = () => {
        localStorage.setItem('report_template_config', JSON.stringify(sections));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;
        setSections(prev => {
            const copy = [...prev];
            const fromIdx = copy.findIndex(s => s.id === draggedId);
            const toIdx = copy.findIndex(s => s.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [removed] = copy.splice(fromIdx, 1);
            copy.splice(toIdx, 0, removed);
            return copy.map((s, i) => ({ ...s, order: i }));
        });
    };

    const activeSections = sections.filter(s => s.enabled);

    const eyeOn = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    const eyeOff = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    const grip = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.15rem' }}>Report Template Editor</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Control which sections appear in client-facing reports. Drag to reorder.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => setSections(DEFAULT_REPORT_SECTIONS)} style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer' }}>Reset</button>
                    <button onClick={handleSave} style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-primary)', color: 'var(--text-inverse)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>{saved ? '✓ Saved' : 'Save'}</button>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {[
                    { count: activeSections.length, label: 'Active' },
                    { count: sections.length - activeSections.length, label: 'Hidden' },
                ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.65rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-high)' }}>{s.count}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Agent note */}
            <div style={{
                background: 'var(--bg-info-subtle)', border: '1px solid rgba(0,181,190,0.2)',
                borderLeft: '3px solid var(--status-info)', borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-mid)',
                lineHeight: 1.5, marginBottom: '1rem',
            }}>
                <strong style={{ color: 'var(--text-high)' }}>Note:</strong> Agent-only insights (property observations, data gaps, AI notes) are shown automatically in the{' '}
                <em style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--accent-primary)' }}>Agent Action Items</em>{' '}
                panel on the policy page. They are never included in client reports.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem' }}>
                {/* Section cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {sections.map(section => (
                        <div
                            key={section.id}
                            draggable
                            onDragStart={() => setDraggedId(section.id)}
                            onDragOver={(e) => handleDragOver(e, section.id)}
                            onDragEnd={() => setDraggedId(null)}
                            style={{
                                background: 'var(--bg-surface-raised)',
                                border: `1px solid ${draggedId === section.id ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                borderRadius: 'var(--radius-lg)',
                                opacity: section.enabled ? 1 : 0.4,
                                transition: 'all 0.15s',
                                cursor: 'grab',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem' }}>
                                <span style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}>{grip}</span>
                                <span onClick={() => setExpandedId(expandedId === section.id ? null : section.id)} style={{ flex: 1, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-high)', cursor: 'pointer' }}>{section.label}</span>

                                {/* Toggle */}
                                <button
                                    onClick={() => setSections(prev => prev.map(s => s.id === section.id ? { ...s, enabled: !s.enabled } : s))}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '28px', height: '28px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', cursor: 'pointer',
                                        background: section.enabled ? 'var(--bg-success-subtle)' : 'transparent',
                                        color: section.enabled ? 'var(--status-success)' : 'var(--text-muted)',
                                    }}
                                >
                                    {section.enabled ? eyeOn : eyeOff}
                                </button>
                            </div>

                            {expandedId === section.id && (
                                <div style={{ padding: '0 0.75rem 0.5rem 2.4rem' }}>
                                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{section.description}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Preview */}
                <div style={{ position: 'sticky', top: '1.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Template Preview</div>
                    <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: 'var(--radius-xs)', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.35rem', fontWeight: 800 }}>CCN</div>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-high)' }}>Coverage Analysis Report</span>
                        </div>
                        {activeSections.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>No sections enabled.</div>
                        ) : (
                            activeSections.map(s => (
                                <div key={s.id} style={{ marginBottom: '0.4rem' }}>
                                    <div style={{ fontSize: '0.45rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)', marginBottom: '0.12rem' }}>{s.label}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                                        <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '2px', width: '88%' }} />
                                        <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '2px', width: '65%' }} />
                                    </div>
                                </div>
                            ))
                        )}
                        <div style={{ marginTop: '0.4rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.42rem', fontWeight: 700, color: 'var(--accent-primary)', textAlign: 'center' }}>CoverageCheckNow</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
