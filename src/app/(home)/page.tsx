import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  Upload, Search, FileCheck, Shield, Zap, AlertTriangle,
  ChevronRight, Lock, Eye, Brain, CheckCircle, HelpCircle,
  ArrowRight, Star, Users, Building2
} from 'lucide-react';
import { AnimatedHeadline } from '@/components/ui/AnimatedHeadline';
import { AnimatedStagger } from '@/components/ui/AnimatedStagger';
import { SmoothScrollLink } from '@/components/ui/SmoothScrollLink';
import { HeroCarousel } from '@/components/ui/HeroCarousel';
import styles from './page.module.scss';

// ─── Data ───

const steps = [
  {
    num: '01',
    icon: Upload,
    title: 'Upload Your Dec Page',
    desc: 'Upload your current insurance declarations page as a PDF or image. It takes less than a minute.',
  },
  {
    num: '02',
    icon: Search,
    title: 'AI Analyzes Coverage',
    desc: 'Our AI extracts policy details, scores risk exposure, and identifies potential gaps in your coverage.',
  },
  {
    num: '03',
    icon: FileCheck,
    title: 'Get Your Gap Report',
    desc: 'Receive a clear, actionable report showing coverage gaps, recommendations, and next steps.',
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
  { name: 'Verisk', desc: 'Insurance underwriting intelligence' },
  { name: 'EagleView', desc: 'Aerial imagery & measurement' },
  { name: 'Nearmap', desc: 'High-resolution aerial surveys' },
];

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Homeowner, Santa Barbara',
    quote: 'I had no idea my flood coverage had been dropped after my last renewal. CoverageCheckNow caught it in minutes.',
  },
  {
    name: 'David K.',
    role: 'Small Business Owner',
    quote: 'The gap report showed my liability limits were half what they should be. My agent confirmed and we fixed it the same week.',
  },
  {
    name: 'Rachel T.',
    role: 'Insurance Agent, LA',
    quote: 'I use CoverageCheckNow for every client onboarding now. It saves hours of manual dec page review and catches things I might miss.',
  },
];

const faqs = [
  { q: 'Is it free?', a: 'Yes. CoverageCheckNow is completely free to use. There are no hidden fees or upsells.' },
  { q: 'What do you need from me?', a: 'Just your insurance declarations page — the summary page from your policy documents. It\'s usually 1–3 pages.' },
  { q: 'Do I need an account?', a: 'Yes, a free account is required so your documents and reports stay secure and accessible only to you.' },
  { q: 'How long does the analysis take?', a: 'Most reports are generated within minutes of uploading your declarations page.' },
  { q: 'Is my data safe?', a: 'Yes. We use encryption, least-privilege access, and never sell your personal data.' },
  { q: 'What file types are supported?', a: 'We accept PDF, PNG, JPG, and JPEG files up to 10MB.' },
  { q: 'Does this replace my agent?', a: 'No. CoverageCheckNow helps you and your agent make more informed decisions. We recommend reviewing results with a licensed professional.' },
  { q: 'What states are supported?', a: 'We are currently focused on California.' },
];

// ─── Page ───

