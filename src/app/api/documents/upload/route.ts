import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** Vercel function config */
export const maxDuration = 60;

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_TYPES = new Set(['application/pdf']);

/** Valid document types */
const VALID_DOC_TYPES = new Set([
    'rce',
    'dic_dec_page',
    'invoice',
    'inspection',
    'endorsement',
    'questionnaire',
]);

/** Storage bucket for platform documents */
const STORAGE_BUCKET = 'cfp-platform-documents';

/** API response types */
interface DocumentUploadResponse {
    success: boolean;
    message: string;
    data?: {
        documentId?: string;
        storagePath?: string;
        fileName?: string;
        fileSize?: number;
        docType?: string;
        submittedBy?: string;
        submittedAt?: string;
        existingDocumentId?: string;
        existingStatus?: string;
        existingMatchStatus?: string;
    };
    error?: string;
    errorCode?: string;
}

/**
 * GET /api/documents/upload — canary endpoint
 */
export async function GET() {
    return NextResponse.json({
        version: 'documents-v1',
        pipeline: 'platform-documents',
        supported_types: Array.from(VALID_DOC_TYPES),
    });
}

/**
 * POST /api/documents/upload
 *
 * Auth-required document upload pipeline for RCE, DIC, and future doc types.
 * 
 * FormData fields:
 *   - file: PDF file (required)
 *   - doc_type: 'rce' | 'dic_dec_page' | ... (required)
 *   - policy_id: UUID (optional — pre-link if uploading from policy page)
 *
 * Pipeline:
 *   1. Authenticate user via Bearer token
 *   2. Validate file and doc_type
 *   3. Hash file for dedup detection
 *   4. INSERT into platform_documents (parse_status='pending')
 *   5. Upload to cfp-platform-documents storage bucket
 *   6. UPDATE platform_documents with storage_path
 *   7. Queue ingestion_jobs with document_id
 */
