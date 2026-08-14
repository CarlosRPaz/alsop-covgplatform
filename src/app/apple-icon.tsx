import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
    width: 180,
    height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                    borderRadius: '36px',
                }}
            >
                <svg width="120" height="120" viewBox="0 0 48 48" fill="none">
                    <path d="M24 4 L4 14 V28 C4 38 12 44 24 47 Z" fill="#2563EB" />
                    <path d="M24 4 L32 8 V4 H38 V11 L44 14 V28 C44 38 36 44 24 47 Z" fill="#60A5FA" />
                    <path d="M0 34 H48" stroke="#1E293B" strokeWidth="4" />
                    <path
                        d="M16 20 L22 26 L32 14"
                        stroke="#FFFFFF"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
        ),
        {
            ...size,
        }
    );
}
