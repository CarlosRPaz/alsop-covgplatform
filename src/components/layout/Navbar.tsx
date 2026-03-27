'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Navbar.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Shield, LogIn, LogOut, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfile, UserRole } from '@/lib/auth';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard', authRequired: true, hideForRole: 'customer' },
    { href: '/submit', label: 'Submit', authRequired: false, hideForRole: 'customer' },
];

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [firstName, setFirstName] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);

    useEffect(() => {
        async function loadUser() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsLoggedIn(true);
                setUserId(session.user.id);

                const profile = await getUserProfile();
                if (profile) {
                    setUserRole(profile.role);
                    setFirstName(profile.first_name || profile.email.split('@')[0] || 'User');
                } else {
                    setFirstName(session.user.email?.split('@')[0] || 'User');
                }
            }
        }

        loadUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setIsLoggedIn(false);
                setFirstName(null);
                setUserId(null);
            } else {
                setIsLoggedIn(true);
                setUserId(session.user.id);
                getUserProfile().then(profile => {
                    if (profile) {
                        setUserRole(profile.role);
                        setFirstName(profile.first_name || profile.email.split('@')[0] || 'User');
                    }
                });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsLoggedIn(false);
        setFirstName(null);
        setUserId(null);
        setUserRole(null);
        router.push('/');
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <Shield size={28} className={styles.logoIcon} />
                    <span className={styles.logoText}>CoverageCheckNow</span>
                </Link>

                <div className={styles.navLinks}>
                    {navLinks
                        .filter((link) => !link.authRequired || isLoggedIn)
                        .filter((link) => !(link.hideForRole && link.hideForRole === userRole))
                        .map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                </div>

                <div className={styles.navActions}>
                    {isLoggedIn ? (
                        <>
                            <Link href={userRole === 'customer' ? '/portal' : '/dashboard'} className={styles.welcomeLink}>
                                <div className={styles.welcomeSection}>
                                    <User size={16} className={styles.welcomeIcon} />
                                    <span className={styles.welcomeText}>
                                        Welcome, <strong>{firstName}</strong>
                                    </span>
                                </div>
                            </Link>
                            <button onClick={handleSignOut} className={styles.signOutButton}>
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/auth/signin">
                                <Button size="sm" variant="outline" className={styles.signInButton}>
                                    <LogIn size={16} style={{ marginRight: '0.4rem' }} />
                                    Sign In
                                </Button>
                            </Link>
                            <Link href="/submit">
                                <Button size="sm" className={styles.ctaButton}>
                                    Get Started
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