export async function POST(request: NextRequest): Promise<NextResponse<DocumentUploadResponse>> {
    let documentId: string | null = null;

    try {
        const supabaseAdmin = getSupabaseAdmin();

        // ---------------------------------------------------------------
        // 1. Authenticate user (REQUIRED)
        // ---------------------------------------------------------------
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Authentication required. Please sign in and try again.', error: 'AUTH_REQUIRED' },
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
                { success: false, message: 'Session expired. Please sign in again.', error: 'AUTH_INVALID' },
                { status: 401 }
            );
        }

        const accountId = user.id;
        logger.info('DocumentUpload', 'Authenticated user', { accountId });

        // ---------------------------------------------------------------
        // 2. Parse & validate form data
        // ---------------------------------------------------------------
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json(
                { success: false, message: 'Invalid form data', error: 'PARSE_ERROR' },
                { status: 400 }
            );
        }

        const file = formData.get('file') as File | null;
        const docType = formData.get('doc_type') as string | null;
        const policyId = formData.get('policy_id') as string | null;

        if (!file) {
            return NextResponse.json(
                { success: false, message: 'No file provided', error: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (!docType || !VALID_DOC_TYPES.has(docType)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Invalid document type: "${docType}". Valid types: ${Array.from(VALID_DOC_TYPES).join(', ')}`,
                    error: 'INVALID_DOC_TYPE',
                },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { success: false, message: `Unsupported file type: ${file.type}. Only PDF files are accepted.`, error: 'INVALID_FILE_TYPE' },
                { status: 400 }
            );
        }

        if (file.size === 0) {
            return NextResponse.json(
                { success: false, message: 'The uploaded file is empty (0 bytes). Please select a valid PDF.', error: 'EMPTY_FILE' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, message: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.`, error: 'FILE_TOO_LARGE' },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------------
        // 3. Read file and compute hash
        // ---------------------------------------------------------------
        const fileArrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(fileArrayBuffer);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check for duplicate
        const { data: existingDuplicate } = await supabaseAdmin
            .from('platform_documents')
            .select('id, parse_status, match_status')
            .eq('file_hash', fileHash)
            .eq('account_id', accountId)
            .not('parse_status', 'eq', 'failed')
            .limit(1);

        if (existingDuplicate && existingDuplicate.length > 0) {
            const existing = existingDuplicate[0];
            logger.warn('DocumentUpload', 'Duplicate file detected', {
                existingId: existing.id,
                fileHash,
            });
            return NextResponse.json(
                {
                    success: false,
                    message: 'This exact file has already been uploaded.',
                    error: 'DUPLICATE_FILE',
                    errorCode: 'DUPLICATE',
                    data: {
                        existingDocumentId: existing.id,
                        existingStatus: existing.parse_status,
                        existingMatchStatus: existing.match_status,
                    },
                },
                { status: 409 }
            );
        }

        // ---------------------------------------------------------------
        // 4. INSERT platform_documents row (parse_status='pending')
        // ---------------------------------------------------------------
        const now = new Date().toISOString();
        const { data: docRow, error: insertError } = await supabaseAdmin
            .from('platform_documents')
            .insert({
                account_id: accountId,
                doc_type: docType,
                file_name: file.name,
                file_size: file.size,
                file_hash: fileHash,
                bucket: STORAGE_BUCKET,
                parse_status: 'pending',
                processing_step: 'uploaded',
                match_status: policyId ? 'manual' : 'pending',
                policy_id: policyId || null,
                created_at: now,
                updated_at: now,
            })
            .select('id')
            .single();

        if (insertError || !docRow) {
            logger.error('DocumentUpload', 'Failed to insert platform_documents', {
                error: insertError?.message,
            });
            return NextResponse.json(
                { success: false, message: 'Failed to create document record. Please try again.', error: 'DB_INSERT_FAILED' },
                { status: 500 }
            );
        }

        documentId = docRow.id;
        logger.info('DocumentUpload', 'Created document record', {
            documentId,
            docType,
            fileName: file.name,
            fileSize: file.size,
        });

        // ---------------------------------------------------------------
        // 5. Upload to storage
        // ---------------------------------------------------------------
        const storagePath = `${docType}/${accountId}/${documentId}.pdf`;

        const { error: storageError } = await supabaseAdmin
            .storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (storageError) {
            logger.error('DocumentUpload', 'Storage upload failed', {
                documentId,
                storagePath,
                error: storageError.message,
            });

            // Mark document as failed
            await supabaseAdmin
                .from('platform_documents')
                .update({
                    parse_status: 'failed',
                    error_message: `Storage upload failed: ${storageError.message}`,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', documentId);

            return NextResponse.json(
                { success: false, message: 'Failed to upload file to storage. Please try again.', error: 'STORAGE_ERROR' },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------------
        // 6. Update document with storage path
        // ---------------------------------------------------------------
        await supabaseAdmin
            .from('platform_documents')
            .update({
                storage_path: storagePath,
                processing_step: 'queued',
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        // ---------------------------------------------------------------
        // 7. Queue ingestion job
        // ---------------------------------------------------------------
        const { error: jobError } = await supabaseAdmin
            .from('ingestion_jobs')
            .insert({
                document_id: documentId,
                account_id: accountId,
                status: 'queued',
                attempts: 0,
                max_attempts: 5,
                created_at: now,
                updated_at: now,
            });

        if (jobError) {
            logger.error('DocumentUpload', 'Failed to queue ingestion job', {
                documentId,
                error: jobError.message,
            });
            // Non-fatal: document is stored, job can be manually retried
        }

        logger.info('DocumentUpload', 'Upload complete', {
            documentId,
            docType,
            storagePath,
            jobQueued: !jobError,
        });

        return NextResponse.json(
            {
                success: true,
                message: `${docType.toUpperCase()} uploaded successfully. Processing will begin shortly.`,
                data: {
                    documentId: documentId!,
                    storagePath,
                    fileName: file.name,
                    fileSize: file.size,
                    docType,
                    submittedBy: accountId,
                    submittedAt: now,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('DocumentUpload', 'Unexpected error', { error: errorMessage, documentId });

        // Try to mark document as failed
        if (documentId) {
            try {
                const admin = getSupabaseAdmin();
                await admin
                    .from('platform_documents')
                    .update({
                        parse_status: 'failed',
                        error_message: `Unexpected error: ${errorMessage.slice(0, 500)}`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', documentId);
            } catch {
                // Best-effort
            }
        }

        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred. Please try again.', error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
