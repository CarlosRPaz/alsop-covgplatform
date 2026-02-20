'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button/Button';
import { Shield, Mail, Lock, ArrowRight, UserPlus, LogIn, User, Phone } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

export default function SignInPage() {
    const router = useRouter();
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
                // Validate sign-up fields
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
                } else {
                    router.push('/dashboard');
                }
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
        <div className={styles.container}>
            <div className={styles.formWrapper}>
                {/* Brand Header */}
                <div className={styles.brandHeader}>
                    <Link href="/" className={styles.brandLink}>
                        <Shield size={32} className={styles.brandIcon} />
                        <span className={styles.brandName}>Gap Guard</span>
                    </Link>
                    <p className={styles.brandTagline}>
                        Intelligent coverage gap analysis
                    </p>
                </div>

                {/* Tab Toggle */}
                <div className={styles.tabToggle}>
                    <button
                        className={`${styles.tab} ${!isSignUp ? styles.activeTab : ''}`}
                        onClick={() => resetForm(false)}
                    >
                        <LogIn size={16} />
                        Sign In
                    </button>
                    <button
                        className={`${styles.tab} ${isSignUp ? styles.activeTab : ''}`}
                        onClick={() => resetForm(true)}
                    >
                        <UserPlus size={16} />
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className={styles.successAlert}>
                            {success}
                        </div>
                    )}

                    {/* Sign-Up Only Fields */}
                    {isSignUp && (
                        <>
                            <div className={styles.nameRow}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>First Name <span className={styles.required}>*</span></label>
                                    <div className={styles.inputWrapper}>
                                        <User size={18} className={styles.inputIcon} />
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="John"
                                            className={styles.input}
                                            required
                                            autoComplete="given-name"
                                        />
                                    </div>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Last Name <span className={styles.required}>*</span></label>
                                    <div className={styles.inputWrapper}>
                                        <User size={18} className={styles.inputIcon} />
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Doe"
                                            className={styles.input}
                                            required
                                            autoComplete="family-name"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Phone Number <span className={styles.required}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <Phone size={18} className={styles.inputIcon} />
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="(555) 123-4567"
                                        className={styles.input}
                                        required
                                        autoComplete="tel"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Email <span className={styles.required}>*</span></label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.inputIcon} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className={styles.input}
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Password <span className={styles.required}>*</span></label>
                        <div className={styles.inputWrapper}>
                            <Lock size={18} className={styles.inputIcon} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isSignUp ? 'Min. 6 characters' : '••••••••'}
                                className={styles.input}
                                required
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            />
                        </div>
                    </div>

                    {isSignUp && (
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Confirm Password <span className={styles.required}>*</span></label>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.inputIcon} />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    className={styles.input}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        isLoading={loading}
                        className={styles.submitButton}
                    >
                        {isSignUp ? 'Create Account' : 'Sign In'}
                        <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                    </Button>
                </form>

                {/* Footer Toggle */}
                <div className={styles.toggleText}>
                    {isSignUp ? (
                        <>
                            Already have an account?{' '}
                            <button className={styles.toggleLink} onClick={() => resetForm(false)}>
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            Don&apos;t have an account?{' '}
                            <button className={styles.toggleLink} onClick={() => resetForm(true)}>
                                Create one
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