export default function Home() {
  return (
    <div className={styles.page}>
      <Navbar />

      <main>
        {/* ─── HERO: Split layout ─── */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <div className={styles.heroBadge}>
                <Shield size={14} />
                <span>Built by Alsop & Associates · 40 years in California</span>
              </div>
              <AnimatedHeadline
                text="Most homes are underinsured. Find out if you have gaps in your coverage."
                className={styles.heroHeadline}
                delayMs={300}
                staggerMs={140}
              />
              <p className={styles.heroSub}>
                Upload your insurance declarations page and get an AI-powered gap analysis — in minutes, not days.
              </p>
              <div className={styles.heroCtas}>
                <Link href="/submit">
                  <Button size="lg" className={styles.primaryCta}>
                    Submit Declaration
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <SmoothScrollLink href="#how-it-works" className={styles.ghostCta}>
                  See how it works
                  <ChevronRight size={16} />
                </SmoothScrollLink>
              </div>
              <AnimatedStagger className={styles.heroProof} delayMs={500} staggerMs={150}>
                <div className={styles.proofItem}>
                  <Lock size={14} />
                  <span>Encrypted & secure</span>
                </div>
                <div className={styles.proofItem}>
                  <Brain size={14} />
                  <span>AI-assisted analysis</span>
                </div>
                <div className={styles.proofItem}>
                  <CheckCircle size={14} />
                  <span>Free to use</span>
                </div>
              </AnimatedStagger>
            </div>
            <div className={styles.heroImage}>
              <HeroCarousel />
              <div className={styles.heroImageOverlay} />
            </div>
          </div>
        </section>

        {/* ─── TRUST BAR ─── */}
        <section className={styles.trustBar}>
          <div className={styles.trustBarInner}>
            <div className={styles.trustStat}>
              <strong>40+</strong>
              <span>Years in business</span>
            </div>
            <div className={styles.trustDivider} />
            <div className={styles.trustStat}>
              <strong>AI-Powered</strong>
              <span>Gap analysis engine</span>
            </div>
            <div className={styles.trustDivider} />
            <div className={styles.trustStat}>
              <strong>California</strong>
              <span>Focused coverage</span>
            </div>
            <div className={styles.trustDivider} />
            <div className={styles.trustStat}>
              <strong>Free</strong>
              <span>No fees</span>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className={styles.sectionLight} id="how-it-works">
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>How It Works</span>
              <h2>Three steps to smarter coverage.</h2>
              <p>No paperwork. No phone calls. Just upload and go.</p>
            </div>
            <AnimatedStagger className={styles.stepsRow} staggerMs={150}>
              {steps.map((step, i) => (
                <div key={i} className={styles.stepCard}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNum}>{step.num}</span>
                    <div className={styles.stepIconWrap}>
                      <step.icon size={22} />
                    </div>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </AnimatedStagger>
          </div>
        </section>

        {/* ─── WHAT YOU GET ─── */}
        <section className={styles.sectionDark}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>What You Get</span>
              <h2>A comprehensive analysis — not just a summary.</h2>
              <p>Every report is built to help you and your agent take action.</p>
            </div>
            <AnimatedStagger className={styles.delivGrid} staggerMs={100} distance={30}>
              {deliverables.map((d, i) => (
                <div key={i} className={styles.delivCard}>
                  <div className={styles.delivIconWrap}>
                    <d.icon size={20} />
                  </div>
                  <div>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                </div>
              ))}
            </AnimatedStagger>
          </div>
        </section>

        {/* ─── WHY IT MATTERS ─── */}
        <section className={styles.sectionLight}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Why It Matters</span>
              <h2>Most coverage gaps are invisible — until it&apos;s too late.</h2>
            </div>
            <AnimatedStagger className={styles.whyGrid} staggerMs={100} distance={30}>
              {whyItems.map((w, i) => (
                <div key={i} className={styles.whyCard}>
                  <AlertTriangle size={20} className={styles.whyIcon} />
                  <div>
                    <h3>{w.title}</h3>
                    <p>{w.desc}</p>
                  </div>
                </div>
              ))}
            </AnimatedStagger>
          </div>
        </section>

        {/* ─── INDUSTRY DATA PARTNERS ─── */}
        <section className={styles.sectionDark}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Industry Data</span>
              <h2>Designed to work with leading data providers.</h2>
              <p>We&apos;re building CoverageCheckNow to integrate with the most trusted sources in insurance intelligence.</p>
            </div>
            <AnimatedStagger className={styles.partnerGrid} staggerMs={120} distance={25}>
              {dataProviders.map((p, i) => (
                <div key={i} className={styles.partnerCard}>
                  <Building2 size={24} className={styles.partnerIcon} />
                  <span className={styles.partnerName}>{p.name}</span>
                  <span className={styles.partnerDesc}>{p.desc}</span>
                </div>
              ))}
            </AnimatedStagger>
            <p className={styles.partnerDisclaimer}>
              Data provider integrations are planned and under development. Names shown represent the data ecosystem CoverageCheckNow is being designed to work with.
            </p>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className={styles.sectionLight}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>What Users Are Saying</span>
              <h2>Trusted by homeowners and agents alike.</h2>
            </div>
            <AnimatedStagger className={styles.testGrid} staggerMs={150} distance={30}>
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
            </AnimatedStagger>
            <p className={styles.finePrint}>Sample testimonials shown during beta period.</p>
          </div>
        </section>

        {/* ─── SECURITY & PRIVACY ─── */}
        <section className={styles.sectionDark}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Security & Privacy</span>
              <h2>Your data is handled with care.</h2>
            </div>
            <AnimatedStagger className={styles.securityRow} staggerMs={120} distance={25}>
              <div className={styles.securityItem}>
                <Lock size={20} />
                <div>
                  <h4>Encrypted Storage</h4>
                  <p>All documents are encrypted at rest and in transit.</p>
                </div>
              </div>
              <div className={styles.securityItem}>
                <Eye size={20} />
                <div>
                  <h4>Access Controls</h4>
                  <p>Least-privilege access — only you see your data.</p>
                </div>
              </div>
              <div className={styles.securityItem}>
                <Shield size={20} />
                <div>
                  <h4>No Data Sales</h4>
                  <p>We never sell, share, or monetize your personal data.</p>
                </div>
              </div>
              <div className={styles.securityItem}>
                <Brain size={20} />
                <div>
                  <h4>AI Transparency</h4>
                  <p>AI is assistive — recommendations should always be reviewed.</p>
                </div>
              </div>
            </AnimatedStagger>
            <p className={styles.legalNote}>
              This tool provides informational guidance and is not legal or financial advice. Recommendations should be reviewed with a licensed insurance professional.
            </p>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className={styles.sectionLight}>
          <div className={styles.contain}>
            <div className={styles.sectionHead}>
              <HelpCircle size={20} className={styles.sectionLabelIcon} />
              <span className={styles.sectionLabel}>FAQ</span>
              <h2>Frequently asked questions.</h2>
            </div>
            <AnimatedStagger className={styles.faqList} staggerMs={80} distance={15}>
              {faqs.map((f, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </AnimatedStagger>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className={styles.finalCta}>
          <div className={styles.contain}>
            <h2>Ready to see what your policy is missing?</h2>
            <p>Submit your declarations page in minutes. Free. Fast. No surprises.</p>
            <Link href="/submit">
              <Button size="lg" className={styles.primaryCta}>
                Submit Declaration
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
