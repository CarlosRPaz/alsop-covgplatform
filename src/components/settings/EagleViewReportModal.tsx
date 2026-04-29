'use client';

import React, { useEffect, useState } from 'react';
import {
    X, MapPin, AlertTriangle, Image as ImageIcon, Home,
    CheckCircle2, XCircle, Droplets, Info, Maximize2,
    Clock, Hash, ChevronDown, ChevronRight, Compass
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface EagleViewReportModalProps {
    result: any;
    onClose: () => void;
}

/* ─── Helpers ──────────────────────────────────────────── */

function ConfidenceBadge({ confidence }: { confidence: number }) {
    if (confidence == null) return null;
    if (confidence === -1) {
        return (
            <span style={{
                fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                background: '#e2e2e2', color: '#777', fontWeight: 500
            }}>N/A</span>
        );
    }
    const pct = Math.round(confidence * 100);
    const color = pct >= 80 ? '#2B9B4B' : pct >= 50 ? '#FF9F00' : '#BF1932';
    return (
        <span style={{
            fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
            background: `${color}18`, color, fontWeight: 600
        }}>{pct}%</span>
    );
}

function BooleanValue({ value }: { value?: string | null }) {
    if (!value || value === 'null' || value === 'unknown') {
        return <span style={{ color: '#8b8b9e', fontSize: '0.8rem' }}>Unknown</span>;
    }
    const yes = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            color: yes ? '#2B9B4B' : '#BF1932', fontWeight: 500, fontSize: '0.8rem'
        }}>
            {yes ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {yes ? 'Yes' : 'No'}
        </span>
    );
}

function DataCard({ label, children, confidence }: { label: string; children: React.ReactNode; confidence?: number }) {
    return (
        <div style={{
            padding: '0.75rem', background: '#FAFAF7', borderRadius: '6px',
            border: '1px solid rgba(0,0,0,0.06)'
        }}>
            <div style={{
                fontSize: '0.65rem', color: '#8b8b9e', textTransform: 'uppercase',
                letterSpacing: '0.04em', fontWeight: 600, marginBottom: '0.3rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                {label}
                {confidence != null && <ConfidenceBadge confidence={confidence} />}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1a1a2e', textTransform: 'capitalize' }}>
                {children}
            </div>
        </div>
    );
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingBottom: '0.5rem',
            borderBottom: '2px solid rgba(0,0,0,0.04)'
        }}>
            <div style={{
                width: 28, height: 28, borderRadius: '6px',
                background: `${color}12`, display: 'flex',
                alignItems: 'center', justifyContent: 'center'
            }}>{icon}</div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{title}</h3>
        </div>
    );
}

/* ─── Image Card ──────────────────────────────────────── */

