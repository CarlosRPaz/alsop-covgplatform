'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Briefcase, FileText, Shield, Mail, Phone, MapPin,
    Calendar, Loader2, ChevronRight, Clock,
    DollarSign, ArrowRight, File, Download, MessageSquare,
    Send, Settings, ArrowLeft, Eye, X, AlertTriangle,
    CheckCircle, Home, Upload, Info, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';

// ── Dummy Data ──────────────────────────────────────────────────
const DEMO_CLIENT = {
    name: 'Jane & Robert Martinez',
    email: 'martinez.demo@example.com',
    phone: '(626) 555-0147',
    address: '4821 Ridgecrest Drive, Claremont, CA 91711',
    memberSince: '2019-03-15',
};

const DEMO_POLICIES = [
    {
        id: 'demo-policy-1',
        policyNumber: 'CFP-7294810',
        carrier: 'California FAIR Plan',
        address: '4821 Ridgecrest Drive, Claremont, CA 91711',
        status: 'active' as const,
        effectiveDate: '2025-09-01',
        expirationDate: '2026-09-01',
        premium: 2340,
        flagCount: 2,
        dwelling: 485000,
        otherStructures: 48500,
        personalProperty: 242500,
        fairRentalValue: 48500,
        deductible: 5000,
    },
    {
        id: 'demo-policy-2',
        policyNumber: 'CFP-6183205',
        carrier: 'California FAIR Plan',
        address: '1190 Mountain View Terrace, Upland, CA 91784',
        status: 'pending_review' as const,
        effectiveDate: '2025-07-15',
        expirationDate: '2026-07-15',
        premium: 1875,
        flagCount: 0,
        dwelling: 390000,
        otherStructures: 39000,
        personalProperty: 195000,
        fairRentalValue: 39000,
        deductible: 3500,
    },
];

const DEMO_RECENT_DOCS = [
    { label: 'Declaration Page — CFP-7294810', policyNumber: 'CFP-7294810', type: 'dec' as const },
    { label: 'Coverage Analysis Report — CFP-7294810', policyNumber: 'CFP-7294810', type: 'report' as const },
    { label: 'Declaration Page — CFP-6183205', policyNumber: 'CFP-6183205', type: 'dec' as const },
];

const DEMO_RECOMMENDATIONS = [
    { priority: 'high', title: 'Dwelling Coverage Below Replacement Cost', description: 'Current dwelling limit of $485,000 is approximately 18% below the estimated replacement cost of $590,000. Consider increasing coverage to avoid a coinsurance penalty in the event of a partial loss.' },
    { priority: 'medium', title: 'Fair Rental Value May Be Insufficient', description: 'Current fair rental value limit of $48,500 may not cover 12 months of rental costs in the Claremont area, where average monthly rent for comparable properties is approximately $4,800.' },
    { priority: 'low', title: 'Consider Updating Personal Property Inventory', description: 'We recommend reviewing your personal property coverage to ensure high-value items such as electronics, jewelry, and artwork are adequately documented.' },
];

