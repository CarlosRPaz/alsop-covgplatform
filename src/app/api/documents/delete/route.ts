import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        let body: { id: string; source: 'dec_page' | 'platform' };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
        }

        const { id, source } = body;
        if (!id || !source) {
            return NextResponse.json({ success: false, message: 'Missing id or source' }, { status: 400 });
        }

        const admin = getSupabaseAdmin();
        let bucket = '';
        let storagePath = null;

        // 1. Fetch record to get storage_path
        if (source === 'dec_page') {
            const { data, error } = await admin.from('dec_pages').select('storage_path, file_path').eq('id', id).single();
            if (error || !data) {
                return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
            }
            bucket = 'cfp-raw-decpage';
            storagePath = data.storage_path || data.file_path;
        } else if (source === 'platform') {
            const { data, error } = await admin.from('platform_documents').select('storage_path').eq('id', id).single();
            if (error || !data) {
                return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
            }
            bucket = 'cfp-platform-documents';
            storagePath = data.storage_path;
        } else {
            return NextResponse.json({ success: false, message: 'Invalid source' }, { status: 400 });
        }

        // 2. Delete from DB (this will automatically cascade or orphan if needed, but for files we just delete the row)
        // If it's a dec_page, deleting the dec_page will also remove it from the UI. 
        if (source === 'dec_page') {
            await admin.from('dec_pages').delete().eq('id', id);
            await admin.from('dec_page_submissions').delete().eq('duplicate_of', id); // Optionally clean up linked submissions
        } else {
            await admin.from('platform_documents').delete().eq('id', id);
        }

        // 3. Delete from Storage
        if (storagePath) {
            const { error: storageError } = await admin.storage.from(bucket).remove([storagePath]);
            if (storageError) {
                logger.warn('DocumentDelete', 'Failed to delete from storage', { bucket, storagePath, error: storageError });
            }
        }

        logger.info('DocumentDelete', 'Document successfully deleted', { id, source });
        return NextResponse.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        logger.error('DocumentDelete', 'Unexpected error', { error });
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