function ImageCard({ imgRef, imgData, sessionToken }: { imgRef: string; imgData: any; sessionToken: string }) {
    const [loaded, setLoaded] = useState(false);
    const [errored, setErrored] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const token = imgData.image_token;
    const meta = imgData.metadata || {};
    const src = `/api/admin/integrations/eagleview/image/${token}?session=${sessionToken}`;

    const viewLabel = meta.view === 'oblique' ? 'Oblique' : 'Ortho';
    const dirLabel = meta.cardinal_direction
        ? meta.cardinal_direction.charAt(0).toUpperCase() + meta.cardinal_direction.slice(1)
        : null;

    return (
        <>
            <div style={{
                background: '#FFFFFF', borderRadius: '8px', overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s',
            }}>
                {/* Image container */}
                <div
                    style={{
                        height: '180px', background: '#F0EDE5', position: 'relative',
                        cursor: 'pointer', overflow: 'hidden'
                    }}
                    onClick={() => setExpanded(true)}
                >
                    {!loaded && !errored && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            color: '#8b8b9e', fontSize: '0.75rem'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <ImageIcon size={20} style={{ marginBottom: '4px', opacity: 0.5 }} />
                                <div>Loading…</div>
                            </div>
                        </div>
                    )}
                    {errored && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            color: '#BF1932', fontSize: '0.7rem', background: '#fef2f2'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <AlertTriangle size={18} style={{ marginBottom: '4px' }} />
                                <div>Failed to load</div>
                            </div>
                        </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={`${viewLabel}${dirLabel ? ' — ' + dirLabel : ''}`}
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            display: loaded ? 'block' : 'none'
                        }}
                        onLoad={() => setLoaded(true)}
                        onError={() => setErrored(true)}
                        loading="lazy"
                    />
                    {/* Expand icon overlay */}
                    {loaded && (
                        <div style={{
                            position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)',
                            borderRadius: '4px', padding: '3px', color: '#fff', cursor: 'pointer'
                        }}>
                            <Maximize2 size={12} />
                        </div>
                    )}
                    {/* View type badge */}
                    <div style={{
                        position: 'absolute', bottom: 6, left: 6,
                        background: meta.view === 'oblique' ? 'rgba(34,67,182,0.85)' : 'rgba(0,0,0,0.6)',
                        color: '#fff', fontSize: '0.6rem', fontWeight: 600,
                        padding: '2px 6px', borderRadius: '4px',
                        textTransform: 'uppercase', letterSpacing: '0.04em'
                    }}>
                        {viewLabel}
                    </div>
                </div>

                {/* Metadata row */}
                <div style={{
                    padding: '0.5rem 0.6rem', fontSize: '0.7rem', color: '#5a5a72',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(0,0,0,0.04)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {dirLabel && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Compass size={11} /> {dirLabel}
                            </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} /> {meta.shot_date || 'N/A'}
                        </span>
                    </div>
                    <span style={{ color: '#8b8b9e', fontFamily: 'monospace', fontSize: '0.6rem' }}>{imgRef}</span>
                </div>
            </div>

            {/* Lightbox */}
            {expanded && (
                <div
                    onClick={() => setExpanded(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 99999,
                        background: 'rgba(0,0,0,0.85)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out'
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt="Expanded view"
                        style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '8px' }}
                    />
                    <button
                        onClick={() => setExpanded(false)}
                        style={{
                            position: 'absolute', top: 16, right: 16,
                            background: 'rgba(255,255,255,0.15)', border: 'none',
                            color: '#fff', borderRadius: '50%', width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '1.1rem'
                        }}
                    ><X size={18} /></button>
                </div>
            )}
        </>
    );
}

/* ─── Main Modal ──────────────────────────────────────── */

