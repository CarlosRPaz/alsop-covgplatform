'use client';

import React, { useId } from 'react';

export interface BrandLogoProps {
    /** Layout variant */
    variant?: 'icon' | 'horizontal' | 'badge';
    /** Size preset */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    /** Custom pixel height for the icon */
    iconSize?: number;
    /** Hide the wordmark text */
    hideText?: boolean;
    /** Extra CSS class */
    className?: string;
    /** Dark, light, or auto contrast mode */
    mode?: 'auto' | 'light' | 'dark' | 'monochrome';
    /** Optional custom subtitle text */
    subtitle?: string;
    /** Show or hide subtitle on lg/xl sizes */
    showSubtitle?: boolean;
}

const SIZES = {
    xs: { icon: 20, fontSize: '0.85rem', gap: '0.4rem' },
    sm: { icon: 26, fontSize: '1.05rem', gap: '0.5rem' },
    md: { icon: 34, fontSize: '1.3rem', gap: '0.65rem' },
    lg: { icon: 42, fontSize: '1.55rem', gap: '0.75rem' },
    xl: { icon: 54, fontSize: '1.95rem', gap: '0.9rem' },
};

/**
 * CoverageCheckNow Brand Emblem (SVG)
 * Modern geometric protection shield & house silhouette with subtle chimney,
 * negative space floor slice, and crisp precision checkmark.
 */
export function BrandEmblem({
    size = 32,
    className = '',
    mode = 'auto',
}: {
    size?: number;
    className?: string;
    mode?: 'auto' | 'light' | 'dark' | 'monochrome';
}) {
    const rawId = useId();
    // Sanitize useId string for SVG id compatibility
    const maskId = `ccn_floor_${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Color definitions based on mode
    let leftColor = '#1E40AF';
    let rightColor = '#3B82F6';
    let checkColor = '#FFFFFF';

    if (mode === 'dark') {
        leftColor = '#2563EB';
        rightColor = '#60A5FA';
        checkColor = '#FFFFFF';
    } else if (mode === 'monochrome') {
        leftColor = 'currentColor';
        rightColor = 'currentColor';
        checkColor = '#FFFFFF';
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ flexShrink: 0, display: 'block' }}
        >
            <defs>
                <mask id={maskId}>
                    {/* White exposes the graphic */}
                    <rect width="48" height="48" fill="#FFFFFF" />
                    {/* Black cuts the floor line through all shapes, revealing background */}
                    <path d="M0 34 H48" stroke="#000000" strokeWidth="4" />
                </mask>
            </defs>

            {/* Split-tone Shield with Chimney, cut through at y=34 */}
            <g mask={`url(#${maskId})`}>
                {/* Left Half (Deep Royal Blue) */}
                <path d="M24 4 L4 14 V28 C4 38 12 44 24 47 Z" fill={leftColor} />
                {/* Right Half (Electric Blue with Chimney) */}
                <path d="M24 4 L32 8 V4 H38 V11 L44 14 V28 C44 38 36 44 24 47 Z" fill={rightColor} />
            </g>

            {/* Crisp Precision Checkmark */}
            <path
                d="M16 20 L22 26 L32 14"
                stroke={checkColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function BrandLogo({
    variant = 'horizontal',
    size = 'md',
    iconSize,
    hideText = false,
    className = '',
    mode = 'auto',
    subtitle = 'Insurance Policy Intelligence',
    showSubtitle,
}: BrandLogoProps) {
    const config = SIZES[size] || SIZES.md;
    const finalIconSize = iconSize || config.icon;

    if (variant === 'icon' || hideText) {
        return <BrandEmblem size={finalIconSize} className={className} mode={mode} />;
    }

    // Determine text colors based on mode
    let mainTextColor = '#0F172A'; // Slate-900
    let checkTextColor = '#2563EB'; // Blue-600
    let subtitleColor = '#64748B'; // Slate-500

    if (mode === 'dark') {
        mainTextColor = '#FFFFFF';
        checkTextColor = '#60A5FA'; // Bright Blue-400 for high dark contrast
        subtitleColor = '#94A3B8';
    } else if (mode === 'monochrome') {
        mainTextColor = 'currentColor';
        checkTextColor = 'currentColor';
        subtitleColor = 'currentColor';
    }

    const shouldShowSubtitle = showSubtitle ?? (size === 'lg' || size === 'xl');

    return (
        <div
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: config.gap,
                textDecoration: 'none',
                userSelect: 'none',
                lineHeight: 1,
            }}
        >
            <BrandEmblem size={finalIconSize} mode={mode} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span
                    style={{
                        fontSize: config.fontSize,
                        fontWeight: 900,
                        letterSpacing: '-0.03em',
                        color: mainTextColor,
                        display: 'flex',
                        alignItems: 'center',
                        fontFamily: 'inherit',
                    }}
                >
                    <span>Coverage</span>
                    <span style={{ color: checkTextColor, fontWeight: 900 }}>Check</span>
                    <span>Now</span>
                </span>
                {shouldShowSubtitle && (
                    <span
                        style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: subtitleColor,
                            marginTop: '2px',
                        }}
                    >
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
}
