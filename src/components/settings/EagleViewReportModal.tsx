'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    X, MapPin, AlertTriangle, Image as ImageIcon, Home,
    CheckCircle2, XCircle, Droplets, Info, Maximize2,
    Clock, Hash, Compass, ChevronDown, ChevronRight, Wind, Shield, Trees
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/* ─── Types ───────────────────────────────────────── */

interface EagleViewReportModalProps {
    result: any;
    onClose: () => void;
}

/* ─── Tiny helpers ────────────────────────────────── */

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
    return (
        <span style={{
            fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
            background: bg, color: fg, fontWeight: 600, whiteSpace: 'nowrap',
        }}>{children}</span>
    );
}

function ConfBadge({ v }: { v?: number }) {
    if (v == null) return null;
    if (v === -1) return <Badge bg="#e5e5e5" fg="#888">N/A</Badge>;
    const p = Math.round(v * 100);
    const c = p >= 80 ? '#2B9B4B' : p >= 50 ? '#FF9F00' : '#BF1932';
    return <Badge bg={`${c}15`} fg={c}>{p}%</Badge>;
}

function BoolVal({ v }: { v?: string | null | boolean }) {
    if (v == null || String(v) === 'null' || String(v) === 'unknown')
        return <span style={{ color: '#8b8b9e', fontSize: '0.85rem' }}>—</span>;
    const yes = String(v).toLowerCase() === 'yes' || String(v).toLowerCase() === 'true';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: yes ? '#2B9B4B' : '#BF1932', fontWeight: 500, fontSize: '0.85rem' }}>
            {yes ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {yes ? 'Yes' : 'No'}
        </span>
    );
}

/* ─── Stat card ───────────────────────────────────── */

