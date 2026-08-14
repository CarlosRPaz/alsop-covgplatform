import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                }}
            >
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                    <path d="M24 4 L4 14 V28 C4 38 12 44 24 47 Z" fill="#1E40AF" />
                    <path d="M24 4 L32 8 V4 H38 V11 L44 14 V28 C44 38 36 44 24 47 Z" fill="#3B82F6" />
                    <path d="M0 34 H48" stroke="#FFFFFF" strokeWidth="4" />
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
