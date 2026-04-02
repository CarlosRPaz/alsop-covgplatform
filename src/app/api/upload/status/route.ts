import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');
        if (!ids) {
            return NextResponse.json({ success: false, message: 'Missing ids' }, { status: 400 });
        }

        const idArray = ids.split(',').filter(Boolean);
        if (idArray.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Must authenticate to prevent polling abuse, even though we use admin for DB read
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.slice(7);
        const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user } } = await userClient.auth.getUser(token);
        
        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();
        const { data, error } = await admin
            .from('dec_page_submissions')
            .select('id, status, error_message, file_name')
            .in('id', idArray)
            .eq('account_id', user.id); // Security: only their own submissions

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });

    } catch (err) {
        return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
    }
}
