'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Search, Satellite, Code, LayoutDashboard, Copy, Check, MapPin, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast/Toast';

const SAMPLE_ADDRESSES = [
    { label: 'Sample 1 - Omaha NE (Valid Sandbox Bounds)', value: '4220 BARKER AVE, OMAHA, NE 68105' },
    { label: 'Sample 2 - Omaha NE (Valid Sandbox Bounds)', value: '822 S 49TH ST, OMAHA, NE 68106' },
    { label: 'Sample 3 - Omaha NE (Valid Sandbox Bounds)', value: '5157 JONES ST, OMAHA, NE 68106' },
];

export default function EagleViewSandboxSection() {
    const [loadingAddr, setLoadingAddr] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
    const [copied, setCopied] = useState(false);
    const toast = useToast();

    const handleFetch = async (addrToFetch: string) => {
        setLoadingAddr(addrToFetch);
        setError(null);
        setResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const res = await fetch('/api/admin/integrations/eagleview/property-data-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ address: addrToFetch })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setResult(data.payload);
            } else {
                setError(data.message || 'Unknown error occurred');
                if (data.details) {
                    console.error('EagleView API Error Details:', data.details);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setLoadingAddr(null);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper to render nested objects in the Attribute Explorer
    const renderAttributes = (obj: any, depth = 0) => {
        if (!obj || typeof obj !== 'object') {
            return <span style={{ color: 'var(--text-high)' }}>{String(obj)}</span>;
        }
        
        if (Array.isArray(obj)) {
            return (
                <div style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
                    {obj.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Empty array</span> : null}
                    {obj.map((item, i) => (
                        <div key={i} style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.5rem' }}>[{i}]</span>
                            {renderAttributes(item, depth + 1)}
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
                {Object.entries(obj).map(([key, val]) => (
                    <div key={key} style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)', marginRight: '0.5rem' }}>{key}:</span>
                        {typeof val === 'object' && val !== null ? (
                            <div style={{ marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-default)' }}>
                                {renderAttributes(val, depth + 1)}
                            </div>
                        ) : (
                            <span style={{ color: 'var(--text-high)' }}>{String(val)}</span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Satellite size={20} style={{ color: 'var(--accent-primary)' }} />
                    EagleView Sandbox Test Panel
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Query the EagleView Property Data API (Sandbox) directly. This tool is fully isolated and will not modify any production policy or client records.
                </p>
                
                <div style={{ 
                    marginTop: '0.75rem', padding: '0.5rem 0.75rem', 
                    background: 'var(--bg-warning-subtle)', border: '1px solid var(--border-default)', 
                    borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-mid)',
                    display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
                }}>
                    <AlertCircle size={14} style={{ color: '#fbbf24', marginTop: '2px', flexShrink: 0 }} />
                    <span>The EagleView Sandbox is restricted to specific test addresses (e.g., bounds in Omaha, NE). Attempting to lookup out-of-bounds addresses will fail or return no data.</span>
                </div>
            </div>

            {/* Input Form */}
            <div style={{
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
            }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.75rem' }}>
                    Select a Sandbox Address to Test
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {SAMPLE_ADDRESSES.map((sample, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleFetch(sample.value)}
                            disabled={loadingAddr !== null}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.75rem 1rem', background: 'var(--bg-surface)', 
                                border: '1px solid var(--border-default)', borderRadius: '6px', 
                                cursor: loadingAddr !== null ? 'not-allowed' : 'pointer',
                                opacity: loadingAddr !== null && loadingAddr !== sample.value ? 0.5 : 1,
                                textAlign: 'left', transition: 'all 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <MapPin size={18} style={{ color: 'var(--accent-primary)' }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.1rem' }}>
                                        {sample.label}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {sample.value}
                                    </div>
                                </div>
                            </div>
                            
                            {loadingAddr === sample.value ? (
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                            ) : (
                                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                        </button>
                    ))}
                    {result && (
                        <button
                            onClick={() => { setResult(null); setError(null); }}
                            style={{
                                padding: '0.5rem', fontSize: '0.75rem', marginTop: '0.5rem',
                                background: 'transparent', border: '1px dashed var(--border-default)',
                                borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer'
                            }}
                        >
                            Clear Results
                        </button>
                    )}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div style={{
                    padding: '1rem', background: 'var(--bg-error-subtle)',
                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                    color: 'var(--status-error)', fontSize: '0.85rem', marginBottom: '1.5rem',
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
                }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ wordBreak: 'break-word' }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>EagleView Request Failed</strong>
                        {error}
                    </div>
                </div>
            )}

            {/* Results Display */}
            {result && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setViewMode('formatted')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500,
                                    border: '1px solid', borderColor: viewMode === 'formatted' ? 'var(--accent-primary)' : 'var(--border-default)',
                                    background: viewMode === 'formatted' ? 'var(--accent-primary-muted)' : 'transparent',
                                    color: viewMode === 'formatted' ? 'var(--accent-primary)' : 'var(--text-mid)',
                                    cursor: 'pointer'
                                }}
                            >
                                <LayoutDashboard size={14} /> Attribute Explorer
                            </button>
                            <button
                                onClick={() => setViewMode('raw')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500,
                                    border: '1px solid', borderColor: viewMode === 'raw' ? 'var(--accent-primary)' : 'var(--border-default)',
                                    background: viewMode === 'raw' ? 'var(--accent-primary-muted)' : 'transparent',
                                    color: viewMode === 'raw' ? 'var(--accent-primary)' : 'var(--text-mid)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Code size={14} /> Raw JSON Response
                            </button>
                        </div>
                        
                        {viewMode === 'raw' && (
                            <button
                                onClick={handleCopy}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.3rem 0.6rem', background: 'transparent',
                                    border: 'none', color: copied ? 'var(--status-success)' : 'var(--text-muted)',
                                    fontSize: '0.75rem', cursor: 'pointer'
                                }}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied' : 'Copy JSON'}
                            </button>
                        )}
                    </div>

                    <div style={{
                        background: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        {/* Request Metadata Bar */}
                        <div style={{
                            padding: '0.5rem 1rem', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)',
                            display: 'flex', gap: '1.5rem', fontSize: '0.7rem', color: 'var(--text-muted)'
                        }}>
                            <div><span style={{ fontWeight: 600 }}>Request ID:</span> {result.metadata?.requestId || 'N/A'}</div>
                            <div><span style={{ fontWeight: 600 }}>Duration:</span> {result.metadata?.durationMs ? `${(result.metadata.durationMs / 1000).toFixed(1)}s` : 'N/A'}</div>
                            <div><span style={{ fontWeight: 600 }}>Polls:</span> {result.metadata?.pollingAttempts || 1}</div>
                        </div>

                        <div style={{ padding: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {viewMode === 'raw' ? (
                                <pre style={{
                                    margin: 0, padding: '1rem', background: 'var(--bg-surface)', 
                                    borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-high)',
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    fontFamily: 'monospace'
                                }}>
                                    {JSON.stringify(result.data, null, 2)}
                                </pre>
                            ) : (
                                <div style={{ display: 'grid', gap: '1.5rem' }}>
                                    {result.data?.property ? (
                                        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                                                Property Attributes
                                            </h3>
                                            {renderAttributes(result.data.property)}
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.75rem' }}>
                                                Response Body
                                            </h3>
                                            {renderAttributes(result.data)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
