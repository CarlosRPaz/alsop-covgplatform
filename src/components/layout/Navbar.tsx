'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Shield } from 'lucide-react';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/submit', label: 'Submit' },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className={styles.navbar}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <Shield size={28} className={styles.logoIcon} />
                    <span className={styles.logoText}>Gap Guard</span>
                </Link>

                <div className={styles.navLinks}>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <Link href="/submit">
                    <Button size="sm" className={styles.ctaButton}>
                        Get Started
                    </Button>
                </Link>
            </div>
        </nav>
    );
}
