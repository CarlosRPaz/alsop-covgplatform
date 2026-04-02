import React from 'react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '3rem 1.5rem',
        }}>
            {children}
        </div>
    );
}
