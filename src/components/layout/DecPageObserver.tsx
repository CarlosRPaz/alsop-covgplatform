'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast/Toast';
import { supabase } from '@/lib/supabaseClient';

const TRACKING_KEY = 'cfp_pending_dec_uploads';

/**
 * A headless component that mounts globally in the Authenticated Layout.
 * It checks sessionStorage for any recently uploaded Dec Page submission IDs.
 * If any are found, it silently polls /api/upload/status every 3 seconds.
 * When a submission reaches 'parsed' or 'failed', it fires a Toast notification
 * and removes the ID from storage.
 */
export function DecPageObserver() {
    const { success, error, info } = useToast();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Polling function
        const checkStatuses = async () => {
            try {
                const stored = sessionStorage.getItem(TRACKING_KEY);
                if (!stored) return;
                
                let pendingIds: string[] = [];
                try {
                    pendingIds = JSON.parse(stored);
                } catch {
                    sessionStorage.removeItem(TRACKING_KEY);
                    return;
                }

                if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
                    return;
                }

                // Get auth token for secure API route
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch(`/api/upload/status?ids=${pendingIds.join(',')}`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!res.ok) return;
                
                const json = await res.json();
                if (!json.success || !json.data) return;

                const dbStatuses = json.data as Array<{
                    id: string;
                    status: string;
                    error_message?: string;
                    file_name: string;
                }>;

                // Process updates
                let stillPending = [...pendingIds];

                for (const row of dbStatuses) {
                    if (row.status === 'parsed') {
                        success(`Declaration processed successfully: ${row.file_name}`);
                        // Dispatch generic event so dashboard tables can auto-refresh
                        window.dispatchEvent(new CustomEvent('decPageParsed'));
                        stillPending = stillPending.filter(id => id !== row.id);
                    } else if (row.status === 'failed') {
                        error(`Failed to process ${row.file_name}: ${row.error_message || 'Unknown error'}`);
                        stillPending = stillPending.filter(id => id !== row.id);
                    } else if (row.status === 'duplicate') {
                        info(`${row.file_name} was recognized as a duplicate upload.`);
                        stillPending = stillPending.filter(id => id !== row.id);
                    }
                    // pending, uploaded, queued, processing -> keep waiting
                }

                // If any IDs are missing from DB completely, stop tracking them
                const dbIds = new Set(dbStatuses.map(r => r.id));
                stillPending = stillPending.filter(id => dbIds.has(id));

                if (stillPending.length === 0) {
                    sessionStorage.removeItem(TRACKING_KEY);
                } else if (stillPending.length !== pendingIds.length) {
                    sessionStorage.setItem(TRACKING_KEY, JSON.stringify(stillPending));
                }

            } catch (err) {
                console.error('[DecPageObserver] Polling error:', err);
            }
        };

        // Poll immediately, then every 3 seconds
        checkStatuses();
        intervalRef.current = setInterval(checkStatuses, 3000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [success, error, info]);

    // Headless component
    return null;
}
