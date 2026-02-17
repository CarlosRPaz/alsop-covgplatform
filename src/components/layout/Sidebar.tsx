'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.scss';
import {
    LayoutDashboard,
    FileText,
    Settings,
    Users,
    PieChart,
    Bell,
    ShieldCheck,
    LogOut
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Submit Declaration', href: '/submit', icon: FileText },
        { label: 'Coverage Review', href: '#', icon: ShieldCheck },
        { label: 'Analytics', href: '#', icon: PieChart },
    ];

    const accountItems = [
        { label: 'Users', href: '#', icon: Users },
        { label: 'Notifications', href: '#', icon: Bell },
        { label: 'Settings', href: '#', icon: Settings },
    ];

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
                {accountItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={styles.navItem}
                    >
                        <item.icon />
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className={styles.footer}>
                <Link href="/" className={styles.navItem} style={{ paddingLeft: 0 }}>
                    <LogOut />
                    Logout
                </Link>
                <div style={{ marginTop: '1rem' }}>
                    &copy; 2026 Alsop Inc
                </div>
            </div>
        </aside>
    );
}
