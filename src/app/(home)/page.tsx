import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BackgroundSlideshow } from '@/components/home/BackgroundSlideshow';
import {
  Upload, Search, FileCheck, Shield, Zap, AlertTriangle,
  ChevronDown, Lock, Eye, Brain, CheckCircle, HelpCircle,
  ArrowRight, Clock, Star, Users, Database, Building2
} from 'lucide-react';
import styles from './page.module.scss';

// ─── Data ───

const trustItems = [
  { icon: Building2, text: '40 years in business' },
  { icon: Brain, text: 'AI-assisted analysis' },
  { icon: Shield, text: 'Built by Alsop & Associates' },
  { icon: Lock, text: 'Secure document handling' },
];

const steps = [
  {
    num: '01',
    icon: Upload,
    title: 'Upload Declarations Page',
    desc: 'Upload your current insurance declarations page as a PDF or image. It takes less than a minute.',
  },
  {
    num: '02',
    icon: Search,
    title: 'We Analyze Coverage & Risk',
    desc: 'Our AI extracts policy details, scores risk exposure, and identifies potential gaps in your coverage.',
  },
  {
    num: '03',
    icon: FileCheck,
    title: 'Get Your Gap Report',
    desc: 'Receive a clear, actionable report with coverage gaps, recommendations, and next steps.',
  },
];

const deliverables = [
  { icon: AlertTriangle, title: 'Coverage Gap Identification', desc: 'See exactly where your current policy may leave you exposed.' },
  { icon: Zap, title: 'Risk Scoring', desc: 'Understand your risk level across property, liability, and specialty lines.' },
  { icon: CheckCircle, title: 'Coverage Recommendations', desc: 'Actionable suggestions to close gaps and strengthen your protection.' },
  { icon: FileCheck, title: 'Renewal Confidence Checklist', desc: 'Know what to ask your agent before your next renewal.' },
  { icon: Users, title: 'Agent-Reviewed Options', desc: 'Connect with experienced agents who can implement recommended changes.' },
  { icon: Shield, title: 'Ongoing Monitoring', desc: 'Track changes to your coverage profile over time as policies renew.' },
];

const whyItems = [
  { title: 'Underinsurance surprises', desc: 'Most homeowners don\'t discover gaps until they file a claim. By then, it\'s too late.' },
  { title: 'Natural disaster gaps', desc: 'Flood, earthquake, and wildfire coverage varies widely and is often excluded by default.' },
  { title: 'Liability blind spots', desc: 'Umbrella and liability limits often fall short of actual exposure for families and small businesses.' },
  { title: 'Deductible traps', desc: 'High deductibles on specific perils can mean tens of thousands out of pocket when disaster strikes.' },
];

const dataProviders = [
  { name: 'CoreLogic', desc: 'Property data & risk analytics' },
  { name: 'Verisk', desc: 'Insurance underwriting data' },
  { name: 'EagleView', desc: 'Aerial imagery & measurement' },
  { name: 'Nearmap', desc: 'High-resolution aerial surveys' },
];

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Homeowner, Santa Barbara',
    quote: 'I had no idea my flood coverage had been dropped after my last renewal. Gap Guard caught it in minutes.',
  },
  {
    name: 'David K.',
    role: 'Small Business Owner',
    quote: 'The gap report showed my liability limits were half what they should be. My agent confirmed and we fixed it the same week.',
  },
  {
    name: 'Rachel T.',
    role: 'Insurance Agent, LA',
    quote: 'I use Gap Guard for every client onboarding now. It saves hours of manual dec page review and catches things I might miss.',
  },
];

const faqs = [
  { q: 'Is it free?', a: 'Yes. Gap Guard is completely free to use. There are no hidden fees or upsells.' },
  { q: 'What do you need from me?', a: 'Just your insurance declarations page — the summary page from your policy documents. It\'s usually 1–3 pages.' },
  { q: 'Do I need an account?', a: 'Yes, a free account is required. This ensures your documents and reports are stored securely and accessible only to you.' },
  { q: 'How long does the analysis take?', a: 'Most reports are generated within minutes of uploading your declarations page.' },
  { q: 'Is my data safe?', a: 'Yes. We use encryption, least-privilege access, and never sell your personal data. Documents are stored securely in our cloud infrastructure.' },
  { q: 'What file types are supported?', a: 'We accept PDF, PNG, JPG, and JPEG files up to 10MB.' },
  { q: 'Does this replace my agent?', a: 'No. Gap Guard is a tool that helps you and your agent make more informed decisions. We recommend reviewing results with a licensed professional.' },
  { q: 'What states are supported?', a: 'We are currently focused on California. We\'re expanding to additional states soon.' },
];

const securityItems = [
  { icon: Lock, text: 'Documents encrypted and stored securely' },
  { icon: Eye, text: 'Least-privilege access controls' },
  { icon: Shield, text: 'We never sell your personal data' },
  { icon: Brain, text: 'AI is assistive — recommendations should be reviewed' },
];

