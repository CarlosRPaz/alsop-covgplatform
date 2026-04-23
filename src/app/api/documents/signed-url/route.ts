import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * POST /api/documents/signed-url
 *
 * Generate a signed download URL for a file in Supabase Storage.
 * Uses the admin client so RLS on private buckets is bypassed.
 *
 * Body: { storagePath: string, bucket?: string }
 * Returns: { signedUrl: string }
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const token = authHeader.slice(7);
        const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Invalid or expired session' },
                { status: 401 }
            );
        }

        // 2. Parse body
        const body = await request.json();
        const { storagePath, bucket = 'cfp-raw-decpage' } = body;

        if (!storagePath || typeof storagePath !== 'string') {
            return NextResponse.json(
                { error: 'storagePath is required' },
                { status: 400 }
            );
        }

        // 3. Generate signed URL with admin client (bypasses RLS)
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.storage
            .from(bucket)
            .createSignedUrl(storagePath, 3600); // 1 hour

        if (error || !data?.signedUrl) {
            logger.error('SignedURL', 'Failed to create signed URL', {
                message: error?.message,
                storagePath,
                bucket,
            });
            return NextResponse.json(
                { error: error?.message || 'Failed to generate URL' },
                { status: 500 }
            );
        }

        return NextResponse.json({ signedUrl: data.signedUrl });
    } catch (err) {
        logger.error('SignedURL', 'Unexpected error', {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
