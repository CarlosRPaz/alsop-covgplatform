'use client';

import React, { useState, useCallback } from 'react';
import { MapPin, Satellite, Maximize2, X, RefreshCw, ImageOff, Loader2, ExternalLink, Zap } from 'lucide-react';
import styles from './PropertyBanner.module.css';

/* ─── Types ─── */
interface ImageSource {
    name: string;
    type: string;
    url: string | null;
    fetchedAt: string;
    confidence: string;
}

interface PropertyBannerProps {
    /** Real satellite image URL from enrichment, or null */
    imageSrc: string | null;
    /** Source metadata for the image */
    imageSource: ImageSource | null;
    /** Fire risk label (e.g. "High", "Very Low") */
    fireRiskLabel: string | null;
    /** Property address to display in the placeholder */
    propertyAddress: string | null;
    /** Whether enrichment is currently running */
    isEnriching: boolean;
    /** Current enrichment step text */
    enrichStep: string | null;
    /** Callback to trigger enrichment */
    onEnrich: () => void;
}

/* ─── Fire risk colors ─── */
function getFireRiskColor(label: string | null): string {
    switch (label) {
        case 'Very High': return '#ef4444';
        case 'High': return '#f97316';
        case 'Moderate': return '#eab308';
        case 'Low': return '#22c55e';
        case 'Very Low': return '#16a34a';
        default: return '#6b7280';
    }
}

/* ═══════════════════════════════════════════════════════════════
   PropertyBanner — State-aware property image component
   
   States:
   1. NOT ENRICHED - No satellite image, show placeholder with CTA
   2. LOADING       - Enrichment in progress, show shimmer
   3. ENRICHED      - Real satellite image with source badge
   4. ERROR         - Image failed to load, retry option
   ═══════════════════════════════════════════════════════════════ */
