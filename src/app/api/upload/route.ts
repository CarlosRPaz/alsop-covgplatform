import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types — PDF only (image support planned for future) */
const ALLOWED_TYPES = new Set([
    'application/pdf',
]);

/** Typed API response */
interface UploadResponse {
    success: boolean;
    message: string;
    data?: {
        submissionId: string;
        storagePath: string;
        fileName: string;
        fileSize: number;
        submittedBy: string;
        submittedAt: string;
    };
    error?: string;
}

/**
 * Mark a submission row as failed with error details.
 */
async function markSubmissionFailed(
    submissionId: string,
    errorMessage: string,
    errorDetail: Record<string, unknown>
) {
    const admin = getSupabaseAdmin();
    const { error } = await admin
        .from('dec_page_submissions')
        .update({
            status: 'failed',
            error_message: errorMessage,
            error_detail: errorDetail,
            updated_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

    if (error) {
        logger.error('Upload', 'Failed to mark submission as failed', {
            submissionId,
            dbError: error.message,
        });
    }
}

/**
 * POST /api/upload
 *
 * Auth-required, DB-First Submission Pipeline:
 * 1. Authenticate user via Bearer token (required)
 * 2. Parse & validate file
 * 3. Fetch user info from accounts table
 * 4. INSERT into dec_page_submissions (status='pending') → get submission_id
 * 5. Upload file to submissions/{account_id}/{submission_id}.pdf
 * 6. UPDATE row: status='uploaded', storage_path, file_path
 * 7. On error after step 4: UPDATE status='failed', error_message, error_detail
 */
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
    let submissionId: string | null = null;

    try {
        const supabaseAdmin = getSupabaseAdmin();

        // ---------------------------------------------------------------
        // 1. Authenticate user (REQUIRED)
        // ---------------------------------------------------------------
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            logger.warn('Upload', 'Missing or invalid Authorization header');
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
            logger.warn('Upload', 'Invalid or expired auth token', { error: authError?.message });
            return NextResponse.json(
                { success: false, message: 'Session expired. Please sign in again.', error: 'AUTH_INVALID' },
                { status: 401 }
            );
        }

        const accountId = user.id;
        logger.info('Upload', 'Authenticated user', { accountId });

        // ---------------------------------------------------------------
        // 2. Parse & validate file
        // ---------------------------------------------------------------
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            logger.error('Upload', 'Failed to parse form data');
            return NextResponse.json(
                { success: false, message: 'Invalid form data', error: 'PARSE_ERROR' },
                { status: 400 }
            );
        }

        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json(
                { success: false, message: 'No file provided', error: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            logger.warn('Upload', 'Invalid file type', { type: file.type });
            return NextResponse.json(
                { success: false, message: `Unsupported file type: ${file.type}. Only PDF files are accepted.`, error: 'INVALID_FILE_TYPE' },
                { status: 400 }
            );
        }

        if (file.size === 0) {
            logger.warn('Upload', 'Empty file submitted', { name: file.name });
            return NextResponse.json(
                { success: false, message: 'The uploaded file is empty (0 bytes). Please select a valid PDF.', error: 'EMPTY_FILE' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            logger.warn('Upload', 'File too large', { size: file.size });
            return NextResponse.json(
                { success: false, message: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit.`, error: 'FILE_TOO_LARGE' },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------------
        // 3. Fetch user info from accounts table
        // ---------------------------------------------------------------
        const { data: account, error: accountError } = await supabaseAdmin
            .from('accounts')
            .select('first_name, last_name, email, phone')
            .eq('id', accountId)
            .single();

        if (accountError || !account) {
            logger.error('Upload', 'Failed to fetch account info', {
                accountId,
                error: accountError?.message,
            });
            return NextResponse.json(
                { success: false, message: 'Could not retrieve your account information. Please contact support.', error: 'ACCOUNT_NOT_FOUND' },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------------
        // 4. DB-FIRST: Insert dec_page_submissions row (status='pending')
        // ---------------------------------------------------------------
        const now = new Date().toISOString();
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check for existing duplicate (exact file match by same account) that wasn't a failure
        const { data: existingDuplicate } = await supabaseAdmin
            .from('dec_page_submissions')
            .select('id, status')
            .eq('file_hash', fileHash)
            .eq('account_id', accountId)
            .neq('status', 'failed') // Could be pending, uploaded, processed, etc.
            .limit(1)
            .maybeSingle();

        if (existingDuplicate) {
            logger.info('Upload', 'Duplicate file detected, skipping upload and processing', {
                fileHash,
                existingId: existingDuplicate.id,
                accountId
            });

            // Insert a tracking record for the duplicate attempt (status='duplicate')
            // This prevents the worker from processing it, but gives us an audit trail
            const { data: dupRow, error: dupError } = await supabaseAdmin
                .from('dec_page_submissions')
                .insert({
                    account_id: accountId,
                    first_name: account.first_name || '',
                    last_name: account.last_name || '',
                    email: account.email || '',
                    phone: account.phone || '',
                    file_path: '',
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type,
                    status: 'duplicate',
                    bucket: 'cfp-raw-decpage',
                    file_hash: fileHash,
                    duplicate_of: existingDuplicate.id,
                    created_at: now,
                    updated_at: now,
                })
                .select('id')
                .single();

            if (dupError) {
                logger.error('Upload', 'Failed to insert duplicate tracking row (non-fatal)', { error: dupError.message });
            }

            const submittedBy = [account.first_name, account.last_name].filter(Boolean).join(' ') || account.email || 'User';

            return NextResponse.json(
                {
                    success: true,
                    message: 'Duplicate document recognized. Linking to existing record.',
                    data: {
                        submissionId: existingDuplicate.id, // Always return the parent ID that actually gets processed!
                        storagePath: '',
                        fileName: file.name,
                        fileSize: file.size,
                        submittedBy,
                        submittedAt: now,
                    },
                },
                { status: 200 } // Send success so the UI clears the upload state smoothly
            );
        }

        const { data: insertedRow, error: insertError } = await supabaseAdmin
            .from('dec_page_submissions')
            .insert({
                account_id: accountId,
                first_name: account.first_name || '',
                last_name: account.last_name || '',
                email: account.email || '',
                phone: account.phone || '',
                file_path: '', // Populated after upload
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
                status: 'pending',
                bucket: 'cfp-raw-decpage',
                file_hash: fileHash,
                created_at: now,
                updated_at: now,
            })
            .select('id')
            .single();

        if (insertError || !insertedRow) {
            logger.error('Upload', 'Failed to insert submission row', {
                error: insertError?.message,
                code: insertError?.code,
            });
            return NextResponse.json(
                { success: false, message: 'Failed to create submission record. Please try again.', error: 'DB_INSERT_FAILED' },
                { status: 500 }
            );
        }

        submissionId = insertedRow.id;
        logger.info('Upload', 'Submission row created (pending)', { submissionId, accountId, fileHash });

        // ---------------------------------------------------------------
        // 5. Upload file: submissions/{account_id}/{submission_id}.pdf
        // ---------------------------------------------------------------
        const storagePath = `submissions/${accountId}/${submissionId}.pdf`;

        logger.info('Upload', 'Uploading file to storage', { storagePath, fileSize: file.size });

        const { error: uploadError } = await supabaseAdmin.storage
            .from('cfp-raw-decpage')
            .upload(storagePath, fileBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            logger.error('Upload', 'Storage upload failed', {
                message: uploadError.message,
                storagePath,
            });

            await markSubmissionFailed(submissionId!, 'Storage upload failed', {
                storageError: uploadError.message,
                storagePath,
                attemptedAt: new Date().toISOString(),
            });

            return NextResponse.json(
                { success: false, message: 'Failed to upload file. Please try again.', error: 'STORAGE_UPLOAD_FAILED' },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------------
        // 6. UPDATE row: status='uploaded', storage_path, file_path
        //    CRITICAL: If this fails, the worker won't have a storage_path
        //    and will fail. We must treat this as a hard error.
        // ---------------------------------------------------------------
        const { error: updateError } = await supabaseAdmin
            .from('dec_page_submissions')
            .update({
                status: 'uploaded',
                storage_path: storagePath,
                file_path: storagePath, // Mirror for legacy compat
                updated_at: new Date().toISOString(),
            })
            .eq('id', submissionId);

        if (updateError) {
            logger.error('Upload', 'CRITICAL: Failed to update submission with storage_path', {
                submissionId,
                error: updateError.message,
            });

            // Attempt to clean up the uploaded file since the DB row is broken
            try {
                await supabaseAdmin.storage.from('cfp-raw-decpage').remove([storagePath]);
                logger.info('Upload', 'Cleaned up orphan storage file', { storagePath });
            } catch (cleanupErr) {
                logger.error('Upload', 'Failed to clean up orphan storage file', {
                    storagePath,
                    error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
                });
            }

            await markSubmissionFailed(submissionId!, 'Failed to finalize upload record', {
                dbError: updateError.message,
                storagePath,
            });

            return NextResponse.json(
                { success: false, message: 'Failed to finalize upload. Please try again.', error: 'DB_UPDATE_FAILED' },
                { status: 500 }
            );
        }

        logger.info('Upload', 'Submission completed successfully', { submissionId, storagePath });

        // ---------------------------------------------------------------
        // 7. Create ingestion job for the worker to pick up
        //    CRITICAL: Without this, the file is uploaded but never processed.
        //    This MUST succeed or we mark the submission as failed.
        // ---------------------------------------------------------------
        const { error: jobError } = await supabaseAdmin
            .from('ingestion_jobs')
            .insert({
                submission_id: submissionId!,
                account_id: accountId,
                status: 'queued',
            });

        if (jobError) {
            logger.error('Upload', 'CRITICAL: Failed to create ingestion job', {
                submissionId,
                error: jobError.message,
            });

            await markSubmissionFailed(submissionId!, 'Failed to queue for processing', {
                jobError: jobError.message,
            });

            return NextResponse.json(
                { success: false, message: 'File uploaded but failed to queue for processing. Please try again or contact support.', error: 'JOB_CREATE_FAILED' },
                { status: 500 }
            );
        }

        logger.info('Upload', 'Ingestion job queued', { submissionId });

        // ---------------------------------------------------------------
        // 8. Activity event: dec page uploaded
        // ---------------------------------------------------------------
        const submittedBy = [account.first_name, account.last_name].filter(Boolean).join(' ') || account.email || 'Unknown user';

        try {
            await supabaseAdmin.from('activity_events').insert({
                actor_user_id: accountId,
                event_type: 'dec.uploaded',
                title: `Declaration uploaded by ${submittedBy}`,
                detail: `File: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
                meta: { submission_id: submissionId, file_name: file.name, file_size: file.size },
            });
        } catch (e) {
            logger.warn('Upload', `Activity event insert failed (non-fatal): ${e}`);
        }

        // ---------------------------------------------------------------
        // 9. Return success
        // ---------------------------------------------------------------
        return NextResponse.json(
            {
                success: true,
                message: 'Declaration page submitted successfully!',
                data: {
                    submissionId: submissionId!,
                    storagePath,
                    fileName: file.name,
                    fileSize: file.size,
                    submittedBy,
                    submittedAt: now,
                },
            },
            { status: 200 }
        );
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Upload', 'Unexpected error in upload handler', {
            error: errorMessage,
            stack: err instanceof Error ? err.stack : undefined,
        });

        if (submissionId) {
            await markSubmissionFailed(submissionId, 'Unexpected server error', {
                error: errorMessage,
                stack: err instanceof Error ? err.stack : undefined,
            });
        }

        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred. Please try again.', error: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        );
    }
}
