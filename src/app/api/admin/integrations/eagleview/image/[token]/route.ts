import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getEagleViewToken } from '@/lib/eagleview';
import { logger } from '@/lib/logger';

export async function GET(
    request: Request,
    context: { params: Promise<{ token: string }> }
) {
    try {
        // Next.js 16: params is a Promise and must be awaited
        const { token } = await context.params;
        if (!token) {
            return NextResponse.json({ success: false, message: 'Missing image token' }, { status: 400 });
        }

        // Verify Authentication — accept via query string (for <img> tags) or Authorization header
        const url = new URL(request.url);
        const queryToken = url.searchParams.get('session');
        const authHeader = request.headers.get('authorization');
        
        const sessionToken = queryToken || (authHeader ? authHeader.replace('Bearer ', '') : null);

        if (!sessionToken) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await admin.auth.getUser(sessionToken);

        if (authError || !user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Check role from accounts table (same pattern as property-data-test route)
        const { data: profile } = await admin
            .from('accounts')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'service') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        // Fetch EagleView Access Token
        const evToken = await getEagleViewToken();
        const baseUrl = process.env.EAGLEVIEW_API_BASE_URL || 'https://sandbox.apis.eagleview.com';
        
        const imageUrl = `${baseUrl}/property/v2/image/${token}`;

        logger.info('Admin', 'Fetching EagleView image', { imageToken: token.substring(0, 8) + '...' });

        // Fetch the image from EagleView
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${evToken}`
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error('Admin', 'EagleView Image Fetch failed', { status: response.status, token: token.substring(0, 8), response: errText });
            return NextResponse.json({ success: false, message: `EagleView API error: ${response.status}` }, { status: response.status });
        }

        // Get the Content-Type from the EagleView response (usually image/png)
        const contentType = response.headers.get('content-type') || 'image/png';
        
        // Buffer the entire image and return as a complete response
        // (streaming response.body can fail in Next.js Turbopack)
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
        logger.error('Admin', 'Unexpected error in EagleView image route', { error: error.message });
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
