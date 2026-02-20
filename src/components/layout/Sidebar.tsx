'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.scss';
import { supabase } from '@/lib/supabaseClient';
import {
    LayoutDashboard,
    FileText,
    Settings,
    Users,
    PieChart,
    Bell,
    ShieldCheck,
    LogOut,
    UserCircle
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setUserId(session.user.id);
        });
    }, []);

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Submit Declaration', href: '/submit', icon: FileText },
        { label: 'Coverage Review', href: '#', icon: ShieldCheck },
        { label: 'Analytics', href: '#', icon: PieChart },
    ];

    const accountItems = [
        ...(userId ? [{ label: 'My Profile', href: `/client/${userId}`, icon: UserCircle }] : []),
        { label: 'Users', href: '#', icon: Users },
        { label: 'Notifications', href: '#', icon: Bell },
        { label: 'Settings', href: '#', icon: Settings },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brand}>
                <span>A</span> Alsop CFP Review
            </div>

            <nav className={styles.nav}>
                <div className={styles.sectionTitle}>Main Menu</div>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={clsx(styles.navItem, isActive && styles.active)}
                        >
                            <item.icon />
                            {item.label}
                        </Link>
                    );
                })}

                <div className={styles.sectionTitle} style={{ marginTop: '2rem' }}>Account</div>
                {accountItems.map((item) => {
                    const isActive = pathname.startsWith(item.href) && item.href !== '#';
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={clsx(styles.navItem, isActive && styles.active)}
                        >
                            <item.icon />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <button onClick={handleLogout} className={styles.navItem} style={{ paddingLeft: 0, border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <LogOut />
                    Logout
                </button>
                <div style={{ marginTop: '1rem' }}>
                    &copy; 2026 Alsop Inc
                </div>
            </div>
        </aside>
    );
}
