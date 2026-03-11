'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.scss';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from './SidebarContext';
import {
    LayoutDashboard,
    FileText,
    Settings,
    LogOut,
    UserCircle,
    Shield,
    Home,
    ChevronsLeft,
    ChevronsRight,
    Flag,
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { collapsed, toggle } = useSidebar();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setUserId(session.user.id);
        });
    }, []);

    const navItems = [
        { label: 'Home', href: '/', icon: Home },
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Flags', href: '/flags', icon: Flag },
        { label: 'Submit Declaration', href: '/submit', icon: FileText },
    ];

    const accountItems = [
        ...(userId ? [{ label: 'My Profile', href: `/client/${userId}`, icon: UserCircle }] : []),
        { label: 'Settings', href: '#', icon: Settings },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
            <div className={styles.brandRow}>
                <Link href="/" className={styles.brand} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Shield size={22} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    {!collapsed && <span className={styles.brandText}>Gap Guard</span>}
                </Link>
                <button className={styles.collapseBtn} onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                </button>
            </div>

            <nav className={styles.nav}>
                {!collapsed && <div className={styles.sectionTitle}>Main Menu</div>}
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={clsx(styles.navItem, isActive && styles.active)}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}

                {!collapsed && <div className={styles.sectionTitle} style={{ marginTop: '2rem' }}>Account</div>}
                {collapsed && <div style={{ marginTop: '1.5rem' }} />}
                {accountItems.map((item) => {
                    const isActive = pathname.startsWith(item.href) && item.href !== '#';
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={clsx(styles.navItem, isActive && styles.active)}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <button
                    onClick={handleLogout}
                    className={styles.navItem}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%' }}
                    title={collapsed ? 'Logout' : undefined}
                >
                    <LogOut />
                    {!collapsed && <span>Logout</span>}
                </button>
                {!collapsed && (
                    <div style={{ marginTop: '1rem' }}>
                        &copy; 2026 Alsop Inc
                    </div>
                )}
            </div>
        </aside>
    );
}
