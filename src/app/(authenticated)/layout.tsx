'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { type UserRole } from '@/lib/auth';
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";

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
                    .from('profiles')
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

                if (role === 'admin' || role === 'service') {
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
                color: 'rgba(255, 255, 255, 0.6)',
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
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '2rem',
                textAlign: 'center',
            }}>
                <div style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '1.25rem',
                    padding: '3rem',
                    maxWidth: '520px',
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '1.75rem',
                    }}>
                        🔒
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        Access Restricted
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '1rem' }}>
                        Your account does not have permission to access the dashboard.
                        Only <strong style={{ color: 'rgba(255,255,255,0.7)' }}>admin</strong> and <strong style={{ color: 'rgba(255,255,255,0.7)' }}>service</strong> roles
                        are authorized.
                    </p>
                    {userRole && (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            Your role: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{userRole}</code>
                        </p>
                    )}
                    {debugInfo && (
                        <p style={{
                            color: '#fca5a5',
                            fontSize: '0.8rem',
                            marginBottom: '1.5rem',
                            background: 'rgba(239, 68, 68, 0.08)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            fontFamily: 'monospace',
                            wordBreak: 'break-word',
                        }}>
                            {debugInfo}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                padding: '0.625rem 1.5rem',
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '0.5rem',
                                color: '#60a5fa',
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
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '0.5rem',
                                color: 'rgba(255,255,255,0.6)',
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
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ display: 'flex', flex: 1 }}>
                <Sidebar />
                <div style={{
                    flex: 1,
                    marginLeft: '250px',
                    minWidth: 0,
                    overflowX: 'hidden',
                    backgroundColor: 'var(--background)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ flex: 1, padding: '2rem' }}>
                        {children}
                    </div>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
