import React from 'react';
import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy — CoverageCheckNow',
    description: 'How CoverageCheckNow collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
    const lastUpdated = 'March 31, 2026';

    return (
        <article style={{ color: 'var(--text-high)', lineHeight: 1.75 }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                ← Back to Home
            </Link>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Privacy Policy
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Last updated: {lastUpdated}
            </p>

            <Section title="1. Information We Collect">
                <p>We collect information you provide directly, including:</p>
                <ul>
                    <li><strong>Account data</strong> — name, email address, and password when you create an account.</li>
                    <li><strong>Policy data</strong> — insurance declarations, coverage details, and related documents you upload.</li>
                    <li><strong>Usage data</strong> — pages visited, features used, and interactions within the platform.</li>
                </ul>
            </Section>

            <Section title="2. How We Use Your Information">
                <p>Your information is used to:</p>
                <ul>
                    <li>Provide, maintain, and improve our policy review and analysis services.</li>
                    <li>Generate coverage gap reports and flag potential issues.</li>
                    <li>Communicate service updates, security alerts, and support responses.</li>
                    <li>Comply with legal obligations and enforce our terms.</li>
                </ul>
            </Section>

            <Section title="3. Data Sharing">
                <p>We do <strong>not</strong> sell your personal information. We may share data with:</p>
                <ul>
                    <li><strong>Service providers</strong> — hosting, analytics, and AI processing partners who operate under strict data agreements.</li>
                    <li><strong>Legal authorities</strong> — when required by law, subpoena, or to protect rights and safety.</li>
                </ul>
            </Section>

            <Section title="4. Data Security">
                <p>We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, role-based access controls, and regular security audits to protect your data.</p>
            </Section>

            <Section title="5. Data Retention">
                <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting <a href="mailto:support@coveragechecknow.com" style={{ color: 'var(--accent-primary)' }}>support@coveragechecknow.com</a>.</p>
            </Section>

            <Section title="6. Your Rights">
                <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or port your personal data. Contact us to exercise these rights.</p>
            </Section>

            <Section title="7. Contact">
                <p>Questions about this policy? Email us at <a href="mailto:support@coveragechecknow.com" style={{ color: 'var(--accent-primary)' }}>support@coveragechecknow.com</a>.</p>
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
