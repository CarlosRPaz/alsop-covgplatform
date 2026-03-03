'use client';

import { useEffect, useState } from 'react';
import { CFPForm } from '@/components/forms/CFPForm';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Shield, LogIn, UserPlus, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';

export default function SubmitPage() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    // ---------------------------------------------------------------
    // Auth state detection (reuses existing Supabase patterns)
    // ---------------------------------------------------------------
    useEffect(() => {
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            setUserId(session?.user?.id ?? null);
            setAuthLoading(false);
        }
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id ?? null);
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const isAuthed = !!userId;

    return (
        <main style={{ minHeight: '100vh', padding: '1.5rem', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Background decorations */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: -1
            }} />

            <div style={{ width: '100%', maxWidth: '700px' }}>
                <div style={{ display: 'flex', marginBottom: '2rem' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }}>
                        <ChevronLeft style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                        Back to Home
                    </Link>
                </div>

                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>Submit a Declaration</h1>
                    <p style={{ color: '#94a3b8' }}>
                        {isAuthed
                            ? 'Upload your declarations page for a comprehensive coverage review.'
                            : 'Sign in or create an account to submit your declarations page.'}
                    </p>
                </div>

                {authLoading ? (
                    <AuthLoadingSkeleton />
                ) : isAuthed ? (
                    <CFPForm userId={userId!} />
                ) : (
                    <AuthGate />
                )}
            </div>
        </main>
    );
}

// ---------------------------------------------------------------
// Auth loading skeleton
// ---------------------------------------------------------------
function AuthLoadingSkeleton() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
        }}>
            <div style={{
                width: '2rem',
                height: '2rem',
                border: '3px solid rgba(59, 130, 246, 0.2)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ---------------------------------------------------------------
// Inline Auth Gate (login + signup, reuses signin page patterns)
// ---------------------------------------------------------------
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
                if (!firstName.trim() || !lastName.trim()) {
                    setError('First name and last name are required');
                    setLoading(false);
                    return;
                }
                if (!phoneNumber.trim()) {
                    setError('Phone number is required');
                    setLoading(false);
                    return;
                }
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setLoading(false);
                    return;
                }

                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            phone: phoneNumber.trim(),
                        },
                    },
                });

                if (signUpError) {
                    setError(signUpError.message);
                } else {
                    setSuccess('Account created! Please check your email for a confirmation link, then sign in.');
                    setIsSignUp(false);
                    setPassword('');
                    setConfirmPassword('');
                }
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInError) {
                    setError(signInError.message);
                }
                // On success, onAuthStateChange fires → page re-renders to upload UI
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = (toSignUp: boolean) => {
        setIsSignUp(toSignUp);
        setError(null);
        setSuccess(null);
    };

    return (
        <div style={{
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto',
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '1.25rem',
            padding: '2.5rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        }}>
            {/* Brand */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Shield size={28} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                        Gap Guard
                    </span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Sign in to submit your declaration
                </p>
            </div>

            {/* Tab Toggle */}
            <div style={{
                display: 'flex',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '0.75rem',
                padding: '4px',
                marginBottom: '1.75rem',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
                <button
                    onClick={() => resetForm(false)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 1rem',
                        border: 'none',
                        background: !isSignUp ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: !isSignUp ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: !isSignUp ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none',
                    }}
                >
                    <LogIn size={16} />
                    Sign In
                </button>
                <button
                    onClick={() => resetForm(true)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 1rem',
                        border: 'none',
                        background: isSignUp ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: isSignUp ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSignUp ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none',
                    }}
                >
                    <UserPlus size={16} />
                    Sign Up
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '0.625rem',
                        color: '#fca5a5',
                        fontSize: '0.875rem',
                    }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(34, 197, 94, 0.12)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        borderRadius: '0.625rem',
                        color: '#86efac',
                        fontSize: '0.875rem',
                    }}>
                        {success}
                    </div>
                )}

                {/* Sign-Up fields */}
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
            <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                {isSignUp ? (
                    <>
                        Already have an account?{' '}
                        <button onClick={() => resetForm(false)} style={{
                            background: 'none', border: 'none', color: '#60a5fa',
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', padding: 0,
                        }}>
                            Sign in
                        </button>
                    </>
                ) : (
                    <>
                        Don&apos;t have an account?{' '}
                        <button onClick={() => resetForm(true)} style={{
                            background: 'none', border: 'none', color: '#60a5fa',
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', padding: 0,
                        }}>
                            Create one
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------
// Reusable input field (matches signin page styling)
// ---------------------------------------------------------------
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
                position: 'absolute',
                left: '0.875rem',
                color: 'rgba(255,255,255,0.3)',
                pointerEvents: 'none',
                zIndex: 1,
                display: 'flex',
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
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '0.625rem',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                }}
            />
        </div>
    );
}
