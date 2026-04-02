import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// ---------------------------------------------------------------------------
// GET /api/csv-import/progress?batchId=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();

        // Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
        }

        const token = authHeader.slice(7);
        const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { error: authError } = await userClient.auth.getUser(token);
        if (authError) {
            return NextResponse.json({ error: 'AUTH_INVALID' }, { status: 401 });
        }

        const batchId = request.nextUrl.searchParams.get('batchId');
        if (!batchId) {
            return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
        }

        const { data: batch, error: batchErr } = await supabaseAdmin
            .from('policy_import_batches')
            .select('status, progress_pct, progress_message')
            .eq('id', batchId)
            .single();

        if (batchErr || !batch) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: batch.status,
            progress_pct: batch.progress_pct ?? 0,
            progress_message: batch.progress_message ?? '',
        });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
