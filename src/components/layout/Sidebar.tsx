'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.scss';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from './SidebarContext';
import { SidebarSearch } from './SidebarSearch';
import { SidebarRecent } from './SidebarRecent';
import { type UserRole } from '@/lib/auth';
import {
    LayoutDashboard,
    FileText,
    Settings,
    LogOut,
    UserCircle,
    Shield,
    ChevronsLeft,
    ChevronsRight,
    Flag,
    Briefcase,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
    userRole?: UserRole | null;
}

export function Sidebar({ userRole }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { collapsed, toggle } = useSidebar();

    const isAgent = userRole === 'admin' || userRole === 'service';
    const isClient = userRole === 'customer';

    // Agent nav items
    const agentNavItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Flags', href: '/flags', icon: Flag },
        { label: 'Submit Declaration', href: '/submit', icon: FileText },
    ];

    // Client nav items
    const clientNavItems = [
        { label: 'My Portal', href: '/portal', icon: Briefcase },
        { label: 'Submit Declaration', href: '/submit', icon: FileText },
    ];

    const navItems = isClient ? clientNavItems : agentNavItems;

    const accountItems = [
        { label: 'Settings', href: '/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
            <div className={styles.brandRow}>
                <Link href="/" className={styles.brand} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Shield size={22} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    {!collapsed && <span className={styles.brandText}>CoverageCheckNow</span>}
                </Link>
                <button className={styles.collapseBtn} onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                </button>
            </div>

            {/* Global Search — agents only */}
            {isAgent && (
                <div style={{ padding: '0.75rem 0 0.25rem' }}>
                    <SidebarSearch collapsed={collapsed} />
                </div>
            )}

            {/* Recently Visited — agents only */}
            {isAgent && <SidebarRecent collapsed={collapsed} />}

            <nav className={styles.nav}>
                {!collapsed && <div className={styles.sectionTitle}>{isClient ? 'Menu' : 'Main Menu'}</div>}
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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
