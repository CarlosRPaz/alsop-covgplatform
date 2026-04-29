import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getEagleViewToken } from '@/lib/eagleview';
import { logger } from '@/lib/logger';

export async function GET(
    request: Request,
    context: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await context.params;
        if (!token) {
            return NextResponse.json({ success: false, message: 'Missing image token' }, { status: 400 });
        }

        // Accept session via query string (?session=) for <img> tags, or via cookies
        const url = new URL(request.url);
        const querySession = url.searchParams.get('session');

        if (!querySession) {
            logger.error('Admin', 'EagleView image: no session token provided');
            return NextResponse.json({ success: false, message: 'No session token' }, { status: 401 });
        }

        // Validate session with admin client
        const admin = getSupabaseAdmin();
        
        let user;
        try {
            const { data, error } = await admin.auth.getUser(querySession);
            if (error) {
                logger.error('Admin', 'EagleView image: auth.getUser failed', { error: error.message });
                return NextResponse.json({ success: false, message: 'Auth failed: ' + error.message }, { status: 401 });
            }
            user = data.user;
        } catch (authErr: any) {
            logger.error('Admin', 'EagleView image: auth exception', { error: authErr.message });
            return NextResponse.json({ success: false, message: 'Auth exception' }, { status: 401 });
        }

        if (!user) {
            return NextResponse.json({ success: false, message: 'No user found' }, { status: 401 });
        }

        // Check role
        const { data: profile } = await admin
            .from('accounts')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'service') {
            logger.error('Admin', 'EagleView image: forbidden role', { role: profile?.role, userId: user.id });
            return NextResponse.json({ success: false, message: 'Forbidden: role=' + profile?.role }, { status: 403 });
        }

        // Fetch EagleView image
        const evToken = await getEagleViewToken();
        const baseUrl = process.env.EAGLEVIEW_API_BASE_URL || 'https://sandbox.apis.eagleview.com';
        const imageUrl = `${baseUrl}/property/v2/image/${token}`;

        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${evToken}` }
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error('Admin', 'EagleView image fetch failed', { status: response.status, errText: errText.substring(0, 200) });
            return NextResponse.json({ success: false, message: `EagleView: ${response.status}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const imageBuffer = await response.arrayBuffer();

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(imageBuffer.byteLength),
                'Cache-Control': 'public, max-age=86400, s-maxage=86400'
            }
        });

    } catch (error: any) {
        logger.error('Admin', 'EagleView image: uncaught error', { error: error.message, stack: error.stack?.substring(0, 300) });
        return NextResponse.json({ success: false, message: 'Internal error: ' + error.message }, { status: 500 });
    }
}
