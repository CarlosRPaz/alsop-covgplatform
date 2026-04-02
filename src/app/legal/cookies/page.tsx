import React from 'react';
import Link from 'next/link';

export const metadata = {
    title: 'Cookie Policy — CoverageCheckNow',
    description: 'How CoverageCheckNow uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
    const lastUpdated = 'March 31, 2026';

    return (
        <article style={{ color: 'var(--text-high)', lineHeight: 1.75 }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                ← Back to Home
            </Link>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Cookie Policy
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Last updated: {lastUpdated}
            </p>

            <Section title="1. What Are Cookies">
                <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience.</p>
            </Section>

            <Section title="2. Cookies We Use">
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Type</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Purpose</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border-default))' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}><strong>Essential</strong></td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-mid)' }}>Authentication, session management, security.</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>Session / 30 days</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border-default))' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}><strong>Functional</strong></td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-mid)' }}>Theme preference, table settings, display configuration.</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>1 year</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '0.5rem 0.75rem' }}><strong>Analytics</strong></td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-mid)' }}>Usage patterns to improve the platform (anonymized).</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>1 year</td>
                        </tr>
                    </tbody>
                </table>
            </Section>

            <Section title="3. Third-Party Cookies">
                <p>We use Supabase for authentication, which may set its own cookies. We do <strong>not</strong> use advertising or tracking cookies from third parties.</p>
            </Section>

            <Section title="4. Managing Cookies">
                <p>You can control cookies through your browser settings. Disabling essential cookies may affect your ability to use the Platform. Refer to your browser&apos;s help documentation for instructions.</p>
            </Section>

            <Section title="5. Contact">
                <p>Questions? Email <a href="mailto:support@coveragechecknow.com" style={{ color: 'var(--accent-primary)' }}>support@coveragechecknow.com</a>.</p>
            </Section>
        </article>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.625rem', color: 'var(--text-high)' }}>{title}</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-mid)' }}>{children}</div>
        </section>
    );
}