export default function ClientPortalPreview() {
    const router = useRouter();
    const [activeView, setActiveView] = useState<'portal' | 'policy'>('portal');
    const [selectedPolicy, setSelectedPolicy] = useState(DEMO_POLICIES[0]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const totalPremium = DEMO_POLICIES.reduce((s, p) => s + p.premium, 0);
    const totalFlags = DEMO_POLICIES.reduce((s, p) => s + p.flagCount, 0);

    const daysUntilExpiry = Math.ceil(
        (new Date(selectedPolicy.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const totalTermDays = Math.ceil(
        (new Date(selectedPolicy.expirationDate).getTime() - new Date(selectedPolicy.effectiveDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const termProgress = Math.max(0, Math.min(100, ((totalTermDays - daysUntilExpiry) / totalTermDays) * 100));

    const statusColor = (s: string) =>
        s === 'active' ? '#22c55e' : s === 'pending_review' ? '#f59e0b' : '#64748b';
    const statusLabel = (s: string) =>
        s === 'active' ? 'Active' : s === 'pending_review' ? 'Under Review' : s;

    const priorityColor = (p: string) =>
        p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#3b82f6';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* ── Floating Preview Banner ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', padding: '0.6rem 1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Eye size={18} />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Client Portal Preview</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                        — Viewing as: {DEMO_CLIENT.name} (Demo Data)
                    </span>
                </div>
                <button
                    onClick={() => router.push('/settings')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                        color: '#fff', padding: '0.35rem 0.85rem', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    }}
                >
                    <X size={14} /> Exit Preview
                </button>
            </div>

            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>

                {/* ── View Switcher (Portal / Policy Detail) ── */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setActiveView('portal')}
                        style={{
                            padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.82rem', fontWeight: 600,
                            cursor: 'pointer', border: '1px solid var(--border-default)',
                            background: activeView === 'portal' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                            color: activeView === 'portal' ? '#fff' : 'var(--text-mid)',
                        }}
                    >
                        Client Dashboard
                    </button>
                    <button
                        onClick={() => setActiveView('policy')}
                        style={{
                            padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.82rem', fontWeight: 600,
                            cursor: 'pointer', border: '1px solid var(--border-default)',
                            background: activeView === 'policy' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                            color: activeView === 'policy' ? '#fff' : 'var(--text-mid)',
                        }}
                    >
                        Policy Detail View
                    </button>
                </div>

                {/* ══════════════════════════════════════════════════════════════ */}
                {/*  PORTAL DASHBOARD VIEW                                       */}
                {/* ══════════════════════════════════════════════════════════════ */}
                {activeView === 'portal' && (
                    <div>
                        {/* Welcome */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-high)', margin: '0 0 0.25rem 0' }}>
                                Welcome, {DEMO_CLIENT.name.split(' ')[0]} 👋
                            </h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                                Here&apos;s an overview of your coverage and policies.
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
                            {[
                                { label: 'Active Policies', value: DEMO_POLICIES.length, icon: <Shield size={20} style={{ color: 'var(--semantic-success)' }} />, bg: 'rgba(34,197,94,0.08)' },
                                { label: 'Total Premium', value: formatCurrency(totalPremium), icon: <DollarSign size={20} style={{ color: 'var(--accent-primary)' }} />, bg: 'var(--accent-primary-muted)' },
                                { label: 'Open Flags', value: totalFlags, icon: <AlertTriangle size={20} style={{ color: '#f59e0b' }} />, bg: 'rgba(245,158,11,0.08)' },
                            ].map((stat, i) => (
                                <div key={i} style={{
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px',
                                    padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
                                }}>
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-high)' }}>{stat.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* My Policies List */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Briefcase size={16} style={{ color: 'var(--accent-primary)' }} /> My Policies
                            </h2>
                            {DEMO_POLICIES.map(p => (
                                <div key={p.id}
                                    onClick={() => { setSelectedPolicy(p); setActiveView('policy'); }}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem',
                                        background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)',
                                        cursor: 'pointer', transition: 'border-color 0.15s',
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.88rem' }}>{p.policyNumber}</span>
                                            <span style={{
                                                padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
                                                background: `${statusColor(p.status)}15`, color: statusColor(p.status),
                                                border: `1px solid ${statusColor(p.status)}30`,
                                            }}>
                                                {statusLabel(p.status)}
                                            </span>
                                            {p.flagCount > 0 && (
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                                                    {p.flagCount} flag{p.flagCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <MapPin size={12} /> {p.address}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {p.carrier} · Renews {formatDate(p.expirationDate)} · {formatCurrency(p.premium)}/yr
                                        </div>
                                    </div>
                                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            ))}
                        </div>

                        {/* My Information + Quick Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0' }}>My Information</h3>
                                {[
                                    { icon: <Mail size={13} />, label: DEMO_CLIENT.email },
                                    { icon: <Phone size={13} />, label: DEMO_CLIENT.phone },
                                    { icon: <MapPin size={13} />, label: DEMO_CLIENT.address },
                                    { icon: <Calendar size={13} />, label: `Member since ${formatDate(DEMO_CLIENT.memberSince)}` },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-mid)', padding: '0.35rem 0' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span> {item.label}
                                    </div>
                                ))}
                            </div>
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0' }}>Quick Actions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)', border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                        <Upload size={15} /> Submit a Declaration Page
                                    </button>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--bg-surface-raised)', color: 'var(--text-mid)', border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                        <Settings size={15} /> Account Settings
                                    </button>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '8px', background: 'var(--bg-surface-raised)', color: 'var(--text-mid)', border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                        <MessageSquare size={15} /> Contact Support
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Recent Documents */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <File size={15} style={{ color: 'var(--accent-primary)' }} /> Recent Documents
                            </h3>
                            {DEMO_RECENT_DOCS.map((doc, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.6rem 0.75rem', borderRadius: '6px', marginBottom: '0.35rem',
                                    background: 'var(--bg-surface-raised)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-mid)' }}>
                                        <FileText size={14} style={{ color: doc.type === 'report' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                                        {doc.label}
                                    </div>
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        background: 'transparent', border: 'none', color: 'var(--accent-primary)',
                                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                    }}>
                                        <Download size={13} /> Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════ */}
                {/*  POLICY DETAIL VIEW                                          */}
                {/* ══════════════════════════════════════════════════════════════ */}
                {activeView === 'policy' && (
                    <div>
                        {/* Back */}
                        <button onClick={() => setActiveView('portal')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500,
                            background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.25rem',
                        }}>
                            <ArrowLeft size={14} /> Back to Portal
                        </button>

                        {/* Policy Header */}
                        <div style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px',
                            padding: '1.5rem', marginBottom: '1.25rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-high)', margin: 0 }}>
                                            {selectedPolicy.policyNumber}
                                        </h1>
                                        <span style={{
                                            padding: '0.2rem 0.6rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600,
                                            background: `${statusColor(selectedPolicy.status)}15`, color: statusColor(selectedPolicy.status),
                                            border: `1px solid ${statusColor(selectedPolicy.status)}30`,
                                        }}>
                                            {statusLabel(selectedPolicy.status)}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{selectedPolicy.carrier}</div>
                                    <div style={{ color: 'var(--text-mid)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
                                        <MapPin size={13} /> {selectedPolicy.address}
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.5rem 1rem', borderRadius: '8px',
                                    background: daysUntilExpiry <= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                                    border: `1px solid ${daysUntilExpiry <= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                                }}>
                                    <Clock size={15} style={{ color: daysUntilExpiry <= 60 ? '#f59e0b' : '#22c55e' }} />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: daysUntilExpiry <= 60 ? '#f59e0b' : '#22c55e' }}>
                                        {daysUntilExpiry} days until renewal
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Upload CTA (simulated) */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '1rem 1.25rem', borderRadius: '10px', marginBottom: '1.25rem',
                            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                        }}>
                            <CheckCircle size={20} style={{ color: '#22c55e', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-high)' }}>Coverage Report Ready</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Your AI coverage analysis has been generated and is ready for download.</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem' }}>
                            {/* Left: Coverage Grid + Recommendations */}
                            <div>
                                {/* Coverage Summary */}
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Shield size={16} style={{ color: 'var(--accent-primary)' }} /> Coverage Summary
                                    </h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                        {[
                                            { label: 'Dwelling (Coverage A)', value: formatCurrency(selectedPolicy.dwelling) },
                                            { label: 'Other Structures (Cov B)', value: formatCurrency(selectedPolicy.otherStructures) },
                                            { label: 'Personal Property (Cov C)', value: formatCurrency(selectedPolicy.personalProperty) },
                                            { label: 'Fair Rental Value (Cov D)', value: formatCurrency(selectedPolicy.fairRentalValue) },
                                            { label: 'Deductible', value: formatCurrency(selectedPolicy.deductible) },
                                            { label: 'Annual Premium', value: formatCurrency(selectedPolicy.premium) },
                                        ].map((cov, i) => (
                                            <div key={i} style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-surface-raised)' }}>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>{cov.label}</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-high)' }}>{cov.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Policy Term */}
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0' }}>Policy Term</h2>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-mid)', marginBottom: '0.5rem' }}>
                                        <span>Effective: {formatDate(selectedPolicy.effectiveDate)}</span>
                                        <span>Expiration: {formatDate(selectedPolicy.expirationDate)}</span>
                                    </div>
                                    <div style={{ background: 'var(--bg-surface-raised)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                                        <div style={{ width: `${termProgress}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '6px', transition: 'width 0.3s' }} />
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
                                        {Math.round(termProgress)}% of term elapsed
                                    </div>
                                </div>

                                {/* Recommendations */}
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem' }}>
                                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Zap size={16} style={{ color: '#f59e0b' }} /> Coverage Recommendations
                                    </h2>
                                    {DEMO_RECOMMENDATIONS.map((rec, i) => (
                                        <div key={i} style={{
                                            padding: '0.85rem', borderRadius: '8px', marginBottom: '0.6rem',
                                            background: 'var(--bg-surface-raised)', borderLeft: `3px solid ${priorityColor(rec.priority)}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                                                <span style={{
                                                    padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 700,
                                                    textTransform: 'uppercase', background: `${priorityColor(rec.priority)}15`, color: priorityColor(rec.priority),
                                                }}>
                                                    {rec.priority}
                                                </span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-high)' }}>{rec.title}</span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-mid)', lineHeight: 1.55 }}>{rec.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Sidebar */}
                            <div>
                                {/* My Documents */}
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0' }}>My Documents</h3>
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                                        padding: '0.65rem 0.85rem', borderRadius: '7px', marginBottom: '0.4rem',
                                        background: 'var(--accent-primary-muted)', border: '1px solid var(--border-default)',
                                        color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                    }}>
                                        <FileText size={15} /> Declarations Page PDF
                                    </button>
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                                        padding: '0.65rem 0.85rem', borderRadius: '7px',
                                        background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)',
                                        color: 'var(--text-mid)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                    }}>
                                        <Download size={15} /> Coverage Analysis Report
                                    </button>
                                </div>

                                {/* Property Details */}
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-high)', margin: '0 0 0.75rem 0' }}>Property Details</h3>
                                    {[
                                        { label: 'Year Built', value: '1978' },
                                        { label: 'Square Footage', value: '2,450 sq ft' },
                                        { label: 'Lot Size', value: '0.32 acres' },
                                        { label: 'Construction', value: 'Frame' },
                                        { label: 'Roof Type', value: 'Composition Shingle' },
                                        { label: 'Flood Zone', value: 'Zone X (Minimal Risk)' },
                                    ].map((prop, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.78rem', borderBottom: i < 5 ? '1px solid var(--border-subtle)' : 'none' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{prop.label}</span>
                                            <span style={{ color: 'var(--text-high)', fontWeight: 500 }}>{prop.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Contact Support */}
                                <button style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    width: '100%', padding: '0.7rem', borderRadius: '8px',
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                    color: 'var(--text-mid)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                                }}>
                                    <MessageSquare size={15} /> Contact Support
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
