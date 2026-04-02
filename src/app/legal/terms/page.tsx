import React from 'react';
import Link from 'next/link';

export const metadata = {
    title: 'Terms of Service — CoverageCheckNow',
    description: 'Terms and conditions governing your use of the CoverageCheckNow platform.',
};

export default function TermsOfServicePage() {
    const lastUpdated = 'March 31, 2026';

    return (
        <article style={{ color: 'var(--text-high)', lineHeight: 1.75 }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                ← Back to Home
            </Link>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Terms of Service
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Last updated: {lastUpdated}
            </p>

            <Section title="1. Acceptance of Terms">
                <p>By accessing or using CoverageCheckNow (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
            </Section>

            <Section title="2. Description of Service">
                <p>CoverageCheckNow provides automated insurance policy review, coverage gap analysis, and reporting tools for licensed insurance professionals and their clients. The Platform is a <strong>decision-support tool</strong> and does not provide insurance advice.</p>
            </Section>

            <Section title="3. Account Responsibilities">
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at <a href="mailto:support@coveragechecknow.com" style={{ color: 'var(--accent-primary)' }}>support@coveragechecknow.com</a> if you suspect unauthorized access.</p>
            </Section>

            <Section title="4. Acceptable Use">
                <p>You agree not to:</p>
                <ul>
                    <li>Use the Platform for any unlawful purpose.</li>
                    <li>Upload fraudulent, misleading, or malicious content.</li>
                    <li>Attempt to reverse-engineer, scrape, or interfere with the Platform&apos;s infrastructure.</li>
                    <li>Share access credentials with unauthorized parties.</li>
                </ul>
            </Section>

            <Section title="5. Intellectual Property">
                <p>All Platform content, features, branding, and technology are owned by CoverageCheckNow (Alsop Inc). You retain ownership of data you upload. By uploading content, you grant us a limited license to process it for service delivery.</p>
            </Section>

            <Section title="6. Limitation of Liability">
                <p>The Platform is provided &quot;as is&quot; without warranties of any kind. CoverageCheckNow is not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our analysis and reports are supplementary tools and do not replace professional insurance judgment.</p>
            </Section>

            <Section title="7. Termination">
                <p>We may suspend or terminate your access if you violate these terms. You may close your account at any time by contacting support.</p>
            </Section>

            <Section title="8. Changes to Terms">
                <p>We may update these terms periodically. Continued use of the Platform after changes constitutes acceptance of the updated terms.</p>
            </Section>

            <Section title="9. Contact">
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
