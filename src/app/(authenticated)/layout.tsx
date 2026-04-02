'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { type UserRole } from '@/lib/auth';
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { ToastProvider } from "@/components/ui/Toast/Toast";
import { DecPageObserver } from "@/components/layout/DecPageObserver";
import { Menu } from 'lucide-react';

// Routes that customers are allowed to access
const CLIENT_ALLOWED_ROUTES = ['/portal', '/submit', '/profile', '/settings', '/policy'];

function AuthenticatedContent({ children, userRole }: { children: React.ReactNode; userRole: UserRole | null }) {
    const { collapsed, isMobile, setMobileOpen } = useSidebar();
    const pathname = usePathname();
    const router = useRouter();

    // Route guard: redirect customers away from agent-only pages
    useEffect(() => {
        if (userRole === 'customer') {
            const isAllowed = CLIENT_ALLOWED_ROUTES.some(route => pathname.startsWith(route));
            if (!isAllowed) {
                router.replace('/portal');
            }
        }
    }, [userRole, pathname, router]);

    const sidebarOffset = isMobile ? 0 : (collapsed ? 64 : 240);

    return (
        <div style={{ display: 'flex', flex: 1 }}>
            <Sidebar userRole={userRole} />
            <div style={{
                flex: 1,
                marginLeft: `${sidebarOffset}px`,
                minWidth: 0,
                overflowX: 'hidden',
                backgroundColor: 'var(--background)',
                display: 'flex',
                flexDirection: 'column',
                transition: isMobile ? 'none' : 'margin-left 0.2s ease',
            }}>
                {/* Top bar with hamburger (mobile) + global search */}
                <div style={{
                    padding: isMobile ? '0.375rem 0.5rem' : '0.75rem 2rem',
                    borderBottom: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}>
                    {/* Hamburger button — mobile only */}
                    {isMobile && (
                        <button
                            onClick={() => setMobileOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                background: 'transparent',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-mid)',
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                            aria-label="Open menu"
                        >
                            <Menu size={20} />
                        </button>
                    )}

                    {/* Global Search Bar — agents only, takes remaining space */}
                    {userRole !== 'customer' && (
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <GlobalSearch />
                        </div>
                    )}

                    {/* On mobile, if customer, still show brand */}
                    {userRole === 'customer' && isMobile && (
                        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            CoverageCheckNow
                        </span>
                    )}
                </div>

                <div style={{
                    flex: 1,
                    padding: isMobile ? '0.5rem' : '2rem',
                }}>
                    {children}
                </div>
                <Footer />
            </div>
        </div>
    );
}

export default function AuthenticatedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const router = useRouter();
    const [authState, setAuthState] = useState<'loading' | 'authorized' | 'no-access'>('loading');
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        let isMounted = true;

        async function checkRoleAccess(userId: string) {
            try {
                console.log('[Auth] Fetching profile for user:', userId);

                const { data, error, status, statusText } = await supabase
                    .from('accounts')
                    .select('role')
                    .eq('id', userId)
                    .single();

                if (!isMounted) return;

                if (error) {
                    console.error('[Auth] Profile fetch error:', {
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        status,
                        statusText,
                    });
                    setDebugInfo(`Profile fetch failed: ${error.message} (code: ${error.code}, status: ${status})`);
                    setAuthState('no-access');
                    return;
                }

                if (!data) {
                    console.error('[Auth] No profile data returned for user:', userId);
                    setDebugInfo('No profile found for your account.');
                    setAuthState('no-access');
                    return;
                }

                const role = data.role as UserRole;
                console.log('[Auth] User role:', role);
                setUserRole(role);

                if (role === 'admin' || role === 'service' || role === 'customer') {
                    console.log('[Auth] Access granted for role:', role);
                    setAuthState('authorized');
                } else {
                    console.log('[Auth] Access denied for role:', role);
                    setDebugInfo(`Role "${role}" does not have dashboard access.`);
                    setAuthState('no-access');
                }
            } catch (err) {
                console.error('[Auth] Unexpected error checking role:', err);
                if (isMounted) {
                    setDebugInfo(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
                    setAuthState('no-access');
                }
            }
        }

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;
            console.log('[Auth] Auth state changed:', event, session?.user?.id);

            if (!session) {
                console.log('[Auth] No session, redirecting to sign-in');
                router.replace('/auth/signin');
                return;
            }

            checkRoleAccess(session.user.id);
        });

        // Immediate session check
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (!isMounted) return;

            if (error) {
                console.error('[Auth] getSession error:', error);
                setDebugInfo(`Session error: ${error.message}`);
                router.replace('/auth/signin');
                return;
            }

            if (!session) {
                console.log('[Auth] No active session found');
                router.replace('/auth/signin');
            } else {
                console.log('[Auth] Active session found for:', session.user.id, session.user.email);
                checkRoleAccess(session.user.id);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    // Loading state
    if (authState === 'loading') {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: 'var(--background)',
                color: 'var(--text-muted)',
                fontSize: '1rem',
            }}>
                Loading...
            </div>
        );
    }

    // No access (wrong role or error)
    if (authState === 'no-access') {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: 'var(--background)',
                color: 'var(--text-mid)',
                padding: '1.5rem',
                textAlign: 'center',
            }}>
                <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '2.5rem',
                    maxWidth: '520px',
                    width: '100%',
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'var(--bg-error-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '1.75rem',
                    }}>
                        🔒
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-high)' }}>
                        Access Restricted
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
                        Your account does not have permission to access the dashboard.
                        Only <strong style={{ color: 'var(--text-high)' }}>admin</strong> and <strong style={{ color: 'var(--text-high)' }}>service</strong> roles
                        are authorized.
                    </p>
                    {userRole && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            Your role: <code style={{ background: 'var(--accent-primary-muted)', padding: '2px 8px', borderRadius: '4px', color: 'var(--accent-primary)' }}>{userRole}</code>
                        </p>
                    )}
                    {debugInfo && (
                        <p style={{
                            color: 'var(--status-error)',
                            fontSize: '0.8rem',
                            marginBottom: '1.5rem',
                            background: 'var(--bg-error-subtle)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(191, 25, 50, 0.15)',
                            fontFamily: 'monospace',
                            wordBreak: 'break-word',
                        }}>
                            {debugInfo}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                padding: '0.625rem 1.5rem',
                                background: 'var(--accent-primary-muted)',
                                border: '1px solid var(--accent-primary)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                            }}
                        >
                            Go Home
                        </button>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                router.push('/auth/signin');
                            }}
                            style={{
                                padding: '0.625rem 1.5rem',
                                background: 'transparent',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-mid)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <ToastProvider>
                <DecPageObserver />
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <AuthenticatedContent userRole={userRole}>{children}</AuthenticatedContent>
                </div>
            </ToastProvider>
        </SidebarProvider>
    );
}
