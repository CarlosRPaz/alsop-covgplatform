'use client';

import React, { useEffect, useState } from 'react';
import { X, MapPin, AlertTriangle, Image as ImageIcon, Home, CheckCircle2, XCircle, Droplets, Info } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface EagleViewReportModalProps {
    result: any;
    onClose: () => void;
}

export default function EagleViewReportModal({ result, onClose }: EagleViewReportModalProps) {
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    useEffect(() => {
        const getSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.access_token) {
                setSessionToken(data.session.access_token);
            }
        };
        getSession();
    }, []);

    if (!result || !result.data) return null;

    const { data, metadata } = result;
    const property = data.property || data; // Handle both wrapper formats
    const address = property.response_address?.full_address || property.input?.address?.completeAddress || 'Unknown Address';
    const coords = property.response_coordinates;

    const images = property.imagery || {};
    const imageRefs = property.property_images?.image_references || Object.keys(images);
    
    const structures = property.structures || [];
    const pool = property.pool || {};
    const trampoline = property.trampoline || {};

    const renderConfidenceBadge = (confidence: number) => {
        if (confidence === -1) return <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>Conf: N/A</span>;
        const color = confidence > 0.8 ? 'var(--status-success)' : confidence > 0.5 ? 'var(--status-warning)' : 'var(--status-error)';
        return <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: `${color}20`, color: color }}>Conf: {(confidence * 100).toFixed(0)}%</span>;
    };

    const renderBoolean = (val: string | null) => {
        if (!val || val === 'null' || val === 'unknown') return <span style={{ color: 'var(--text-muted)' }}>Unknown</span>;
        if (val.toLowerCase() === 'yes' || val.toLowerCase() === 'true') return <span style={{ color: 'var(--status-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> Yes</span>;
        return <span style={{ color: 'var(--status-error)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> No</span>;
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem'
        }}>
            <div style={{
                background: 'var(--bg-page)', width: '100%', maxWidth: '1200px', maxHeight: '90vh',
                borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid var(--border-default)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '1.25rem 1.5rem', background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-high)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Home size={20} style={{ color: 'var(--accent-primary)' }} />
                            Property Intelligence Report
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} /> {address}</span>
                            {coords && <span>Lat: {coords.lat.toFixed(5)}, Lon: {coords.lon.toFixed(5)}</span>}
                            <span>| Req ID: {metadata?.requestId?.split('-')[0]}...</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>
                    
                    {/* General Conditions */}
                    <section>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                            <Info size={16} style={{ color: 'var(--accent-primary)' }} /> General Property Conditions
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Driveway Condition</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-high)', textTransform: 'capitalize' }}>
                                    {property.property_driveway_condition_rating?.value || 'Unknown'}
                                </div>
                                {property.property_driveway_condition_rating?.confidence && renderConfidenceBadge(property.property_driveway_condition_rating.confidence)}
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Lawn Condition</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-high)', textTransform: 'capitalize' }}>
                                    {property.property_lawn_condition_rating?.value || 'Unknown'}
                                </div>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Fence Presence</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-high)', textTransform: 'capitalize' }}>
                                    {renderBoolean(property.property_fence_presence?.value)}
                                </div>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Yard Debris</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-high)', textTransform: 'capitalize' }}>
                                    {property.property_yard_debris?.coverage?.value > 0 ? 'Present' : 'Clear'}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Hazards */}
                    <section>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                            <AlertTriangle size={16} style={{ color: 'var(--status-warning)' }} /> Hazards & Liability Features
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Droplets size={14} style={{ color: '#3b82f6' }} /> Swimming Pool
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Presence:</span> {renderBoolean(pool.property_pool_presence?.value)}</div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Enclosure:</span> {renderBoolean(pool.property_pool_enclosure_presence?.value)}</div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Slide:</span> {renderBoolean(pool.property_pool_slide_presence?.value)}</div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>Condition:</span> <span style={{ textTransform: 'capitalize' }}>{pool.property_pool_condition_rating?.value || 'N/A'}</span></div>
                                </div>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Trampoline</h4>
                                <div style={{ fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Presence:</span> {renderBoolean(trampoline.property_trampoline_presence?.value)}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Structures & Roof */}
                    <section>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                            <Home size={16} style={{ color: 'var(--accent-primary)' }} /> Structures & Roof Intelligence
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {structures.map((struct: any, idx: number) => {
                                const roof = struct.roof || {};
                                return (
                                    <div key={idx} style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-high)' }}>Structure {idx + 1}</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shape</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500, textTransform: 'capitalize' }}>{roof.structure_roof_shape?.value || 'Unknown'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Material</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500, textTransform: 'capitalize' }}>{roof.structure_roof_material?.value || 'Unknown'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pitch</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{roof.structure_roof_predominant_pitch?.value || 'Unknown'} / 12</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Condition Rating</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500, textTransform: 'capitalize' }}>{roof.structure_roof_condition_rating?.value || 'Unknown'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staining Presence</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{renderBoolean(roof.structure_roof_staining_presence?.value)}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ponding Presence</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{renderBoolean(roof.structure_roof_pond_presence?.value)}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Solar Panels</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{renderBoolean(struct.solar?.structure_solar_panel_presence?.value)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Image Gallery */}
                    <section>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                            <ImageIcon size={16} style={{ color: 'var(--accent-primary)' }} /> Aerial Imagery
                        </h3>
                        {sessionToken ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                {imageRefs.map((imgRef: string) => {
                                    const imgData = images[imgRef];
                                    if (!imgData || !imgData.image_token) return null;
                                    
                                    const token = imgData.image_token;
                                    const meta = imgData.metadata || {};
                                    
                                    return (
                                        <div key={token} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                                            <div style={{ height: '200px', backgroundColor: 'var(--bg-page)', position: 'relative' }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img 
                                                    src={`/api/admin/integrations/eagleview/image/${token}?session=${sessionToken}`}
                                                    alt={`EagleView ${meta.view || ''}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    loading="lazy"
                                                />
                                            </div>
                                            <div style={{ padding: '0.75rem', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                                                <div><span style={{ color: 'var(--text-muted)' }}>View:</span> <span style={{ textTransform: 'capitalize' }}>{meta.view || 'N/A'}</span></div>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Direction:</span> <span style={{ textTransform: 'capitalize' }}>{meta.cardinal_direction || 'N/A'}</span></div>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Date:</span> {meta.shot_date || 'N/A'}</div>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Ref:</span> {imgRef}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                                Authenticating to load images...
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
}