export function PropertyBanner({
    imageSrc,
    imageSource,
    fireRiskLabel,
    propertyAddress,
    isEnriching,
    enrichStep,
    onEnrich,
}: PropertyBannerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const fireRiskColor = getFireRiskColor(fireRiskLabel);

    // Reset error state when imageSrc changes
    const handleImageError = useCallback(() => {
        setImageError(true);
        setImageLoaded(false);
    }, []);

    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
        setImageError(false);
    }, []);

    // Determine state
    const hasRealImage = imageSrc && !imageError;
    const isLoading = isEnriching;

    /* ─── State: Loading (Enrichment in progress) ─── */
    if (isLoading && !hasRealImage) {
        return (
            <div className={styles.banner}>
                <div className={styles.loadingState}>
                    <div className={styles.loadingShimmer} />
                    <div className={styles.loadingOverlay}>
                        <div className={styles.loadingContent}>
                            <div className={styles.loadingIcon}>
                                <Satellite size={32} />
                            </div>
                            <h3 className={styles.loadingTitle}>Fetching Property Imagery</h3>
                            <p className={styles.loadingStep}>
                                {enrichStep || 'Initializing enrichment…'}
                            </p>
                            <div className={styles.loadingBar}>
                                <div className={styles.loadingBarFill} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── State: Error (Image failed to load) ─── */
    if (imageSrc && imageError) {
        return (
            <div className={styles.banner}>
                <div className={styles.errorState} onClick={() => setIsModalOpen(true)}>
                    <div className={styles.errorContent}>
                        <div className={styles.errorIcon}>
                            <ImageOff size={36} />
                        </div>
                        <h3 className={styles.errorTitle}>Satellite Image Unavailable</h3>
                        <p className={styles.errorSubtitle}>
                            The image could not be loaded. This may be a temporary issue with the imagery provider.
                        </p>
                        <div className={styles.errorActions}>
                            <button
                                className={styles.retryBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImageError(false);
                                    setImageLoaded(false);
                                    onEnrich();
                                }}
                            >
                                <RefreshCw size={14} />
                                Re-fetch Imagery
                            </button>
                        </div>
                        {imageSource && (
                            <p className={styles.errorMeta}>
                                Last attempt: {imageSource.name} · {new Date(imageSource.fetchedAt).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ─── State: Not Enriched (No satellite image) ─── */
    if (!hasRealImage) {
        return (
            <div className={styles.banner}>
                <div className={styles.placeholderState}>
                    {/* Decorative grid pattern */}
                    <div className={styles.gridPattern} />

                    <div className={styles.placeholderContent}>
                        <div className={styles.placeholderIcon}>
                            <MapPin size={28} strokeWidth={1.5} />
                        </div>
                        <h3 className={styles.placeholderTitle}>Property Imagery Not Available</h3>
                        {propertyAddress ? (
                            <p className={styles.placeholderAddress}>{propertyAddress}</p>
                        ) : (
                            <p className={styles.placeholderAddress} style={{ fontStyle: 'italic', opacity: 0.5 }}>
                                No property address on file
                            </p>
                        )}
                        <p className={styles.placeholderHint}>
                            Run property enrichment to fetch satellite imagery, ATTOM property data, fire risk analysis, and more.
                        </p>
                        <button
                            className={styles.enrichCta}
                            onClick={onEnrich}
                            disabled={isEnriching || !propertyAddress}
                        >
                            {isEnriching ? (
                                <>
                                    <Loader2 size={16} className={styles.spinning} />
                                    Enriching…
                                </>
                            ) : (
                                <>
                                    <Zap size={16} />
                                    Enrich Property Data
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── State: Enriched (Real satellite image) ─── */
    return (
        <>
            <div className={styles.banner}>
                <div className={styles.enrichedState} onClick={() => setIsModalOpen(true)}>
                    {/* Loading shimmer while image loads */}
                    {!imageLoaded && (
                        <div className={styles.imageLoadingShimmer} />
                    )}
                    <img
                        src={imageSrc!}
                        alt={`Satellite view of property${propertyAddress ? ` at ${propertyAddress}` : ''}`}
                        className={`${styles.bannerImage} ${imageLoaded ? styles.imageVisible : styles.imageHidden}`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                    />

                    {/* Bottom gradient overlay */}
                    <div className={styles.bannerOverlay}>
                        <div className={styles.bannerContent}>
                            <div className={styles.bannerRow}>
                                <div>
                                    <h2 className={styles.bannerTitle}>Property Analysis</h2>
                                    <p className={styles.bannerSubtitle}>
                                        Source: {imageSource?.name || 'Unknown'} · Fetched {imageSource ? new Date(imageSource.fetchedAt).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div className={styles.bannerActions}>
                                    {fireRiskLabel && (
                                        <div
                                            className={styles.fireRiskBadge}
                                            style={{ borderColor: `${fireRiskColor}40` }}
                                        >
                                            <span className={styles.fireRiskLabel}>🔥 FIRE RISK</span>
                                            <span
                                                className={styles.fireRiskValue}
                                                style={{ color: fireRiskColor }}
                                            >
                                                {fireRiskLabel}
                                            </span>
                                        </div>
                                    )}
                                    <button className={styles.viewFullBtn}>
                                        <Maximize2 size={16} />
                                        View Full Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Source badge (bottom right) */}
                    {imageSource && (
                        <div className={styles.sourceBadge}>
                            <Satellite size={12} />
                            <span>{imageSource.name}</span>
                            <span className={styles.sourceDot}>·</span>
                            <span className={styles.sourceType}>{imageSource.type.replace('_', ' ')}</span>
                            {imageSource.confidence === 'high' && (
                                <span className={styles.confidenceCheck}>✓</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Full-screen Modal ─── */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button
                            className={styles.closeButton}
                            onClick={() => setIsModalOpen(false)}
                        >
                            <X size={18} />
                            Close
                        </button>

                        <img
                            src={imageSrc!}
                            alt={`Full satellite view${propertyAddress ? ` — ${propertyAddress}` : ''}`}
                            className={styles.modalImage}
                        />

                        {imageSource && (
                            <div className={styles.modalMeta}>
                                <div className={styles.modalMetaItem}>
                                    <span className={styles.modalMetaLabel}>Source</span>
                                    <span>{imageSource.name}</span>
                                </div>
                                <div className={styles.modalMetaItem}>
                                    <span className={styles.modalMetaLabel}>Type</span>
                                    <span style={{ textTransform: 'capitalize' }}>{imageSource.type.replace('_', ' ')}</span>
                                </div>
                                <div className={styles.modalMetaItem}>
                                    <span className={styles.modalMetaLabel}>Fetched</span>
                                    <span>{new Date(imageSource.fetchedAt).toLocaleString()}</span>
                                </div>
                                <div className={styles.modalMetaItem}>
                                    <span className={styles.modalMetaLabel}>Confidence</span>
                                    <span style={{
                                        color: imageSource.confidence === 'high' ? '#34d399' : '#94a3b8',
                                        fontWeight: 600,
                                    }}>
                                        {imageSource.confidence}
                                    </span>
                                </div>
                                {fireRiskLabel && (
                                    <div className={styles.modalMetaItem}>
                                        <span className={styles.modalMetaLabel}>🔥 Fire Risk</span>
                                        <span style={{ color: fireRiskColor, fontWeight: 700 }}>
                                            {fireRiskLabel}
                                        </span>
                                    </div>
                                )}
                                {imageSource.url && (
                                    <a
                                        href={imageSource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.modalMetaLink}
                                    >
                                        <ExternalLink size={13} />
                                        View on {imageSource.name}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
