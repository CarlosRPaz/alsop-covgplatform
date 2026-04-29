'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    X, MapPin, AlertTriangle, Image as ImageIcon, Home,
    CheckCircle2, XCircle, Droplets, Info, Maximize2,
    Clock, Hash, Compass, ChevronDown, ChevronRight, Wind, Shield
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface EagleViewReportModalProps { result: any; onClose: () => void; }

/* ── Helpers ── */

function ConfBadge({ v }: { v?: number }) {
    if (v == null) return null;
    if (v === -1) return <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: '#eee', color: '#999', fontWeight: 600 }}>N/A</span>;
    const p = Math.round(v * 100);
    const c = p >= 80 ? '#2B9B4B' : p >= 50 ? '#FF9F00' : '#BF1932';
    return <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: `${c}12`, color: c, fontWeight: 600 }}>{p}%</span>;
}

function BoolVal({ v }: { v?: string | null | boolean }) {
    if (v == null || String(v) === 'null' || String(v) === 'unknown') return <span style={{ color: '#aaa' }}>—</span>;
    const yes = String(v).toLowerCase() === 'yes' || String(v).toLowerCase() === 'true';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: yes ? '#2B9B4B' : '#BF1932', fontWeight: 600, fontSize: '0.8rem' }}>
            {yes ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {yes ? 'Yes' : 'No'}
        </span>
    );
}

/* ── Table row ── */
function Row({ label, value, conf, children }: { label: string; value?: React.ReactNode; conf?: number; children?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', gap: 8, minHeight: 32 }}>
            <span style={{ width: 180, minWidth: 180, fontSize: '0.75rem', color: '#8b8b9e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>{label}</span>
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500, color: '#1a1a2e', textTransform: 'capitalize' }}>{children || value || '—'}</span>
            {conf != null && <ConfBadge v={conf} />}
        </div>
    );
}

/* ── Section ── */
function Section({ title, icon, defaultOpen = true, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px',
                background: open ? '#fafafa' : '#fff', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
            }}>
                {icon}
                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'left' }}>{title}</span>
                {open ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />}
            </button>
            {open && <div style={{ padding: '8px 16px 14px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>{children}</div>}
        </div>
    );
}

/* ── Sub-heading inside sections ── */
function SubHead({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
    return (
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5, padding: '10px 0 4px', borderBottom: '2px solid ' + color + '20' }}>
            {icon} {children}
        </div>
    );
}

