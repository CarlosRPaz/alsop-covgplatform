'use client';

import { useEffect, useState } from 'react';
import { CFPForm } from '@/components/forms/CFPForm';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Shield, LogIn, UserPlus, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';
import type { UserRole } from '@/lib/auth';

export default function SubmitPage() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<UserRole | undefined>(undefined);

    useEffect(() => {
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            if (uid) {
                const { data } = await supabase.from('accounts').select('role').eq('id', uid).single();
                setUserRole((data?.role as UserRole) || undefined);
            }
            setAuthLoading(false);
        }
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            if (uid) {
                const { data } = await supabase.from('accounts').select('role').eq('id', uid).single();
                setUserRole((data?.role as UserRole) || undefined);
            }
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const isAuthed = !!userId;

    return (
        <main style={{
            minHeight: '100vh',
            padding: '3rem 1.5rem',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'var(--bg-default)',
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute',
                top: '-10%', right: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(34,67,182,0.12) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            <div style={{ width: '100%', maxWidth: '700px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', marginBottom: '2rem' }}>
                    <Link href="/" style={{
                        display: 'inline-flex', alignItems: 'center',
                        color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s',
                    }}>
                        <ChevronLeft style={{ width: '1rem', height: '1rem', marginRight: '0.3rem' }} />
                        Back to Home
                    </Link>
                </div>
                {/* ─── Removed Redundant Header ─── */}

                {authLoading ? (
                    <AuthLoadingSkeleton />
                ) : isAuthed ? (
                    <CFPForm userId={userId!} userRole={userRole} />
                ) : (
                    <AuthGate />
                )}
            </div>
        </main>
    );
}

function AuthLoadingSkeleton() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
            <div style={{
                width: '2rem', height: '2rem',
                border: '3px solid var(--accent-primary-muted)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
        </div>
    );
}

function AuthGate() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            if (isSignUp) {
                if (!firstName.trim() || !lastName.trim()) { setError('First name and last name are required'); setLoading(false); return; }
                if (!phoneNumber.trim()) { setError('Phone number is required'); setLoading(false); return; }
                if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
                if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }

                const { error: signUpError } = await supabase.auth.signUp({
                    email, password,
                    options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: phoneNumber.trim() } },
                });
                if (signUpError) { setError(signUpError.message); }
                else { setSuccess('Account created! Please check your email for a confirmation link, then sign in.'); setIsSignUp(false); setPassword(''); setConfirmPassword(''); }
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) { setError(signInError.message); }
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = (toSignUp: boolean) => { setIsSignUp(toSignUp); setError(null); setSuccess(null); };

    return (
        <div style={{
            width: '100%', maxWidth: '480px', margin: '0 auto',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem',
            boxShadow: 'var(--shadow-overlay)',
        }}>
            {/* Brand */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-high)', letterSpacing: '-0.02em' }}>
                        CoverageCheckNow
                    </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Sign in to submit your declaration
                </p>
            </div>

            {/* Tab Toggle */}
            <div style={{
                display: 'flex',
                background: 'var(--accent-primary-muted)',
                borderRadius: 'var(--radius-lg)', padding: '4px',
                marginBottom: '1.75rem',
                border: '1px solid var(--border-default)',
            }}>
                <button onClick={() => resetForm(false)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.625rem 1rem', border: 'none',
                    background: !isSignUp ? 'var(--accent-primary)' : 'transparent',
                    color: !isSignUp ? 'var(--text-inverse)' : 'var(--text-muted)',
                    fontSize: '0.875rem', fontWeight: 600, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}>
                    <LogIn size={16} /> Sign In
                </button>
                <button onClick={() => resetForm(true)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.625rem 1rem', border: 'none',
                    background: isSignUp ? 'var(--accent-primary)' : 'transparent',
                    color: isSignUp ? 'var(--text-inverse)' : 'var(--text-muted)',
                    fontSize: '0.875rem', fontWeight: 600, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}>
                    <UserPlus size={16} /> Sign Up
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-error-subtle)',
                        border: '1px solid rgba(191,25,50,0.2)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--status-error)', fontSize: '0.875rem', fontWeight: 500,
                    }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-success-subtle)',
                        border: '1px solid rgba(43,155,75,0.2)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--status-success)', fontSize: '0.875rem', fontWeight: 500,
                    }}>
                        {success}
                    </div>
                )}

                {isSignUp && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <InputField icon={<User size={18} />} type="text" placeholder="First Name"
                                value={firstName} onChange={setFirstName} required autoComplete="given-name" />
                            <InputField icon={<User size={18} />} type="text" placeholder="Last Name"
                                value={lastName} onChange={setLastName} required autoComplete="family-name" />
                        </div>
                        <InputField icon={<Phone size={18} />} type="tel" placeholder="(555) 123-4567"
                            value={phoneNumber} onChange={setPhoneNumber} required autoComplete="tel" />
                    </>
                )}

                <InputField icon={<Mail size={18} />} type="email" placeholder="you@example.com"
                    value={email} onChange={setEmail} required autoComplete="email" />

                <InputField icon={<Lock size={18} />} type="password"
                    placeholder={isSignUp ? 'Min. 6 characters' : '••••••••'}
                    value={password} onChange={setPassword} required
                    autoComplete={isSignUp ? 'new-password' : 'current-password'} />

                {isSignUp && (
                    <InputField icon={<Lock size={18} />} type="password" placeholder="Re-enter password"
                        value={confirmPassword} onChange={setConfirmPassword} required autoComplete="new-password" />
                )}

                <Button type="submit" fullWidth isLoading={loading} style={{ marginTop: '0.5rem' }}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                </Button>
            </form>

            {/* Toggle */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {isSignUp ? (
                    <>
                        Already have an account?{' '}
                        <button onClick={() => resetForm(false)} style={{
                            background: 'none', border: 'none', color: 'var(--text-accent)',
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', padding: 0,
                        }}>Sign in</button>
                    </>
                ) : (
                    <>
                        Don&apos;t have an account?{' '}
                        <button onClick={() => resetForm(true)} style={{
                            background: 'none', border: 'none', color: 'var(--text-accent)',
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', padding: 0,
                        }}>Create one</button>
                    </>
                )}
            </div>
        </div>
    );
}

function InputField({ icon, type, placeholder, value, onChange, required, autoComplete }: {
    icon: React.ReactNode;
    type: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
    autoComplete?: string;
}) {
    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{
                position: 'absolute', left: '0.875rem',
                color: 'var(--text-muted)',
                pointerEvents: 'none', zIndex: 1, display: 'flex',
            }}>
                {icon}
            </span>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                autoComplete={autoComplete}
                style={{
                    width: '100%',
                    padding: '0.75rem 0.875rem 0.75rem 2.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-high)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                }}
            />
        </div>
    );
}