export default function EagleViewReportModal({ result, onClose }: EagleViewReportModalProps) {
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        conditions: true, hazards: true, structures: true, imagery: true
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data?.session?.access_token) setSessionToken(data.session.access_token);
        });
    }, []);

    // Prevent background scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!result?.data) return null;

    const { data, metadata } = result;
    const property = data.property || data;
    const address = property.response_address?.full_address || property.input?.address?.completeAddress || 'Unknown Address';
    const coords = property.response_coordinates;
    const images = property.imagery || {};
    const allImageKeys = Object.keys(images).sort((a, b) => {
        // Sort image_1, image_2, ... image_10, image_11 numerically
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    const imageRefs = allImageKeys.length > 0 ? allImageKeys : (property.property_images?.image_references || []);
    const structures = property.structures || [];
    const pool = property.pool || {};
    const trampoline = property.trampoline || {};

    const toggleSection = (key: string) =>
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    const SectionToggle = ({ id, title, icon, color, children }: {
        id: string; title: string; icon: React.ReactNode; color: string; children: React.ReactNode
    }) => {
        const open = expandedSections[id] !== false;
        return (
            <section style={{
                background: '#FFFFFF', borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
                <button
                    onClick={() => toggleSection(id)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        width: '100%', padding: '0.75rem 1rem', background: 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <div style={{
                        width: 28, height: 28, borderRadius: '6px',
                        background: `${color}12`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>{icon}</div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a2e', margin: 0, flex: 1 }}>{title}</h3>
                    {open ? <ChevronDown size={16} color="#8b8b9e" /> : <ChevronRight size={16} color="#8b8b9e" />}
                </button>
                {open && (
                    <div style={{ padding: '0 1rem 1rem 1rem' }}>
                        {children}
                    </div>
                )}
            </section>
        );
    };

    return (
        /* Overlay */
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 99990,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem'
            }}
        >
            {/* Modal container — solid white */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#F0EDE5', width: '100%', maxWidth: '1100px',
                    maxHeight: '92vh', borderRadius: '14px',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)',
                    overflow: 'hidden'
                }}
            >
                {/* ─── Header ─── */}
                <div style={{
                    padding: '1.25rem 1.5rem', background: '#FFFFFF',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    flexShrink: 0
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', margin: 0,
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '8px',
                                background: '#2243B612', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Home size={18} color="#2243B6" />
                            </div>
                            Property Intelligence Report
                        </h2>
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                            gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#5a5a72'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <MapPin size={13} color="#2243B6" /> {address}
                            </span>
                            {coords && (
                                <span style={{ color: '#8b8b9e' }}>
                                    {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                                </span>
                            )}
                            <span style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                color: '#8b8b9e', fontFamily: 'monospace', fontSize: '0.65rem'
                            }}>
                                <Hash size={11} /> {metadata?.requestId || 'N/A'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#F0EDE5', border: 'none',
                            color: '#5a5a72', cursor: 'pointer',
                            width: 32, height: 32, borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ─── Scrollable Content ─── */}
                <div style={{
                    padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1,
                    display: 'flex', flexDirection: 'column', gap: '1rem'
                }}>

                    {/* General Conditions */}
                    <SectionToggle id="conditions" title="General Property Conditions" icon={<Info size={15} color="#2243B6" />} color="#2243B6">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            <DataCard label="Driveway Condition" confidence={property.property_driveway_condition_rating?.confidence}>
                                {property.property_driveway_condition_rating?.value || 'Unknown'}
                            </DataCard>
                            <DataCard label="Lawn Condition" confidence={property.property_lawn_condition_rating?.confidence}>
                                {property.property_lawn_condition_rating?.value || 'Unknown'}
                            </DataCard>
                            <DataCard label="Fence Presence" confidence={property.property_fence_presence?.confidence}>
                                <BooleanValue value={property.property_fence_presence?.value} />
                            </DataCard>
                            <DataCard label="Fence Combustibility" confidence={property.property_fence_material_combustibility?.confidence}>
                                {property.property_fence_material_combustibility?.value || 'Unknown'}
                            </DataCard>
                            <DataCard label="Yard Debris Coverage">
                                {property.property_yard_debris?.coverage?.value != null
                                    ? `${(property.property_yard_debris.coverage.value * 100).toFixed(1)}%`
                                    : 'Unknown'}
                            </DataCard>
                            <DataCard label="Accessory Structure Roof" confidence={property.property_accessory_structure_roof_condition_rating?.confidence}>
                                {property.property_accessory_structure_roof_condition_rating?.value || 'Unknown'}
                            </DataCard>
                        </div>
                    </SectionToggle>

                    {/* Hazards & Liability */}
                    <SectionToggle id="hazards" title="Hazards & Liability Features" icon={<AlertTriangle size={15} color="#FF9F00" />} color="#FF9F00">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                            {/* Pool */}
                            <div style={{
                                padding: '0.75rem', background: '#FAFAF7', borderRadius: '8px',
                                border: '1px solid rgba(0,0,0,0.06)'
                            }}>
                                <div style={{
                                    fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.6rem',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1a1a2e'
                                }}>
                                    <Droplets size={14} color="#3b82f6" /> Swimming Pool
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                                    <div>
                                        <span style={{ color: '#8b8b9e', fontSize: '0.65rem', display: 'block' }}>Presence</span>
                                        <BooleanValue value={pool.property_pool_presence?.value} />
                                    </div>
                                    <div>
                                        <span style={{ color: '#8b8b9e', fontSize: '0.65rem', display: 'block' }}>Enclosure</span>
                                        <BooleanValue value={pool.property_pool_enclosure_presence?.value} />
                                    </div>
                                    <div>
                                        <span style={{ color: '#8b8b9e', fontSize: '0.65rem', display: 'block' }}>Slide</span>
                                        <BooleanValue value={pool.property_pool_slide_presence?.value} />
                                    </div>
                                    <div>
                                        <span style={{ color: '#8b8b9e', fontSize: '0.65rem', display: 'block' }}>Condition</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '0.8rem' }}>
                                            {pool.property_pool_condition_rating?.value || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Trampoline */}
                            <div style={{
                                padding: '0.75rem', background: '#FAFAF7', borderRadius: '8px',
                                border: '1px solid rgba(0,0,0,0.06)'
                            }}>
                                <div style={{
                                    fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.6rem',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1a1a2e'
                                }}>
                                    <AlertTriangle size={14} color="#FF9F00" /> Trampoline
                                </div>
                                <div>
                                    <span style={{ color: '#8b8b9e', fontSize: '0.65rem', display: 'block' }}>Presence</span>
                                    <BooleanValue value={trampoline.property_trampoline_presence?.value} />
                                </div>
                            </div>
                        </div>
                    </SectionToggle>

                    {/* Structures & Roof */}
                    <SectionToggle id="structures" title={`Structures & Roof Intelligence (${structures.length})`} icon={<Home size={15} color="#5A3E85" />} color="#5A3E85">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {structures.map((struct: any, idx: number) => {
                                const roof = struct.roof || {};
                                return (
                                    <div key={idx} style={{
                                        padding: '1rem', background: '#FAFAF7', borderRadius: '8px',
                                        border: '1px solid rgba(0,0,0,0.06)'
                                    }}>
                                        <div style={{
                                            fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem',
                                            color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '0.4rem'
                                        }}>
                                            <Home size={14} color="#5A3E85" />
                                            Structure {idx + 1}
                                            {struct.structure_images?.image_references?.length > 0 && (
                                                <span style={{
                                                    fontSize: '0.6rem', color: '#8b8b9e', fontWeight: 400, marginLeft: '0.5rem'
                                                }}>
                                                    ({struct.structure_images.image_references.length} images)
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
                                            <DataCard label="Shape" confidence={roof.structure_roof_shape?.confidence}>
                                                {roof.structure_roof_shape?.value || 'Unknown'}
                                            </DataCard>
                                            <DataCard label="Material" confidence={roof.structure_roof_material?.confidence}>
                                                {roof.structure_roof_material?.value || 'Unknown'}
                                            </DataCard>
                                            <DataCard label="Pitch" confidence={roof.structure_roof_predominant_pitch?.confidence}>
                                                {roof.structure_roof_predominant_pitch?.value != null
                                                    ? `${roof.structure_roof_predominant_pitch.value} / 12`
                                                    : 'Unknown'}
                                            </DataCard>
                                            <DataCard label="Condition" confidence={roof.structure_roof_condition_rating?.confidence}>
                                                {roof.structure_roof_condition_rating?.value || 'Unknown'}
                                            </DataCard>
                                            <DataCard label="Staining" confidence={roof.structure_roof_staining_presence?.confidence}>
                                                <BooleanValue value={roof.structure_roof_staining_presence?.value} />
                                            </DataCard>
                                            <DataCard label="Ponding" confidence={roof.structure_roof_pond_presence?.confidence}>
                                                <BooleanValue value={roof.structure_roof_pond_presence?.value} />
                                            </DataCard>
                                            <DataCard label="Solar Panels" confidence={struct.solar?.structure_solar_panel_presence?.confidence}>
                                                <BooleanValue value={struct.solar?.structure_solar_panel_presence?.value} />
                                            </DataCard>
                                        </div>
                                    </div>
                                );
                            })}
                            {structures.length === 0 && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#8b8b9e', fontSize: '0.8rem' }}>
                                    No structures detected.
                                </div>
                            )}
                        </div>
                    </SectionToggle>

                    {/* Imagery Gallery */}
                    <SectionToggle
                        id="imagery"
                        title={`Aerial Imagery (${imageRefs.length} images)`}
                        icon={<ImageIcon size={15} color="#2243B6" />}
                        color="#2243B6"
                    >
                        {sessionToken ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
                                {imageRefs.map((imgRef: string) => {
                                    const imgData = images[imgRef];
                                    if (!imgData?.image_token) return null;
                                    return (
                                        <ImageCard
                                            key={imgData.image_token}
                                            imgRef={imgRef}
                                            imgData={imgData}
                                            sessionToken={sessionToken}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{
                                padding: '2rem', textAlign: 'center', color: '#8b8b9e',
                                background: '#FAFAF7', borderRadius: '8px', fontSize: '0.8rem'
                            }}>
                                Authenticating to load images…
                            </div>
                        )}
                    </SectionToggle>

                </div>
            </div>
        </div>
    );
}
