import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST /api/csv-import/commit
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();

        // 1. Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401 });
        }

        const token = authHeader.slice(7);
        const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'AUTH_INVALID' }, { status: 401 });
        }

        // 2. Get batch ID
        const body = await request.json();
        const batchId = body.batchId;
        if (!batchId) {
            return NextResponse.json({ success: false, error: 'Missing batchId' }, { status: 400 });
        }

        // 3. Load batch
        const { data: batch, error: batchErr } = await supabaseAdmin
            .from('policy_import_batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (batchErr || !batch) {
            return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
        }

        if (batch.status === 'completed') {
            return NextResponse.json({ success: false, error: 'Batch already imported' }, { status: 400 });
        }

        // 4. Load valid rows
        const { data: rows, error: rowErr } = await supabaseAdmin
            .from('policy_import_rows')
            .select('*')
            .eq('batch_id', batchId)
            .eq('status', 'valid')
            .order('row_index', { ascending: true });

        if (rowErr) {
            logger.error('CSVImport', 'Failed to load rows', { error: rowErr.message });
            return NextResponse.json({ success: false, error: 'Failed to load rows' }, { status: 500 });
        }

        if (!rows || rows.length === 0) {
            return NextResponse.json({ success: false, error: 'No valid rows to import' }, { status: 400 });
        }

        // 5. Cache existing policies by policy_number
        const policyNumbers = [...new Set(rows.map(r => r.policy_number))];
        const { data: existingPolicies } = await supabaseAdmin
            .from('policies')
            .select('id, policy_number, client_id')
            .in('policy_number', policyNumbers);

        const policyMap = new Map<string, { id: string; client_id: string }>();
        if (existingPolicies) {
            for (const p of existingPolicies) {
                policyMap.set(p.policy_number, { id: p.id, client_id: p.client_id });
            }
        }

        let imported = 0;
        let skipped = 0;
        let flagsCreated = 0;
        let newClientsCreated = 0;
        let termsCreated = 0;
        let termsUpdated = 0;
        const errors: string[] = [];
        const now = new Date().toISOString();

        // 6. Process each row
        for (const row of rows) {
            try {
                let policyId: string;
                let clientId: string;

                const existing = policyMap.get(row.policy_number);

                if (existing) {
                    // Policy exists → use existing client + policy
                    policyId = existing.id;
                    clientId = existing.client_id;
                } else {
                    // Create new client
                    const { data: newClient, error: clientErr } = await supabaseAdmin
                        .from('clients')
                        .insert({
                            created_by_account_id: user.id,
                            named_insured: row.insured_name,
                        })
                        .select('id')
                        .single();

                    if (clientErr || !newClient) {
                        errors.push(`Row ${row.row_index + 2}: Failed to create client - ${clientErr?.message}`);
                        skipped++;
                        continue;
                    }

                    clientId = newClient.id;
                    newClientsCreated++;

                    // Create new policy
                    const policyInsert: Record<string, unknown> = {
                        created_by_account_id: user.id,
                        client_id: clientId,
                        policy_number: row.policy_number,
                    };

                    const { data: newPolicy, error: policyErr } = await supabaseAdmin
                        .from('policies')
                        .insert(policyInsert)
                        .select('id')
                        .single();

                    if (policyErr || !newPolicy) {
                        errors.push(`Row ${row.row_index + 2}: Failed to create policy - ${policyErr?.message}`);
                        skipped++;
                        continue;
                    }

                    policyId = newPolicy.id;
                    // Cache for subsequent rows with same policy number
                    policyMap.set(row.policy_number, { id: policyId, client_id: clientId });
                }

                // Upsert policy_term by policy_id + effective_date + expiration_date
                // Check if term exists
                let termQuery = supabaseAdmin
                    .from('policy_terms')
                    .select('id')
                    .eq('policy_id', policyId);

                if (row.effective_date) {
                    termQuery = termQuery.eq('effective_date', row.effective_date);
                }
                if (row.expiration_date) {
                    termQuery = termQuery.eq('expiration_date', row.expiration_date);
                }

                const { data: existingTerms } = await termQuery.limit(1);

                const termPayload = {
                    policy_id: policyId,
                    effective_date: row.effective_date || null,
                    expiration_date: row.expiration_date || null,
                    annual_premium: row.annual_premium || null,
                    is_current: true,
                    carrier_status: row.carrier_status || null,
                    policy_activity: row.policy_activity || null,
                    payment_status: row.payment_status || null,
                    payment_plan: row.payment_plan || null,
                    cancellation_reason: row.cancellation_reason || null,
                    dic_exists: row.dic_exists || false,
                    sold_by: row.sold_by || null,
                    office: row.office || null,
                    import_batch_id: batchId,
                    updated_at: now,
                };

                if (existingTerms && existingTerms.length > 0) {
                    // Update existing term
                    await supabaseAdmin
                        .from('policy_terms')
                        .update(termPayload)
                        .eq('id', existingTerms[0].id);
                    termsUpdated++;
                } else {
                    // Mark existing terms as not current
                    await supabaseAdmin
                        .from('policy_terms')
                        .update({ is_current: false })
                        .eq('policy_id', policyId)
                        .eq('is_current', true);

                    // Insert new term
                    await supabaseAdmin
                        .from('policy_terms')
                        .insert({ ...termPayload, created_at: now });
                    termsCreated++;
                }

                // Create notes for DIC Notes (non-fatal)
                if (row.dic_notes) {
                    const { error: dicNoteErr } = await supabaseAdmin.from('notes').insert({
                        author_user_id: user.id,
                        client_id: clientId,
                        policy_id: policyId,
                        body: `[DIC] ${row.dic_notes}`,
                        meta: { tag: 'DIC', source: 'csv_import', batch_id: batchId },
                    });
                    if (dicNoteErr) logger.warn('CSVImport', 'DIC note insert failed (non-fatal)', { error: dicNoteErr.message });
                }

                // Create notes for Notes / Reason / Activity (non-fatal)
                const legacyParts: string[] = [];
                if (row.notes_text) legacyParts.push(`Notes: ${row.notes_text}`);
                if (row.reason) legacyParts.push(`Reason: ${row.reason}`);
                if (row.activity) legacyParts.push(`Activity: ${row.activity}`);

                if (legacyParts.length > 0) {
                    const { error: legacyNoteErr } = await supabaseAdmin.from('notes').insert({
                        author_user_id: user.id,
                        client_id: clientId,
                        policy_id: policyId,
                        body: `[Legacy Import]\n${legacyParts.join('\n')}`,
                        meta: { tag: 'legacy', source: 'csv_import', batch_id: batchId },
                    });
                    if (legacyNoteErr) logger.warn('CSVImport', 'Legacy note insert failed (non-fatal)', { error: legacyNoteErr.message });
                }

                // Activity event (non-fatal)
                const { error: activityErr } = await supabaseAdmin.from('activity_events').insert({
                    actor_user_id: user.id,
                    event_type: 'import.row',
                    title: 'Policy imported from CSV',
                    detail: `Policy #${row.policy_number} — ${row.insured_name}`,
                    policy_id: policyId,
                    client_id: clientId,
                    meta: { batch_id: batchId, row_index: row.row_index },
                });
                if (activityErr) logger.warn('CSVImport', 'Activity event insert failed (non-fatal)', { error: activityErr.message });

                // Mark row as imported
                await supabaseAdmin
                    .from('policy_import_rows')
                    .update({ status: 'imported' })
                    .eq('id', row.id);

                imported++;

                // ── Cheap deterministic flags (zero API cost) ──
                try {
                    // RENEWAL_UPCOMING — expiration within 21 days
                    if (row.expiration_date) {
                        const expDate = new Date(row.expiration_date);
                        const daysUntil = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysUntil >= 0 && daysUntil <= 21) {
                            const flagKey = `policy:${policyId}:RENEWAL_UPCOMING:`;
                            const { data: existingFlag } = await supabaseAdmin
                                .from('policy_flags')
                                .select('id')
                                .eq('flag_key', flagKey)
                                .eq('status', 'open')
                                .limit(1);
                            if (!existingFlag || existingFlag.length === 0) {
                                await supabaseAdmin.from('policy_flags').insert({
                                    flag_key: flagKey,
                                    code: 'RENEWAL_UPCOMING',
                                    severity: 'high',
                                    title: 'Renewal Upcoming',
                                    message: `Policy expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
                                    status: 'open',
                                    source: 'csv_import',
                                    category: 'renewal',
                                    policy_id: policyId,
                                    client_id: clientId,
                                    rule_version: '1.0.0',
                                    first_seen_at: now,
                                    last_seen_at: now,
                                    times_seen: 1,
                                    created_at: now,
                                    updated_at: now,
                                });
                                flagsCreated++;
                            }
                        }
                    }

                    // ECM_PREMIUM_MISSING_OR_ZERO — no premium or $0
                    if (!row.annual_premium || Number(row.annual_premium) <= 0) {
                        const flagKey = `policy:${policyId}:ECM_PREMIUM_MISSING_OR_ZERO:`;
                        const { data: existingFlag } = await supabaseAdmin
                            .from('policy_flags')
                            .select('id')
                            .eq('flag_key', flagKey)
                            .eq('status', 'open')
                            .limit(1);
                        if (!existingFlag || existingFlag.length === 0) {
                            await supabaseAdmin.from('policy_flags').insert({
                                flag_key: flagKey,
                                code: 'ECM_PREMIUM_MISSING_OR_ZERO',
                                severity: 'high',
                                title: 'Premium Missing or Zero',
                                message: 'Annual premium is missing or $0.',
                                status: 'open',
                                source: 'csv_import',
                                category: 'data_quality',
                                policy_id: policyId,
                                client_id: clientId,
                                rule_version: '1.0.0',
                                first_seen_at: now,
                                last_seen_at: now,
                                times_seen: 1,
                                created_at: now,
                                updated_at: now,
                            });
                            flagsCreated++;
                        }
                    }

                    // NO_DIC — DIC not on file
                    if (row.dic_exists === false) {
                        const flagKey = `policy:${policyId}:NO_DIC:`;
                        const { data: existingFlag } = await supabaseAdmin
                            .from('policy_flags')
                            .select('id')
                            .eq('flag_key', flagKey)
                            .eq('status', 'open')
                            .limit(1);
                        if (!existingFlag || existingFlag.length === 0) {
                            await supabaseAdmin.from('policy_flags').insert({
                                flag_key: flagKey,
                                code: 'NO_DIC',
                                severity: 'high',
                                title: 'DIC Not on File',
                                message: 'DIC coverage is not on file for this policy.',
                                status: 'open',
                                source: 'csv_import',
                                category: 'dic',
                                policy_id: policyId,
                                client_id: clientId,
                                rule_version: '1.0.0',
                                first_seen_at: now,
                                last_seen_at: now,
                                times_seen: 1,
                                created_at: now,
                                updated_at: now,
                            });
                            flagsCreated++;
                        }
                    }
                } catch (flagErr) {
                    // Flag evaluation is non-fatal
                    logger.warn('CSVImport', 'Flag evaluation failed (non-fatal)', {
                        policyId,
                        error: flagErr instanceof Error ? flagErr.message : String(flagErr),
                    });
                }
            } catch (rowError) {
                const msg = rowError instanceof Error ? rowError.message : String(rowError);
                errors.push(`Row ${row.row_index + 2}: ${msg}`);
                skipped++;
            }
        }

        // 7. Mark batch completed
        await supabaseAdmin
            .from('policy_import_batches')
            .update({
                status: 'completed',
                imported_count: imported,
                updated_at: now,
            })
            .eq('id', batchId);

        // 8. Batch-level activity event
        try {
            await supabaseAdmin.from('activity_events').insert({
                actor_user_id: user.id,
                event_type: 'import.batch_complete',
                title: 'CSV Import Completed',
                detail: `Imported ${imported} policies (${newClientsCreated} new clients, ${flagsCreated} flags created, ${skipped} skipped)`,
                meta: {
                    batch_id: batchId,
                    imported,
                    skipped,
                    flags_created: flagsCreated,
                    new_clients: newClientsCreated,
                    terms_created: termsCreated,
                    terms_updated: termsUpdated,
                },
            });
        } catch {
            logger.warn('CSVImport', 'Batch activity event failed (non-fatal)');
        }

        logger.info('CSVImport', 'Commit complete', { batchId, imported, skipped, flagsCreated, errorCount: errors.length });

        return NextResponse.json({
            success: true,
            imported,
            skipped,
            errors,
            flags_created: flagsCreated,
            new_clients_created: newClientsCreated,
            terms_created: termsCreated,
            terms_updated: termsUpdated,
        });

    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error('CSVImport', 'Commit error', { error: errMsg, stack: err instanceof Error ? err.stack : undefined });
        return NextResponse.json({ success: false, error: `Import failed: ${errMsg}` }, { status: 500 });
    }
}
