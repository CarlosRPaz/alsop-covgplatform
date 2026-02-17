import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BackgroundSlideshow } from '@/components/home/BackgroundSlideshow';
import { Zap, Shield, Clock } from 'lucide-react';
import styles from './page.module.scss';

const features = [
  {
    icon: Clock,
    title: 'Time-Saving Solutions',
    description: 'We streamline operations and deliver fast results, so you can focus on your business.',
  },
  {
    icon: Shield,
    title: 'Coverage Gap Analysis',
    description: 'Our solutions identify hidden coverage gaps, helping you protect your clients effectively.',
  },
  {
    icon: Zap,
    title: 'Efficient Workflows',
    description: 'Our solutions help streamline operations, reduce errors, and boost overall efficiency.',
  },
];

export default function Home() {
  return (
    <div className={styles.pageWrapper}>
      <BackgroundSlideshow />
      <Navbar />

      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.headline}>
              Gap Guard
            </h1>
            <p className={styles.tagline}>
              Protecting clients with intelligent coverage gap analysis — renew with confidence.
            </p>

            <div className={styles.ctaSection}>
              <Link href="/submit">
                <Button size="lg" className={styles.primaryCta}>
                  Submit Declaration
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className={styles.features}>
          <div className={styles.featureGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <feature.icon size={24} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
