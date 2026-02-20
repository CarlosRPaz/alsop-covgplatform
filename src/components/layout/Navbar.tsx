'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Navbar.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Shield, LogIn, LogOut, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/submit', label: 'Submit' },
];

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [firstName, setFirstName] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        async function loadUser() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsLoggedIn(true);
                setUserId(session.user.id);

                // Try profile first, then user_metadata
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name')
                    .eq('id', session.user.id)
                    .single();

                const name = profile?.first_name
                    || session.user.user_metadata?.first_name
                    || session.user.email?.split('@')[0]
                    || 'User';

                setFirstName(name);
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
                // Re-fetch name on auth change
                supabase
                    .from('profiles')
                    .select('first_name')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data: profile }) => {
                        const name = profile?.first_name
                            || session.user.user_metadata?.first_name
                            || session.user.email?.split('@')[0]
                            || 'User';
                        setFirstName(name);
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
        router.push('/');
    };

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

                <div className={styles.navActions}>
                    {isLoggedIn ? (
                        <>
                            <Link href={`/client/${userId}`} className={styles.welcomeLink}>
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
