import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * GET /api/documents/upload/status?ids=id1,id2,...
 * 
 * Returns the current processing status of one or more platform documents.
 * Used by the frontend to poll for processing progress.
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate
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
                { error: 'Session expired' },
                { status: 401 }
            );
        }

        // Parse document IDs
        const idsParam = request.nextUrl.searchParams.get('ids');
        if (!idsParam) {
            return NextResponse.json(
                { error: 'Missing ids parameter' },
                { status: 400 }
            );
        }

        const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length === 0 || ids.length > 20) {
            return NextResponse.json(
                { error: 'Provide 1-20 document IDs' },
                { status: 400 }
            );
        }

        // Fetch statuses
        const admin = getSupabaseAdmin();
        const { data, error } = await admin
            .from('platform_documents')
            .select(`
                id,
                doc_type,
                file_name,
                parse_status,
                processing_step,
                match_status,
                match_confidence,
                match_log,
                error_message,
                policy_id,
                client_id,
                policy_term_id,
                extracted_owner_name,
                extracted_address,
                writeback_status,
                writeback_log,
                created_at,
                updated_at,
                policies:policy_id (
                    id,
                    policy_number,
                    carrier_name
                ),
                clients:client_id (
                    id,
                    named_insured
                )
            `)
            .in('id', ids)
            .eq('account_id', user.id);

        if (error) {
            logger.error('DocumentStatus', 'Failed to fetch statuses', { error: error.message });
            return NextResponse.json(
                { error: 'Failed to fetch document statuses' },
                { status: 500 }
            );
        }

        // Enrich with human-readable status messages
        const enriched = (data || []).map(doc => ({
            ...doc,
            status_message: getStatusMessage(doc),
            action_required: getActionRequired(doc),
        }));

        return NextResponse.json({ documents: enriched });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('DocumentStatus', 'Unexpected error', { error: msg });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Generate human-readable status message for agent UI.
 */
function getStatusMessage(doc: Record<string, unknown>): string {
    const parseStatus = doc.parse_status as string;
    const matchStatus = doc.match_status as string;
    const step = doc.processing_step as string;

    if (parseStatus === 'failed') {
        return `Processing failed: ${doc.error_message || 'Unknown error'}`;
    }

    if (parseStatus === 'processing') {
        const stepLabels: Record<string, string> = {
            'extracting_text': 'Extracting text from document...',
            'parsing_fields': 'Parsing document fields...',
            'matching_policy': 'Matching to policy...',
            'saving_data': 'Saving extracted data...',
            'writing_policy_data': 'Updating policy records...',
            'complete': 'Finishing up...',
        };
        return stepLabels[step] || 'Processing...';
    }

    if (parseStatus === 'pending') {
        return 'Queued for processing...';
    }

    if (parseStatus === 'needs_review' || matchStatus === 'needs_review') {
        return `Review needed: ${doc.error_message || 'Policy match requires confirmation'}`;
    }

    if (matchStatus === 'no_match') {
        return 'No matching policy found. Manual assignment required.';
    }

    if (parseStatus === 'parsed' && matchStatus === 'matched') {
        return 'Successfully processed and linked to policy.';
    }

    return 'Processing complete.';
}

/**
 * Determine if agent action is required and what kind.
 */
function getActionRequired(doc: Record<string, unknown>): string | null {
    const matchStatus = doc.match_status as string;
    const parseStatus = doc.parse_status as string;

    if (matchStatus === 'needs_review') {
        return 'review_match';
    }
    if (matchStatus === 'no_match') {
        return 'assign_policy';
    }
    if (parseStatus === 'failed') {
        return 'retry_or_escalate';
    }
    if ((doc.writeback_status as string) === 'conflict') {
        return 'resolve_conflicts';
    }
    return null;
}
