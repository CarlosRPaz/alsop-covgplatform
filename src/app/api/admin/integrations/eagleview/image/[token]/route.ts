import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEagleViewToken } from '@/lib/eagleview';
import { logger } from '@/lib/logger';

export async function GET(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        if (!token) {
            return NextResponse.json({ success: false, message: 'Missing image token' }, { status: 400 });
        }

        // Verify Authentication
        const url = new URL(request.url);
        const queryToken = url.searchParams.get('session');
        const authHeader = request.headers.get('authorization');
        
        const sessionToken = queryToken || (authHeader ? authHeader.replace('Bearer ', '') : null);

        if (!sessionToken) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);

        if (authError || !user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin or service
        const role = user.user_metadata?.role;
        if (role !== 'admin' && role !== 'service') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        // Fetch EagleView Access Token
        const evToken = await getEagleViewToken();
        const baseUrl = process.env.EAGLEVIEW_API_BASE_URL || 'https://sandbox.apis.eagleview.com';
        
        const imageUrl = `${baseUrl}/property/v2/image/${token}`;

        // Fetch the image from EagleView
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${evToken}`
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error('Admin', 'EagleView Image Fetch failed', { status: response.status, token, response: errText });
            return NextResponse.json({ success: false, message: `EagleView API error: ${response.status}` }, { status: response.status });
        }

        // Get the Content-Type from the EagleView response (usually image/jpeg)
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Return the image blob as a stream
        return new NextResponse(response.body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, s-maxage=86400' // Cache for 1 day
            }
        });

    } catch (error: any) {
        logger.error('Admin', 'Unexpected error in EagleView image route', { error: error.message });
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
