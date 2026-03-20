'use client';

import React, { useState, useEffect } from 'react';
import { getUserProfile, UserProfile, isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import {
    Settings as SettingsIcon, User, Bell, Palette, Shield, ChevronRight,
    Mail, Key, Monitor, Globe, Database, Lock, Loader2, Satellite
} from 'lucide-react';
import DataSourcesCatalog from '@/components/settings/DataSourcesCatalog';

type Section = 'account' | 'notifications' | 'display' | 'admin' | 'data_sources';

const SECTIONS = [
    { id: 'account' as Section, label: 'Account', icon: User, description: 'Name, email, password' },
    { id: 'notifications' as Section, label: 'Notifications', icon: Bell, description: 'Email & alert preferences' },
    { id: 'display' as Section, label: 'Display', icon: Palette, description: 'Theme & layout preferences' },
    { id: 'data_sources' as Section, label: 'Data Sources', icon: Satellite, description: 'Enrichment pipeline catalog' },
    { id: 'admin' as Section, label: 'Admin Settings', icon: Shield, description: 'Branding, integrations, global config', adminOnly: true },
];

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<Section>('account');

    useEffect(() => {
        getUserProfile().then(p => {
            setProfile(p);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            </div>
        );
    }

    const showAdmin = profile && isAdmin(profile.role);

    return (
        <div style={{ maxWidth: activeSection === 'data_sources' ? '1200px' : '900px', margin: '2rem auto', padding: '0 1.5rem', transition: 'max-width 0.3s ease' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SettingsIcon size={22} style={{ color: '#6366f1' }} />
                    Settings
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage your preferences and account configuration</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem', minHeight: '500px' }}>
                {/* Left nav */}
                <nav style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.5rem',
                    height: 'fit-content',
                }}>
                    {SECTIONS.map(s => {
                        if (s.adminOnly && !showAdmin) return null;
                        const Icon = s.icon;
                        const isActive = activeSection === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.625rem',
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: isActive ? '#c7d2fe' : 'var(--text-mid)',
                                    fontSize: '0.8rem',
                                    fontWeight: isActive ? 600 : 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s',
                                    marginBottom: '0.125rem',
                                }}
                            >
                                <Icon size={15} />
                                <span style={{ flex: 1 }}>{s.label}</span>
                                {isActive && <ChevronRight size={13} style={{ color: '#818cf8' }} />}
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
                    {activeSection === 'admin' && <AdminSection />}
                </div>
            </div>
        </div>
    );
}

// ─── Account Section ─────────────────────────────────────────
function AccountSection({ profile }: { profile: UserProfile | null }) {
    return (
        <div>
            <SectionHeader title="Account" description="Your personal and security settings" />

            <SettingGroup title="Personal Information" icon={User}>
                <SettingRow label="Display Name" value={profile ? `${profile.first_name} ${profile.last_name}` : '—'} actionLabel="Edit on Profile" actionHref="/profile" />
                <SettingRow label="Email" value={profile?.email || '—'} note="Contact your admin to change" />
                <SettingRow label="Phone" value={profile?.phone || 'Not set'} actionLabel="Edit on Profile" actionHref="/profile" />
            </SettingGroup>

            <SettingGroup title="Security" icon={Key}>
                <SettingRow label="Password" value="••••••••" actionLabel="Reset Password" placeholder />
                <SettingRow label="Two-Factor Authentication" value="Not enabled" actionLabel="Enable" placeholder />
                <SettingRow label="Active Sessions" value="1 active session" note="Current session" />
            </SettingGroup>

            <SettingGroup title="Email Signature" icon={Mail}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                    Configure your email signature for outbound communications. <em>Coming soon.</em>
                </div>
            </SettingGroup>
        </div>
    );
}

// ─── Notifications Section ───────────────────────────────────
function NotificationsSection() {
    return (
        <div>
            <SectionHeader title="Notifications" description="Control how and when you receive alerts" />

            <SettingGroup title="Email Notifications" icon={Mail}>
                <ToggleRow label="Flag Alerts" description="Get emailed when new critical or high severity flags are created" defaultOn />
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
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.12)',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                fontSize: '0.75rem',
                color: '#fca5a5',
            }}>
                ⚠️ Changes in this section affect all users. Proceed with care.
            </div>

            <SettingGroup title="Branding" icon={Palette}>
                <SettingRow label="Company Name" value="Alsop Inc" actionLabel="Edit" placeholder />
                <SettingRow label="Logo" value="Gap Guard shield" actionLabel="Upload" placeholder />
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
                <Icon size={14} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
            </div>
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '8px',
                overflow: 'hidden',
            }}>
                {children}
            </div>
        </div>
    );
}

function SettingRow({ label, value, note, actionLabel, actionHref, placeholder }: {
    label: string;
    value: React.ReactNode;
    note?: string;
    actionLabel?: string;
    actionHref?: string;
    placeholder?: boolean;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.875rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            gap: '0.75rem',
        }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-high)', fontWeight: 500, width: '160px', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-mid)', flex: 1 }}>
                {value}
                {note && <span style={{ color: '#64748b', fontSize: '0.72rem', marginLeft: '0.5rem' }}>({note})</span>}
            </span>
            {actionLabel && (
                actionHref ? (
                    <a href={actionHref} style={{ fontSize: '0.72rem', color: '#818cf8', textDecoration: 'none', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>{actionLabel}</a>
                ) : (
                    <button style={{
                        fontSize: '0.72rem',
                        color: placeholder ? '#475569' : '#818cf8',
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

function ToggleRow({ label, description, defaultOn }: { label: string; description: string; defaultOn?: boolean }) {
    const [on, setOn] = useState(defaultOn || false);
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.875rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            gap: '0.75rem',
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-high)', fontWeight: 500, marginBottom: '0.15rem' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{description}</div>
            </div>
            <button
                onClick={() => setOn(!on)}
                style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: on ? '#6366f1' : 'rgba(255,255,255,0.08)',
                    border: '1px solid ' + (on ? '#818cf8' : 'rgba(255,255,255,0.12)'),
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
                    background: on ? '#fff' : '#64748b',
                    transition: 'all 0.2s',
                    transform: on ? 'translateX(16px)' : 'translateX(0)',
                }} />
            </button>
        </div>
    );
}