/* ── Image card ── */
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
            <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 160, background: '#F0EDE5', position: 'relative', cursor: state === 'loaded' ? 'zoom-in' : 'default', overflow: 'hidden' }}
                    onClick={() => state === 'loaded' && setExpanded(true)}>
                    {state === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.7rem' }}><div style={{ textAlign: 'center' }}><ImageIcon size={20} style={{ opacity: 0.4, marginBottom: 4 }} /><div>Loading…</div></div></div>}
                    {state === 'error' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF1932', fontSize: '0.7rem', background: '#fef2f2' }}><div style={{ textAlign: 'center' }}><AlertTriangle size={18} style={{ marginBottom: 4 }} /><div>Failed</div></div></div>}
                    {state !== 'error' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={`${view}${dir ? ' — ' + dir : ''}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'loaded' ? 'block' : 'none' }}
                            onLoad={() => setState('loaded')} onError={() => setState('error')} />
                    )}
                    {state === 'loaded' && <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 4, color: '#fff' }}><Maximize2 size={12} /></div>}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: meta.view === 'oblique' ? 'rgba(34,67,182,0.9)' : 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase' }}>{view}</div>
                </div>
                <div style={{ padding: '5px 10px', fontSize: '0.65rem', color: '#666', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ display: 'flex', gap: 10 }}>
                        {dir && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Compass size={10} /> {dir}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {meta.shot_date || '—'}</span>
                    </span>
                    <span style={{ color: '#bbb', fontFamily: 'monospace', fontSize: '0.6rem' }}>{imgRef}</span>
                </div>
            </div>
            {expanded && (
                <div onClick={() => setExpanded(false)} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Full" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 8 }} />
                    <button onClick={() => setExpanded(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20} /></button>
                </div>
            )}
        </>
    );
}

/* ── Paginated gallery ── */
function ImageGallery({ imageRefs, images, sessionToken }: { imageRefs: string[]; images: any; sessionToken: string }) {
    const PAGE = 12;
    const [page, setPage] = useState(0);
    const total = Math.ceil(imageRefs.length / PAGE);
    const slice = imageRefs.slice(page * PAGE, (page + 1) * PAGE);
    const btn = (active: boolean): React.CSSProperties => ({ fontSize: '0.8rem', padding: '6px 14px', borderRadius: 6, border: '1px solid', borderColor: active ? '#2243B6' : '#ddd', background: active ? '#fff' : '#f5f5f5', color: active ? '#2243B6' : '#aaa', cursor: active ? 'pointer' : 'default', fontWeight: 600 });
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {slice.map(ref => { const d = images[ref]; if (!d?.image_token) return null; return <ImgCard key={d.image_token} imgRef={ref} imgData={d} sessionToken={sessionToken} />; })}
            </div>
            {total > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 16 }}>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={btn(page > 0)}>← Prev</button>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Page {page + 1}/{total} <span style={{ color: '#aaa' }}>({imageRefs.length} images)</span></span>
                    <button disabled={page >= total - 1} onClick={() => setPage(p => p + 1)} style={btn(page < total - 1)}>Next →</button>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════ */
/* ── Main Modal ── */
/* ══════════════════════════════════════════ */

export default function EagleViewReportModal({ result, onClose }: EagleViewReportModalProps) {
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data?.session?.access_token) setSessionToken(data.session.access_token); }); }, []);
    useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
    const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
    useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

    if (!result?.data) return null;
    const { data, metadata } = result;
    const d = data.property || data;
    const addr = d.response_address?.full_address || d.input?.address?.completeAddress || 'Unknown';
    const co = d.response_coordinates;
    const imgs = d.imagery || {};
    const imgKeys = Object.keys(imgs).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));
    const structs = d.structures || [];
    const pool = d.pool || {};
    const tramp = d.trampoline || {};

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#F8F7F4', width: '100%', maxWidth: 1100, height: '94vh', borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>

                {/* Header */}
                <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, borderRadius: '14px 14px 0 0' }}>
                    <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1a1a2e', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Home size={20} color="#2243B6" /> Property Intelligence Report
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6, fontSize: '0.78rem', color: '#666' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}><MapPin size={13} color="#2243B6" /> {addr}</span>
                            {co && <span style={{ color: '#888' }}>{co.lat.toFixed(5)}, {co.lon.toFixed(5)}</span>}
                            {metadata?.requestId && <span style={{ color: '#bbb', fontFamily: 'monospace', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 3 }}><Hash size={10} /> {metadata.requestId}</span>}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f1f1', border: 'none', color: '#555', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>

                {/* Scrollable body */}
                <div style={{ padding: '16px 20px', overflowY: 'scroll', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* General Property Details */}
                    <Section title="General Property Details" icon={<Info size={16} color="#2243B6" />}>
                        <Row label="Driveway Condition" value={d.property_driveway_condition_rating?.value} conf={d.property_driveway_condition_rating?.confidence} />
                        <Row label="Lawn Condition" value={d.property_lawn_condition_rating?.value} conf={d.property_lawn_condition_rating?.confidence} />
                        <Row label="Fence Presence" conf={d.property_fence_presence?.confidence}><BoolVal v={d.property_fence_presence?.value} /></Row>
                        <Row label="Fence Combustibility" value={d.property_fence_material_combustibility?.value} conf={d.property_fence_material_combustibility?.confidence} />
                        <Row label="Yard Debris (Coverage)" value={d.property_yard_debris?.area?.value != null ? `${d.property_yard_debris.area.value}%` : undefined} />
                        <Row label="Yard Debris (Area)" value={d.property_yard_debris?.coverage?.value != null ? `${d.property_yard_debris.coverage.value} sqft` : undefined} />
                        <Row label="Accessory Struct. Roof" value={d.property_accessory_structure_roof_condition_rating?.value} conf={d.property_accessory_structure_roof_condition_rating?.confidence} />
                    </Section>

                    {/* Hazards */}
                    <Section title="Hazards & Liability Features" icon={<AlertTriangle size={16} color="#FF9F00" />}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                            <div>
                                <SubHead icon={<Droplets size={13} />} color="#3b82f6">Swimming Pool</SubHead>
                                <Row label="Presence" conf={pool.property_pool_presence?.confidence}><BoolVal v={pool.property_pool_presence?.value} /></Row>
                                <Row label="Enclosure" conf={pool.property_pool_enclosure_presence?.confidence}><BoolVal v={pool.property_pool_enclosure_presence?.value} /></Row>
                                <Row label="Slide"><BoolVal v={pool.property_pool_slide_presence?.value} /></Row>
                                <Row label="Condition" value={pool.property_pool_condition_rating?.value} />
                                <Row label="Type" value={pool.property_pool_structure_type?.value} />
                                <Row label="Occlusion" value={pool.property_pool_occlusion_classification?.value} />
                            </div>
                            <div>
                                <SubHead icon={<AlertTriangle size={13} />} color="#FF9F00">Trampoline</SubHead>
                                <Row label="Presence" conf={tramp.property_trampoline_presence?.confidence}><BoolVal v={tramp.property_trampoline_presence?.value} /></Row>
                            </div>
                        </div>
                    </Section>

                    {/* Structures */}
                    <Section title={`Structures & Roof Intelligence (${structs.length})`} icon={<Home size={16} color="#5A3E85" />}>
                        {structs.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>No structures detected.</div>}
                        {structs.map((s: any, i: number) => {
                            const r = s.roof || {};
                            const cond = r.structure_roof_condition_elements || {};
                            return (
                                <div key={i} style={{ marginBottom: i < structs.length - 1 ? 20 : 0 }}>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a1a2e', padding: '8px 0', borderBottom: '2px solid #eee', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Structure {i + 1}</span>
                                        {s.structure_images?.image_references?.length > 0 && <span style={{ fontSize: '0.6rem', background: '#eef2ff', color: '#4f46e5', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>{s.structure_images.image_references.length} linked images</span>}
                                    </div>

                                    <SubHead icon={<Home size={12} />} color="#5A3E85">Dimensions & Details</SubHead>
                                    <Row label="Footprint" value={s.structure_footprint_sqft?.value != null ? `${s.structure_footprint_sqft.value} sqft` : undefined} conf={s.structure_footprint_sqft?.confidence} />
                                    <Row label="Eave Height" conf={s.structure_eave_height?.confidence}>{s.structure_eave_height?.value ? Object.entries(s.structure_eave_height.value).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${v}ft`).join(', ') || '—' : '—'}</Row>
                                    <Row label="Wood Deck" conf={s.structure_wood_deck_presence?.confidence}><BoolVal v={s.structure_wood_deck_presence?.value} /></Row>
                                    <Row label="Chimney" conf={s.structure_chimney_presence?.confidence}><BoolVal v={s.structure_chimney_presence?.value} /></Row>
                                    <Row label="Centroid">{s.structure_centroid ? `${s.structure_centroid.lat.toFixed(5)}, ${s.structure_centroid.lon.toFixed(5)}` : '—'}</Row>

                                    <SubHead icon={<Shield size={12} />} color="#FF9F00">Risk & Environment</SubHead>
                                    <Row label="Wildfire Mitigation" value={s.structure_wildfire_mitigation_rating?.value} conf={s.structure_wildfire_mitigation_rating?.confidence} />
                                    <Row label="Wildfire Vulnerability" value={s.structure_wildfire_vulnerability_rating?.value} conf={s.structure_wildfire_vulnerability_rating?.confidence} />
                                    <Row label="Hail Vulnerability" value={s.structure_hail_vulnerability_rating?.value} conf={s.structure_hail_vulnerability_rating?.confidence} />
                                    <Row label="Hail Loss Severity" value={s.structure_hail_loss_severity_rating?.value} conf={s.structure_hail_loss_severity_rating?.confidence} />
                                    <Row label="Structure Density Z1/Z2">{(s.structure_density_zones?.structure_density_zone_1?.value ?? '—') + ' / ' + (s.structure_density_zones?.structure_density_zone_2?.value ?? '—')}</Row>
                                    <Row label="Vegetation Z1/Z2/Z3">{[s.vegetation_coverage_zones?.vegetation_coverage_zone_1?.value, s.vegetation_coverage_zones?.vegetation_coverage_zone_2?.value, s.vegetation_coverage_zones?.vegetation_coverage_zone_3?.value].map(v => v ?? '—').join(' / ')}</Row>
                                    <Row label="Veg. Setback" value={s.structure_vegetation_setback?.vegetation_setback?.value != null ? `${s.structure_vegetation_setback.vegetation_setback.value} ft` : undefined} conf={s.structure_vegetation_setback?.vegetation_setback?.confidence} />
                                    <Row label="Structure Setback" value={s.structure_setback?.value != null ? `${s.structure_setback.value} ft` : undefined} conf={s.structure_setback?.confidence} />

                                    <SubHead icon={<Wind size={12} />} color="#2B9B4B">Roof Specifications</SubHead>
                                    <Row label="Shape" value={r.structure_roof_shape?.value} conf={r.structure_roof_shape?.confidence} />
                                    <Row label="Primary Material" value={r.structure_roof_material_primary?.value} conf={r.structure_roof_material_primary?.confidence} />
                                    <Row label="Pitch" value={r.structure_roof_predominant_pitch?.value != null ? `${r.structure_roof_predominant_pitch.value}/12` : undefined} conf={r.structure_roof_predominant_pitch?.confidence} />
                                    <Row label="Condition Rating" value={r.structure_roof_condition_rating?.value} conf={r.structure_roof_condition_rating?.confidence} />
                                    <Row label="Area" value={r.structure_roof_area?.value != null ? `${r.structure_roof_area.value} sqft` : undefined} conf={r.structure_roof_area?.confidence} />
                                    <Row label="Squares" value={r.structure_roof_area_squares?.value} conf={r.structure_roof_area_squares?.confidence} />
                                    <Row label="Est. Age" value={r.structure_roof_age?.value != null ? `${r.structure_roof_age.value} yrs` : undefined} conf={r.structure_roof_age?.confidence} />
                                    <Row label="Facet Count" value={r.structure_roof_facet_count?.value} conf={r.structure_roof_facet_count?.confidence} />
                                    <Row label="Tree Overhang" value={r.structure_tree_overhang_classification?.value?.replace(/_/g, ' ')} conf={r.structure_tree_overhang_classification?.confidence} />
                                    <Row label="Solar Panels" conf={r.structure_roof_solar_panel_presence?.confidence}><BoolVal v={r.structure_roof_solar_panel_presence?.value} /></Row>
                                    <Row label="Roof Extension" conf={r.structure_roof_extension?.confidence}><BoolVal v={r.structure_roof_extension?.value} /></Row>
                                    <Row label="AC Units" value={r.structure_roof_air_conditioner_count?.value ?? '0'} />
                                    <Row label="Evap. Coolers" value={r.structure_roof_evaporative_cooler_count?.value ?? '0'} />

                                    <SubHead icon={<AlertTriangle size={12} />} color="#BF1932">Roof Condition Anomalies</SubHead>
                                    <Row label="Ponding" conf={cond.structure_roof_ponding?.confidence}><BoolVal v={cond.structure_roof_ponding?.value} /></Row>
                                    <Row label="Tarp" conf={cond.structure_roof_tarp?.confidence}><BoolVal v={cond.structure_roof_tarp?.value} /></Row>
                                    <Row label="Patching" conf={cond.structure_roof_patching?.confidence}><BoolVal v={cond.structure_roof_patching?.value} /></Row>
                                    <Row label="Streaking" value={cond.structure_roof_streaking?.value?.replace(/_/g, ' ')} conf={cond.structure_roof_streaking?.confidence} />
                                    <Row label="Degradation" value={cond.structure_roof_material_degradation?.value?.replace(/_/g, ' ')} conf={cond.structure_roof_material_degradation?.confidence} />
                                    <Row label="Discoloration" value={cond.structure_roof_natural_discoloration?.value?.replace(/_/g, ' ')} conf={cond.structure_roof_natural_discoloration?.confidence} />
                                    <Row label="Occlusion" value={r.structure_roof_occlusion_classification?.value?.replace(/_/g, ' ')} conf={r.structure_roof_occlusion_classification?.confidence} />
                                </div>
                            );
                        })}
                    </Section>

                    {/* Imagery */}
                    <Section title={`Aerial Imagery (${imgKeys.length} images)`} icon={<ImageIcon size={16} color="#2243B6" />}>
                        {sessionToken ? (
                            <ImageGallery imageRefs={imgKeys} images={imgs} sessionToken={sessionToken} />
                        ) : (
                            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Authenticating…</div>
                        )}
                    </Section>

                    </div>
                </div>
            </div>
        </div>
    );
}