// ─── Page ───

export default function Home() {
  return (
    <div className={styles.pageWrapper}>
      <BackgroundSlideshow />
      <Navbar />

      <main className={styles.main}>
        {/* ─── 1. Hero ─── */}
        <section className={styles.hero} id="hero">
          <div className={styles.heroContent}>
            <h1 className={styles.headline}>
              Know what your policy<br /><em>really</em> covers.
            </h1>
            <p className={styles.tagline}>
              Upload your Declarations Page and get an AI-powered coverage gap report — fast, free, and clear.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/submit">
                <Button size="lg" className={styles.primaryCta}>
                  Submit Declaration
                  <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                </Button>
              </Link>
              <a href="#how-it-works" className={styles.secondaryCta}>
                How It Works
                <ChevronDown size={16} />
              </a>
            </div>
            <p className={styles.trustLine}>
              By <strong>Alsop and Associates</strong> · 40 years serving California
            </p>
          </div>
        </section>

        {/* ─── 2. Trust Strip ─── */}
        <section className={styles.trustStrip}>
          <div className={styles.trustGrid}>
            {trustItems.map((item, i) => (
              <div key={i} className={styles.trustItem}>
                <item.icon size={18} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 3. How It Works ─── */}
        <section className={styles.section} id="how-it-works">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>How It Works</h2>
              <p>Three simple steps to a smarter insurance review.</p>
            </div>
            <div className={styles.stepsGrid}>
              {steps.map((step, i) => (
                <div key={i} className={styles.stepCard}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <div className={styles.stepIcon}>
                    <step.icon size={24} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 4. What You Get ─── */}
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>What You Get</h2>
              <p>A comprehensive analysis — not just a summary.</p>
            </div>
            <div className={styles.delivGrid}>
              {deliverables.map((d, i) => (
                <div key={i} className={styles.delivCard}>
                  <div className={styles.delivIcon}>
                    <d.icon size={20} />
                  </div>
                  <div>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. Why It Matters ─── */}
        <section className={styles.section} style={{ background: 'var(--bg-surface)' }}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>Why It Matters</h2>
              <p>Most coverage gaps are invisible — until you need your policy the most.</p>
            </div>
            <div className={styles.whyGrid}>
              {whyItems.map((w, i) => (
                <div key={i} className={styles.whyCard}>
                  <AlertTriangle size={18} className={styles.whyIcon} />
                  <div>
                    <h3>{w.title}</h3>
                    <p>{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. Data Providers ─── */}
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <Database size={20} className={styles.sectionIcon} />
              <h2>Connected to Industry Data</h2>
              <p>We augment your policy data with trusted insurance industry sources.</p>
            </div>
            <div className={styles.providerGrid}>
              {dataProviders.map((p, i) => (
                <div key={i} className={styles.providerCard}>
                  <span className={styles.providerName}>{p.name}</span>
                  <span className={styles.providerDesc}>{p.desc}</span>
                </div>
              ))}
            </div>
            <p className={styles.disclaimer}>Partner integrations shown are placeholders during beta.</p>
          </div>
        </section>

        {/* ─── 7. Testimonials ─── */}
        <section className={styles.section} style={{ background: 'var(--bg-surface)' }}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>What Users Are Saying</h2>
            </div>
            <div className={styles.testGrid}>
              {testimonials.map((t, i) => (
                <div key={i} className={styles.testCard}>
                  <div className={styles.testStars}>
                    {[...Array(5)].map((_, j) => <Star key={j} size={14} />)}
                  </div>
                  <p className={styles.testQuote}>&ldquo;{t.quote}&rdquo;</p>
                  <div className={styles.testAuthor}>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.disclaimer}>Sample testimonials during beta.</p>
          </div>
        </section>

        {/* ─── 8. Security ─── */}
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>Security &amp; Privacy</h2>
              <p>Your data is handled with care.</p>
            </div>
            <div className={styles.securityGrid}>
              {securityItems.map((s, i) => (
                <div key={i} className={styles.securityItem}>
                  <s.icon size={18} />
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
            <p className={styles.legalDisclaimer}>
              This tool provides informational guidance and is not legal or financial advice.
              Recommendations should be reviewed with a licensed insurance professional.
            </p>
          </div>
        </section>

        {/* ─── 9. FAQ ─── */}
        <section className={styles.section} style={{ background: 'var(--bg-surface)' }}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <HelpCircle size={20} className={styles.sectionIcon} />
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className={styles.faqList}>
              {faqs.map((f, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 10. Final CTA ─── */}
        <section className={styles.finalCta}>
          <div className={styles.sectionInner}>
            <h2>Submit your Declarations Page in minutes.</h2>
            <p>Free. Fast. No surprises — except the ones we help you prevent.</p>
            <Link href="/submit">
              <Button size="lg" className={styles.primaryCta}>
                Submit Declaration
                <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