function Stat({ label, children, conf }: { label: string; children: React.ReactNode; conf?: number }) {
    return (
        <div style={{
            padding: '12px 14px', background: '#FAFAF7', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
            <div style={{
                fontSize: '0.65rem', color: '#8b8b9e', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontWeight: 700,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                {label} <ConfBadge v={conf} />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1a1a2e', textTransform: 'capitalize', wordBreak: 'break-word' }}>
                {children}
            </div>
        </div>
    );
}

/* ─── Section accordion ───────────────────────────── */

function Section({ title, icon, defaultOpen = true, children }: {
    title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    backgroundColor: open ? '#fafafa' : '#fff', transition: 'background-color 0.2s'
                }}
            >
                {icon}
                <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'left' }}>{title}</span>
                {open ? <ChevronDown size={18} color="#888" /> : <ChevronRight size={18} color="#888" />}
            </button>
            {open && <div style={{ padding: '16px 18px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>{children}</div>}
        </div>
    );
}

/* ─── Image card with lazy load ───────────────────── */

function ImgCard({ imgRef, imgData, sessionToken }: { imgRef: string; imgData: any; sessionToken: string }) {
    const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    const [expanded, setExpanded] = useState(false);
    const token = imgData.image_token;
    const meta = imgData.metadata || {};
    const src = `/api/admin/integrations/eagleview/image/${token}?session=${sessionToken}`;
    const view = meta.view === 'oblique' ? 'Oblique' : 'Ortho';
    const dir = meta.cardinal_direction ? meta.cardinal_direction.charAt(0).toUpperCase() + meta.cardinal_direction.slice(1) : null;

    useEffect(() => { setState('loading'); }, []);

    return (
        <>
            <div style={{
                background: '#fff', borderRadius: 10, overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                display: 'flex', flexDirection: 'column'
            }}>
                <div
                    style={{ height: 180, background: '#F0EDE5', position: 'relative', cursor: state === 'loaded' ? 'zoom-in' : 'default', overflow: 'hidden' }}
                    onClick={() => state === 'loaded' && setExpanded(true)}
                >
                    {state === 'loading' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.75rem' }}>
                            <div style={{ textAlign: 'center' }}><ImageIcon size={22} style={{ opacity: 0.4, marginBottom: 6 }} /><div>Loading…</div></div>
                        </div>
                    )}
                    {state === 'error' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF1932', fontSize: '0.75rem', background: '#fef2f2' }}>
                            <div style={{ textAlign: 'center' }}><AlertTriangle size={20} style={{ marginBottom: 6 }} /><div>Failed</div></div>
                        </div>
                    )}
                    {state !== 'error' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={src} alt={`${view}${dir ? ' — ' + dir : ''}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'loaded' ? 'block' : 'none', transition: 'transform 0.2s' }}
                            onLoad={() => setState('loaded')}
                            onError={() => setState('error')}
                            onMouseOver={(e) => { if(state==='loaded') e.currentTarget.style.transform = 'scale(1.03)'; }}
                            onMouseOut={(e) => { if(state==='loaded') e.currentTarget.style.transform = 'scale(1)'; }}
                        />
                    )}
                    {state === 'loaded' && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: 5, color: '#fff' }}>
                            <Maximize2 size={14} />
                        </div>
                    )}
                    <div style={{
                        position: 'absolute', bottom: 8, left: 8,
                        background: meta.view === 'oblique' ? 'rgba(34,67,182,0.9)' : 'rgba(0,0,0,0.65)',
                        color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{view}</div>
                </div>
                <div style={{ padding: '8px 12px', fontSize: '0.7rem', color: '#666', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ display: 'flex', gap: 12 }}>
                        {dir && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Compass size={12} /> {dir}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {meta.shot_date || '—'}</span>
                    </span>
                    <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.65rem' }}>{imgRef}</span>
                </div>
            </div>

            {/* Lightbox */}
            {expanded && (
                <div onClick={() => setExpanded(false)} style={{
                    position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Full" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 8 }} />
                    <button onClick={() => setExpanded(false)} style={{
                        position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
                        border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s'
                    }}><X size={20} /></button>
                </div>
            )}
        </>
    );
}

/* ─── Paginated image gallery ─────────────────────── */

function ImageGallery({ imageRefs, images, sessionToken }: { imageRefs: string[]; images: any; sessionToken: string }) {
    const PAGE_SIZE = 12;
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(imageRefs.length / PAGE_SIZE);
    const slice = imageRefs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                {slice.map(ref => {
                    const d = images[ref];
                    if (!d?.image_token) return null;
                    return <ImgCard key={d.image_token} imgRef={ref} imgData={d} sessionToken={sessionToken} />;
                })}
            </div>
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={pgBtn(page > 0)}>← Previous</button>
                    <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
                        Page {page + 1} of {totalPages} <span style={{color: '#aaa', marginLeft: 4}}>({imageRefs.length} images)</span>
                    </span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtn(page < totalPages - 1)}>Next →</button>
                </div>
            )}
        </div>
    );
}
function pgBtn(active: boolean): React.CSSProperties {
    return {
        fontSize: '0.85rem', padding: '8px 16px', borderRadius: 6,
        border: '1px solid', borderColor: active ? '#2243B6' : 'rgba(0,0,0,0.1)', 
        background: active ? '#fff' : '#f5f5f5', color: active ? '#2243B6' : '#aaa', 
        cursor: active ? 'pointer' : 'default', fontWeight: 600, transition: 'all 0.2s'
    };
}

/* ═══════════════════════════════════════════════════ */
/* ─── Main Modal ──────────────────────────────────── */
/* ═══════════════════════════════════════════════════ */

export default function EagleViewReportModal({ result, onClose }: EagleViewReportModalProps) {
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data?.session?.access_token) setSessionToken(data.session.access_token);
        });
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Close on Escape
    const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
    useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

    if (!result?.data) return null;

    const { data, metadata } = result;
    const d = data.property || data;
    const addr = d.response_address?.full_address || d.input?.address?.completeAddress || 'Unknown';
    const co = d.response_coordinates;
    const imgs = d.imagery || {};
    const imgKeys = Object.keys(imgs).sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, '')) || 0;
        const nb = parseInt(b.replace(/\D/g, '')) || 0;
        return na - nb;
    });
    const structs = d.structures || [];
    const pool = d.pool || {};
    const tramp = d.trampoline || {};

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 99990,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#F8F7F4', width: '100%', maxWidth: 1200, maxHeight: '94vh',
                borderRadius: 16, display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
                {/* ─ Header ─ */}
                <div style={{
                    padding: '20px 24px', background: '#fff',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a1a2e', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Home size={22} color="#2243B6" /> Property Intelligence Report
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><MapPin size={14} color="#2243B6" /> {addr}</span>
                            {co && <span style={{ color: '#888' }}>{co.lat.toFixed(5)}, {co.lon.toFixed(5)}</span>}
                            {metadata?.requestId && (
                                <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Hash size={12} /> {metadata.requestId}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#f1f1f1', border: 'none', color: '#555', cursor: 'pointer',
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#e5e5e5'}
                    onMouseOut={e => e.currentTarget.style.background = '#f1f1f1'}
                    ><X size={18} /></button>
                </div>

                {/* ─ Scrollable body ─ */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* General Conditions */}
                    <Section title="General Property Details" icon={<Info size={18} color="#2243B6" />}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            <Stat label="Driveway Condition" conf={d.property_driveway_condition_rating?.confidence}>
                                {d.property_driveway_condition_rating?.value || '—'}
                            </Stat>
                            <Stat label="Lawn Condition" conf={d.property_lawn_condition_rating?.confidence}>
                                {d.property_lawn_condition_rating?.value || '—'}
                            </Stat>
                            <Stat label="Fence Presence" conf={d.property_fence_presence?.confidence}>
                                <BoolVal v={d.property_fence_presence?.value} />
                            </Stat>
                            <Stat label="Fence Combustibility" conf={d.property_fence_material_combustibility?.confidence}>
                                {d.property_fence_material_combustibility?.value || '—'}
                            </Stat>
                            <Stat label="Yard Debris (Coverage)">
                                {d.property_yard_debris?.coverage?.value != null
                                    ? `${(d.property_yard_debris.coverage.value * 100).toFixed(1)}%` : '—'}
                            </Stat>
                            <Stat label="Yard Debris (Area)">
                                {d.property_yard_debris?.area?.value != null
                                    ? `${d.property_yard_debris.area.value} sqft` : '—'}
                            </Stat>
                            <Stat label="Acc. Structure Roof Condition" conf={d.property_accessory_structure_roof_condition_rating?.confidence}>
                                {d.property_accessory_structure_roof_condition_rating?.value || '—'}
                            </Stat>
                        </div>
                    </Section>

                    {/* Hazards */}
                    <Section title="Hazards & Liability Features" icon={<AlertTriangle size={18} color="#FF9F00" />}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                            {/* Pool Card */}
                            <div style={{ padding: 16, background: '#FAFAF7', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#1a1a2e' }}>
                                    <Droplets size={16} color="#3b82f6" /> Swimming Pool
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Presence</span><BoolVal v={pool.property_pool_presence?.value} /></div>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Enclosure</span><BoolVal v={pool.property_pool_enclosure_presence?.value} /></div>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Slide</span><BoolVal v={pool.property_pool_slide_presence?.value} /></div>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Condition</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '0.85rem' }}>{pool.property_pool_condition_rating?.value || '—'}</span>
                                    </div>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Type</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '0.85rem' }}>{pool.property_pool_structure_type?.value || '—'}</span>
                                    </div>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Occlusion</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '0.85rem' }}>{pool.property_pool_occlusion_classification?.value || '—'}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Trampoline Card */}
                            <div style={{ padding: 16, background: '#FAFAF7', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#1a1a2e' }}>
                                    <AlertTriangle size={16} color="#FF9F00" /> Trampoline
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                                    <div><span style={{ color: '#8b8b9e', fontSize: '0.7rem', display: 'block', fontWeight: 600, textTransform:'uppercase', marginBottom:2 }}>Presence</span><BoolVal v={tramp.property_trampoline_presence?.value} /></div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* Structures */}
                    <Section title={`Structures & Roof Intelligence (${structs.length})`} icon={<Home size={18} color="#5A3E85" />}>
                        {structs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: '0.9rem', background: '#fafafa', borderRadius: 8 }}>No structures detected on this property.</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {structs.map((s: any, i: number) => {
                                const r = s.roof || {};
                                const cond = r.structure_roof_condition_elements || {};
                                return (
                                    <div key={i} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16, color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #f0f0f0', paddingBottom: 10 }}>
                                            <span>Structure {i + 1}</span>
                                            {s.structure_images?.image_references?.length > 0 && (
                                                <Badge bg="#eef2ff" fg="#4f46e5">{s.structure_images.image_references.length} Linked Images</Badge>
                                            )}
                                        </div>

                                        {/* Structure Details */}
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5A3E85', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Home size={14} /> Base Dimensions & Details
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                                <Stat label="Footprint" conf={s.structure_footprint_sqft?.confidence}>{s.structure_footprint_sqft?.value != null ? `${s.structure_footprint_sqft.value} sqft` : '—'}</Stat>
                                                <Stat label="Eave Height" conf={s.structure_eave_height?.confidence}>
                                                    {s.structure_eave_height?.value ? Object.entries(s.structure_eave_height.value).filter(([_,v])=>v!=null).map(([k,v]) => `${k}:${v}ft`).join(', ') || '—' : '—'}
                                                </Stat>
                                                <Stat label="Wood Deck" conf={s.structure_wood_deck_presence?.confidence}><BoolVal v={s.structure_wood_deck_presence?.value} /></Stat>
                                                <Stat label="Chimney" conf={s.structure_chimney_presence?.confidence}><BoolVal v={s.structure_chimney_presence?.value} /></Stat>
                                                <Stat label="Centroid (Lat/Lon)">{s.structure_centroid ? `${s.structure_centroid.lat.toFixed(4)}, ${s.structure_centroid.lon.toFixed(4)}` : '—'}</Stat>
                                            </div>
                                        </div>

                                        {/* Risk & Environment */}
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF9F00', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Shield size={14} /> Risk & Environment
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                                <Stat label="Wildfire Mitigation" conf={s.structure_wildfire_mitigation_rating?.confidence}>{s.structure_wildfire_mitigation_rating?.value || '—'}</Stat>
                                                <Stat label="Wildfire Vuln." conf={s.structure_wildfire_vulnerability_rating?.confidence}>{s.structure_wildfire_vulnerability_rating?.value || '—'}</Stat>
                                                <Stat label="Hail Vuln." conf={s.structure_hail_vulnerability_rating?.confidence}>{s.structure_hail_vulnerability_rating?.value || '—'}</Stat>
                                                <Stat label="Hail Loss Severity" conf={s.structure_hail_loss_severity_rating?.confidence}>{s.structure_hail_loss_severity_rating?.value || '—'}</Stat>
                                                <Stat label="Structure Density Z1/Z2">
                                                    {s.structure_density_zones?.structure_density_zone_1?.value || 0} / {s.structure_density_zones?.structure_density_zone_2?.value || 0}
                                                </Stat>
                                                <Stat label="Vegetation Z1/Z2/Z3">
                                                    {s.vegetation_coverage_zones?.vegetation_coverage_zone_1?.value || 0} / {s.vegetation_coverage_zones?.vegetation_coverage_zone_2?.value || 0} / {s.vegetation_coverage_zones?.vegetation_coverage_zone_3?.value || 0}
                                                </Stat>
                                                <Stat label="Veg Setback" conf={s.structure_vegetation_setback?.vegetation_setback?.confidence}>
                                                    {s.structure_vegetation_setback?.vegetation_setback?.value != null ? `${s.structure_vegetation_setback.vegetation_setback.value} ft` : '—'}
                                                </Stat>
                                                <Stat label="Structure Setback" conf={s.structure_setback?.confidence}>{s.structure_setback?.value != null ? `${s.structure_setback.value} ft` : '—'}</Stat>
                                            </div>
                                        </div>

                                        {/* Roof Overview */}
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2B9B4B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Wind size={14} /> Roof Specifications
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                                <Stat label="Shape" conf={r.structure_roof_shape?.confidence}>{r.structure_roof_shape?.value || '—'}</Stat>
                                                <Stat label="Primary Material" conf={r.structure_roof_material_primary?.confidence}>{r.structure_roof_material_primary?.value || '—'}</Stat>
                                                <Stat label="Pitch" conf={r.structure_roof_predominant_pitch?.confidence}>
                                                    {r.structure_roof_predominant_pitch?.value != null ? `${r.structure_roof_predominant_pitch.value}/12` : '—'}
                                                </Stat>
                                                <Stat label="Condition Rating" conf={r.structure_roof_condition_rating?.confidence}>{r.structure_roof_condition_rating?.value || '—'}</Stat>
                                                <Stat label="Area" conf={r.structure_roof_area?.confidence}>{r.structure_roof_area?.value != null ? `${r.structure_roof_area.value} sqft` : '—'}</Stat>
                                                <Stat label="Squares" conf={r.structure_roof_area_squares?.confidence}>{r.structure_roof_area_squares?.value || '—'}</Stat>
                                                <Stat label="Est. Age" conf={r.structure_roof_age?.confidence}>{r.structure_roof_age?.value != null ? `${r.structure_roof_age.value} yrs` : '—'}</Stat>
                                                <Stat label="Facet Count" conf={r.structure_roof_facet_count?.confidence}>{r.structure_roof_facet_count?.value || '—'}</Stat>
                                                <Stat label="Tree Overhang" conf={r.structure_tree_overhang_classification?.confidence}>{r.structure_tree_overhang_classification?.value?.replace(/_/g, ' ') || '—'}</Stat>
                                                <Stat label="Solar Panels" conf={r.structure_roof_solar_panel_presence?.confidence}><BoolVal v={r.structure_roof_solar_panel_presence?.value} /></Stat>
                                                <Stat label="Air Conditioners">{r.structure_roof_air_conditioner_count?.value || '0'}</Stat>
                                            </div>
                                        </div>

                                        {/* Roof Anomalies / Conditions */}
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#BF1932', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertTriangle size={14} /> Roof Condition Anomalies
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                                <Stat label="Ponding" conf={cond.structure_roof_ponding?.confidence}><BoolVal v={cond.structure_roof_ponding?.value} /></Stat>
                                                <Stat label="Tarp" conf={cond.structure_roof_tarp?.confidence}><BoolVal v={cond.structure_roof_tarp?.value} /></Stat>
                                                <Stat label="Patching" conf={cond.structure_roof_patching?.confidence}><BoolVal v={cond.structure_roof_patching?.value} /></Stat>
                                                <Stat label="Streaking" conf={cond.structure_roof_streaking?.confidence}><span style={{textTransform:'capitalize'}}>{cond.structure_roof_streaking?.value?.replace(/_/g, ' ') || '—'}</span></Stat>
                                                <Stat label="Degradation" conf={cond.structure_roof_material_degradation?.confidence}><span style={{textTransform:'capitalize'}}>{cond.structure_roof_material_degradation?.value?.replace(/_/g, ' ') || '—'}</span></Stat>
                                                <Stat label="Discoloration" conf={cond.structure_roof_natural_discoloration?.confidence}><span style={{textTransform:'capitalize'}}>{cond.structure_roof_natural_discoloration?.value?.replace(/_/g, ' ') || '—'}</span></Stat>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Imagery */}
                    <Section title={`Aerial Imagery (${imgKeys.length} available images)`} icon={<ImageIcon size={18} color="#2243B6" />}>
                        {sessionToken ? (
                            <ImageGallery imageRefs={imgKeys} images={imgs} sessionToken={sessionToken} />
                        ) : (
                            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: '0.95rem', background: '#fafafa', borderRadius: 8 }}>
                                Authenticating secure image proxy…
                            </div>
                        )}
                    </Section>

                </div>
            </div>
        </div>
    );
}

