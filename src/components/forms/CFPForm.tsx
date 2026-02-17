'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import styles from './CFPForm.module.scss';
import { Upload } from 'lucide-react';

export function CFPForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        console.log("Submitting file:", file?.name);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setIsLoading(false);
        alert('Declarations Page submitted for review! (Mock)');
    };

    return (
        <Card className={styles.formContainer} variant="glass">
            <div className={styles.header}>
                <h2 className={styles.title}>Submit for Coverage Review</h2>
                <p className={styles.description}>
                    Don't let gaps in your California Fair Plan coverage check leave you exposed.
                    Submit your current Declarations Page now for a comprehensive professional review.
                    We'll analyze your policy and identify missing coverage to ensure you're fully protected.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label htmlFor="firstName" className={styles.label}>First Name</label>
                        <input type="text" id="firstName" className={styles.input} placeholder="Jane" required />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="lastName" className={styles.label}>Last Name</label>
                        <input type="text" id="lastName" className={styles.input} placeholder="Doe" required />
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.label}>Email Address</label>
                        <input type="email" id="email" className={styles.input} placeholder="jane@example.com" required />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="phone" className={styles.label}>Phone Number</label>
                        <input type="tel" id="phone" className={styles.input} placeholder="(555) 000-0000" required />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Upload Declarations Page (PDF, Images)</label>
                    <div className={styles.fileInputContainer}>
                        <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            required
                        />
                        <Upload className={styles.uploadIcon} size={24} />
                        <span className={styles.uploadText}>
                            {file ? file.name : "Click to upload or drag and drop"}
                        </span>
                        <span className={styles.uploadHint}>Supported formats: PDF, PNG, JPG</span>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className={styles.termsSection}>
                    <h3 className={styles.termsTitle}>Terms and Conditions</h3>
                    <div className={styles.termsContent}>
                        <p><strong>DISCLAIMER: TEMPORARY PLACEHOLDER TEXT</strong></p>
                        <p>
                            This document contains temporary filler text and placeholder content for demonstration
                            purposes only. This text is explicitly NOT intended to serve as legally binding terms
                            and conditions, nor does it constitute a valid legal agreement between any parties.
                        </p>
                        <p>
                            By using this service, you acknowledge and agree that: (1) This placeholder text cannot
                            be used, cited, or referenced in any court of law or legal proceeding; (2) We explicitly
                            state that this is dummy text created solely for development and testing purposes;
                            (3) Neither the platform owners, developers, nor any affiliated parties shall be held
                            accountable, liable, or responsible for any interpretation or misuse of this temporary
                            content.
                        </p>
                        <p>
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
                            ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                            ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                        </p>
                        <p>
                            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                            mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a
                            odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit.
                        </p>
                        <p>
                            <em>This placeholder will be replaced with official Terms and Conditions before
                                production deployment.</em>
                        </p>
                    </div>
                    <div className={styles.termsCheckbox}>
                        <input type="checkbox" id="acceptTerms" required />
                        <label htmlFor="acceptTerms">
                            I have read and agree to the Terms and Conditions
                        </label>
                    </div>
                </div>

                <Button type="submit" fullWidth isLoading={isLoading}>
                    Submit for Review
                </Button>
            </form>
        </Card>
    );
}
