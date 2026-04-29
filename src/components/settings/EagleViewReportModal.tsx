'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    X, MapPin, AlertTriangle, Image as ImageIcon, Home,
    CheckCircle2, XCircle, Droplets, Info, Maximize2,
    Clock, Hash, Compass, ChevronDown, ChevronRight
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
            fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
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

function BoolVal({ v }: { v?: string | null }) {
    if (!v || v === 'null' || v === 'unknown')
        return <span style={{ color: '#8b8b9e', fontSize: '0.82rem' }}>—</span>;
    const yes = v.toLowerCase() === 'yes' || v.toLowerCase() === 'true';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: yes ? '#2B9B4B' : '#BF1932', fontWeight: 500, fontSize: '0.82rem' }}>
            {yes ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {yes ? 'Yes' : 'No'}
        </span>
    );
}

/* ─── Stat card ───────────────────────────────────── */

function Stat({ label, children, conf }: { label: string; children: React.ReactNode; conf?: number }) {
    return (
        <div style={{
            padding: '10px 12px', background: '#FAFAF7', borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.05)',
        }}>
            <div style={{
                fontSize: '0.6rem', color: '#8b8b9e', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                {label} <ConfBadge v={conf} />
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1a1a2e', textTransform: 'capitalize' }}>
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
            background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                }}
            >
                {icon}
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'left' }}>{title}</span>
                {open ? <ChevronDown size={15} color="#999" /> : <ChevronRight size={15} color="#999" />}
            </button>
            {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
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

    // Only start loading when the card mounts (we control how many mount at once)
    useEffect(() => { setState('loading'); }, []);

    return (
        <>
            <div style={{
                background: '#fff', borderRadius: 8, overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}>
                <div
                    style={{ height: 160, background: '#F0EDE5', position: 'relative', cursor: state === 'loaded' ? 'pointer' : 'default', overflow: 'hidden' }}
                    onClick={() => state === 'loaded' && setExpanded(true)}
                >
                    {state === 'loading' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.7rem' }}>
                            <div style={{ textAlign: 'center' }}><ImageIcon size={18} style={{ opacity: 0.4, marginBottom: 3 }} /><div>Loading…</div></div>
                        </div>
                    )}
                    {state === 'error' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF1932', fontSize: '0.7rem', background: '#fef2f2' }}>
                            <div style={{ textAlign: 'center' }}><AlertTriangle size={16} style={{ marginBottom: 3 }} /><div>Failed</div></div>
                        </div>
                    )}
                    {state !== 'error' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={src} alt={`${view}${dir ? ' — ' + dir : ''}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'loaded' ? 'block' : 'none' }}
                            onLoad={() => setState('loaded')}
                            onError={() => setState('error')}
                        />
                    )}
                    {state === 'loaded' && (
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: 3, color: '#fff' }}>
                            <Maximize2 size={11} />
                        </div>
                    )}
                    <div style={{
                        position: 'absolute', bottom: 5, left: 5,
                        background: meta.view === 'oblique' ? 'rgba(34,67,182,0.85)' : 'rgba(0,0,0,0.55)',
                        color: '#fff', fontSize: '0.55rem', fontWeight: 700, padding: '2px 5px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{view}</div>
                </div>
                <div style={{ padding: '6px 8px', fontSize: '0.65rem', color: '#666', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ display: 'flex', gap: 8 }}>
                        {dir && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Compass size={10} /> {dir}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={10} /> {meta.shot_date || '—'}</span>
                    </span>
                    <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.58rem' }}>{imgRef}</span>
                </div>
            </div>

            {/* Lightbox */}
            {expanded && (
                <div onClick={() => setExpanded(false)} style={{
                    position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.88)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Full" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 6 }} />
                    <button onClick={() => setExpanded(false)} style={{
                        position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.15)',
                        border: 'none', color: '#fff', borderRadius: '50%', width: 34, height: 34,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}><X size={16} /></button>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
                {slice.map(ref => {
                    const d = images[ref];
                    if (!d?.image_token) return null;
                    return <ImgCard key={d.image_token} imgRef={ref} imgData={d} sessionToken={sessionToken} />;
                })}
            </div>
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={pgBtn(page > 0)}>← Prev</button>
                    <span style={{ fontSize: '0.75rem', color: '#666', padding: '6px 0' }}>
                        Page {page + 1} of {totalPages} ({imageRefs.length} images)
                    </span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtn(page < totalPages - 1)}>Next →</button>
                </div>
            )}
        </div>
    );
}
function pgBtn(active: boolean): React.CSSProperties {
    return {
        fontSize: '0.72rem', padding: '5px 12px', borderRadius: 5,
        border: '1px solid rgba(0,0,0,0.08)', background: active ? '#fff' : '#f5f5f5',
        color: active ? '#2243B6' : '#bbb', cursor: active ? 'pointer' : 'default', fontWeight: 600,
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
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#F0EDE5', width: '100%', maxWidth: 1060, maxHeight: '92vh',
                borderRadius: 14, display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden',
            }}>
                {/* ─ Header ─ */}
                <div style={{
                    padding: '16px 20px', background: '#fff',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Home size={18} color="#2243B6" /> Property Intelligence Report
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: '0.72rem', color: '#666' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}><MapPin size={12} color="#2243B6" /> {addr}</span>
                            {co && <span style={{ color: '#999' }}>{co.lat.toFixed(5)}, {co.lon.toFixed(5)}</span>}
                            {metadata?.requestId && (
                                <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Hash size={10} /> {metadata.requestId}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#F0EDE5', border: 'none', color: '#666', cursor: 'pointer',
                        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><X size={16} /></button>
                </div>

                {/* ─ Scrollable body ─ */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* General Conditions */}
                    <Section title="General Property Conditions" icon={<Info size={15} color="#2243B6" />}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                            <Stat label="Driveway" conf={d.property_driveway_condition_rating?.confidence}>
                                {d.property_driveway_condition_rating?.value || '—'}
                            </Stat>
                            <Stat label="Lawn" conf={d.property_lawn_condition_rating?.confidence}>
                                {d.property_lawn_condition_rating?.value || '—'}
                            </Stat>
                            <Stat label="Fence" conf={d.property_fence_presence?.confidence}>
                                <BoolVal v={d.property_fence_presence?.value} />
                            </Stat>
                            <Stat label="Fence Combustibility" conf={d.property_fence_material_combustibility?.confidence}>
                                {d.property_fence_material_combustibility?.value || '—'}
                            </Stat>
                            <Stat label="Yard Debris">
                                {d.property_yard_debris?.coverage?.value != null
                                    ? `${(d.property_yard_debris.coverage.value * 100).toFixed(1)}%` : '—'}
                            </Stat>
                            <Stat label="Acc. Structure Roof" conf={d.property_accessory_structure_roof_condition_rating?.confidence}>
                                {d.property_accessory_structure_roof_condition_rating?.value || '—'}
                            </Stat>
                        </div>
                    </Section>

                    {/* Hazards */}
                    <Section title="Hazards & Liability" icon={<AlertTriangle size={15} color="#FF9F00" />}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                            <div style={{ padding: 10, background: '#FAFAF7', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Droplets size={13} color="#3b82f6" /> Swimming Pool
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                                    <div><span style={{ color: '#999', fontSize: '0.62rem', display: 'block' }}>Presence</span><BoolVal v={pool.property_pool_presence?.value} /></div>
                                    <div><span style={{ color: '#999', fontSize: '0.62rem', display: 'block' }}>Enclosure</span><BoolVal v={pool.property_pool_enclosure_presence?.value} /></div>
                                    <div><span style={{ color: '#999', fontSize: '0.62rem', display: 'block' }}>Slide</span><BoolVal v={pool.property_pool_slide_presence?.value} /></div>
                                    <div><span style={{ color: '#999', fontSize: '0.62rem', display: 'block' }}>Condition</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{pool.property_pool_condition_rating?.value || '—'}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: 10, background: '#FAFAF7', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <AlertTriangle size={13} color="#FF9F00" /> Trampoline
                                </div>
                                <div><span style={{ color: '#999', fontSize: '0.62rem', display: 'block' }}>Presence</span><BoolVal v={tramp.property_trampoline_presence?.value} /></div>
                            </div>
                        </div>
                    </Section>

                    {/* Structures */}
                    <Section title={`Structures & Roof (${structs.length})`} icon={<Home size={15} color="#5A3E85" />}>
                        {structs.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#999', fontSize: '0.78rem' }}>No structures detected.</div>}
                        {structs.map((s: any, i: number) => {
                            const r = s.roof || {};
                            return (
                                <div key={i} style={{ padding: 12, background: '#FAFAF7', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', marginBottom: i < structs.length - 1 ? 8 : 0 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: '#1a1a2e' }}>
                                        Structure {i + 1}
                                        {s.structure_images?.image_references?.length > 0 && (
                                            <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 400, marginLeft: 6 }}>
                                                ({s.structure_images.image_references.length} images)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                                        <Stat label="Shape" conf={r.structure_roof_shape?.confidence}>{r.structure_roof_shape?.value || '—'}</Stat>
                                        <Stat label="Material" conf={r.structure_roof_material?.confidence}>{r.structure_roof_material?.value || '—'}</Stat>
                                        <Stat label="Pitch" conf={r.structure_roof_predominant_pitch?.confidence}>
                                            {r.structure_roof_predominant_pitch?.value != null ? `${r.structure_roof_predominant_pitch.value}/12` : '—'}
                                        </Stat>
                                        <Stat label="Condition" conf={r.structure_roof_condition_rating?.confidence}>{r.structure_roof_condition_rating?.value || '—'}</Stat>
                                        <Stat label="Staining" conf={r.structure_roof_staining_presence?.confidence}><BoolVal v={r.structure_roof_staining_presence?.value} /></Stat>
                                        <Stat label="Ponding" conf={r.structure_roof_pond_presence?.confidence}><BoolVal v={r.structure_roof_pond_presence?.value} /></Stat>
                                        <Stat label="Solar" conf={s.solar?.structure_solar_panel_presence?.confidence}><BoolVal v={s.solar?.structure_solar_panel_presence?.value} /></Stat>
                                    </div>
                                </div>
                            );
                        })}
                    </Section>

                    {/* Imagery */}
                    <Section title={`Aerial Imagery (${imgKeys.length} images)`} icon={<ImageIcon size={15} color="#2243B6" />}>
                        {sessionToken ? (
                            <ImageGallery imageRefs={imgKeys} images={imgs} sessionToken={sessionToken} />
                        ) : (
                            <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: '0.78rem' }}>
                                Authenticating…
                            </div>
                        )}
                    </Section>

                </div>
            </div>
        </div>
    );
}
