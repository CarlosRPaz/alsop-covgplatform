import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { fetchEagleViewPropertyData } from '@/lib/eagleview';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Verify the user is an admin
        const token = authHeader.split(' ')[1];
        const admin = getSupabaseAdmin();
        const { data: { user }, error: userError } = await admin.auth.getUser(token);

        if (userError || !user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await admin
            .from('accounts')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Parse payload
        let body: { address: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
        }

        const { address } = body;
        if (!address || typeof address !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid "address" field' }, { status: 400 });
        }

        // Fetch EagleView data
        logger.info('Admin', 'EagleView Sandbox test initiated', { address, userId: user.id });
        
        try {
            const evResponse = await fetchEagleViewPropertyData(address);
            return NextResponse.json({ success: true, payload: evResponse });
        } catch (evErr: any) {
            return NextResponse.json({ 
                success: false, 
                message: evErr.message || 'EagleView API Error',
                details: evErr
            }, { status: 502 });
        }

    } catch (error) {
        logger.error('Admin', 'Unexpected error in EagleView test route', { error });
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
