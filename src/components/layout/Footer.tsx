'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfile } from '@/lib/auth';
import { SupportModal } from '@/components/shared/SupportModal';
import styles from './Footer.module.css';

export function Footer() {
    const currentYear = new Date().getFullYear();
    const [supportOpen, setSupportOpen] = useState(false);
    const [userName, setUserName] = useState<string | undefined>(undefined);
    const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

    useEffect(() => {
        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserEmail(session.user.email || undefined);
                const profile = await getUserProfile();
                if (profile?.first_name) setUserName(`${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`);
                else if (session.user.email) setUserName(undefined);
            }
        }
        checkAuth();
    }, []);

    return (<>
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.grid}>
                    {/* Company Info */}
                    <div>
                        <div className={styles.logoWrapper}>
                            <FileText className={styles.logoIcon} />
                            <span className={styles.logoText}>CoverageCheckNow</span>
                        </div>
                        <p className={styles.description}>
                            Streamlining policy review and coverage analysis for insurance agents.
                        </p>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h3 className={styles.sectionTitle}>Product</h3>
                        <ul className={styles.linkList}>
                            <li>
                                <Link href="/dashboard" className={styles.link}>
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href="/submit" className={styles.link}>
                                    Submit Declaration
                                </Link>
                            </li>
                            <li>
                                <Link href="/flags" className={styles.link}>
                                    Flags
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div>
                        <h3 className={styles.sectionTitle}>Support</h3>
                        <ul className={styles.linkList}>
                            <li>
                                <Link href="/settings" className={styles.link}>
                                    Settings
                                </Link>
                            </li>
                            <li>
                                <button
                                    onClick={() => setSupportOpen(true)}
                                    className={styles.link}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                    <MessageSquare size={12} />
                                    Contact Support
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className={styles.sectionTitle}>Contact</h3>
                        <ul className={styles.linkList}>
                            <li className={styles.contactItem}>
                                <Mail className={styles.contactIcon} />
                                <a href="mailto:support@coveragechecknow.com" className={styles.contactLink}>
                                    support@coveragechecknow.com
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className={styles.bottomBar}>
                    <p className={styles.copyright}>
                        © {currentYear} CoverageCheckNow. All rights reserved.
                    </p>
                    <div className={styles.legalLinks}>
                        <Link href="/legal/privacy" className={styles.legalLink}>
                            Privacy Policy
                        </Link>
                        <Link href="/legal/terms" className={styles.legalLink}>
                            Terms of Service
                        </Link>
                        <Link href="/legal/cookies" className={styles.legalLink}>
                            Cookie Policy
                        </Link>
                    </div>
                </div>
            </div>
        </footer>

        <SupportModal
            isOpen={supportOpen}
            onClose={() => setSupportOpen(false)}
            clientName={userName}
            clientEmail={userEmail}
        />
    </>);
}
