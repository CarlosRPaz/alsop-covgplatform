/**
 * Cleanup script: Fix corrupted client names and policy addresses
 * caused by the regex parser fallback producing garbage data.
 * 
 * What it fixes:
 * - Clients with named_insured = "Copy Cfp-R3A (09/2019)" or "Name And"
 * - Policies with property_address_raw starting with "INSURED NAME AND MAILING ADDRESS PROPERTY LOCATION"
 * - Dec pages with insured_name = "Copy Cfp-R3A (09/2019)" or "Name And"
 * 
 * Strategy:
 * 1. Find corrupted dec_pages (parser=fairplan_regex_v1 with bad names)
 * 2. For each, find the associated policy and client
 * 3. Delete the corrupted records so they can be re-processed cleanly
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
        const [k, ...rest] = line.split('=');
        env[k.trim()] = rest.join('=').trim();
    }
});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const BAD_NAMES = ['Copy Cfp-R3A (09/2019)', 'Name And'];

async function cleanup() {
    console.log("=== CLEANUP: Finding corrupted records ===\n");

    // 1. Find all corrupted dec_pages
    const { data: badPages, error: pErr } = await sb.from('dec_pages')
        .select('id, submission_id, policy_id, client_id, insured_name, policy_number, property_location')
        .in('insured_name', BAD_NAMES);

    if (pErr) { console.error("Error fetching dec_pages:", pErr); return; }
    console.log(`Found ${badPages.length} corrupted dec_pages\n`);

    // Collect unique policy_ids, client_ids, and submission_ids
    const policyIds = new Set();
    const clientIds = new Set();
    const submissionIds = new Set();
    const decPageIds = new Set();

    for (const dp of badPages) {
        decPageIds.add(dp.id);
        if (dp.policy_id) policyIds.add(dp.policy_id);
        if (dp.client_id) clientIds.add(dp.client_id);
        if (dp.submission_id) submissionIds.add(dp.submission_id);
        console.log(`  Dec page ${dp.id.substring(0,8)}: "${dp.insured_name}" | policy=${dp.policy_number} | prop=${dp.property_location?.substring(0,60)}`);
    }

    console.log(`\nAffected: ${decPageIds.size} dec_pages, ${policyIds.size} policies, ${clientIds.size} clients, ${submissionIds.size} submissions\n`);

    // 2. Check which clients are ONLY linked to corrupted policies
    // (Don't delete clients that have legitimate policies too)
    const safeToDeleteClientIds = new Set();
    for (const cid of clientIds) {
        // Count how many policies this client has
        const { data: pols } = await sb.from('policies')
            .select('id')
            .eq('client_id', cid);

        const clientPolicyIds = new Set((pols || []).map(p => p.id));
        // If ALL of this client's policies are in our corrupted set, safe to delete
        const allCorrupted = [...clientPolicyIds].every(pid => policyIds.has(pid));
        if (allCorrupted) {
            safeToDeleteClientIds.add(cid);
        } else {
            console.log(`  Client ${cid.substring(0,8)}: has ${clientPolicyIds.size} policies, only ${[...clientPolicyIds].filter(pid => policyIds.has(pid)).length} corrupted — will NOT delete client`);
        }
    }

    // 3. Find the "Copy Cfp-R3A (09/2019)" client that's absorbing all records
    const { data: badClients } = await sb.from('clients')
        .select('id, named_insured')
        .in('named_insured', BAD_NAMES);

    console.log(`\nBad client records:`);
    for (const c of (badClients || [])) {
        console.log(`  ${c.id.substring(0,8)}: "${c.named_insured}"`);
        safeToDeleteClientIds.add(c.id);
    }

    // Print summary
    console.log(`\n=== CLEANUP PLAN ===`);
    console.log(`Dec pages to clear: ${decPageIds.size}`);
    console.log(`Policy terms to delete: (counted below)`);
    console.log(`Policies to delete: ${policyIds.size}`);
    console.log(`Clients to delete: ${safeToDeleteClientIds.size}`);
    console.log(`Submissions to reset: ${submissionIds.size}`);

    // DRY RUN — just show what would be done
    console.log(`\n=== DRY RUN MODE — Pass --execute to actually run ===`);

    if (process.argv.includes('--execute')) {
        console.log(`\n=== EXECUTING CLEANUP ===\n`);

        // Delete policy_terms for corrupted policies first
        for (const pid of policyIds) {
            const { error } = await sb.from('policy_terms').delete().eq('policy_id', pid);
            if (error) console.error(`  Error deleting terms for policy ${pid}:`, error.message);
            else console.log(`  Deleted policy_terms for policy ${pid.substring(0,8)}`);
        }

        // Clear dec_page links and reset
        for (const dpId of decPageIds) {
            const { error } = await sb.from('dec_pages').delete().eq('id', dpId);
            if (error) console.error(`  Error deleting dec_page ${dpId}:`, error.message);
            else console.log(`  Deleted dec_page ${dpId.substring(0,8)}`);
        }

        // Delete corrupted policies
        for (const pid of policyIds) {
            const { error } = await sb.from('policies').delete().eq('id', pid);
            if (error) console.error(`  Error deleting policy ${pid}:`, error.message);
            else console.log(`  Deleted policy ${pid.substring(0,8)}`);
        }

        // Delete corrupted clients
        for (const cid of safeToDeleteClientIds) {
            const { error } = await sb.from('clients').delete().eq('id', cid);
            if (error) console.error(`  Error deleting client ${cid}:`, error.message);
            else console.log(`  Deleted client ${cid.substring(0,8)}`);
        }

        // Reset submissions to 'queued' so worker re-processes them
        for (const sid of submissionIds) {
            const { error } = await sb.from('dec_page_submissions').update({
                status: 'queued',
                parse_status: null,
                error_message: null,
                error_detail: null,
                policy_id: null,
            }).eq('id', sid);
            if (error) console.error(`  Error resetting submission ${sid}:`, error.message);
            else console.log(`  Reset submission ${sid.substring(0,8)} → queued`);
        }

        // Re-queue ingestion jobs for these submissions
        for (const sid of submissionIds) {
            // Check if there's already a queued job
            const { data: existingJobs } = await sb.from('ingestion_jobs')
                .select('id, status')
                .eq('submission_id', sid)
                .in('status', ['queued', 'processing']);

            if (existingJobs && existingJobs.length > 0) {
                console.log(`  Job already exists for submission ${sid.substring(0,8)} — skipping`);
                continue;
            }

            // Find the original job to get account_id
            const { data: origJobs } = await sb.from('ingestion_jobs')
                .select('account_id')
                .eq('submission_id', sid)
                .limit(1);

            const accountId = origJobs?.[0]?.account_id;
            if (!accountId) {
                console.log(`  No account_id found for submission ${sid.substring(0,8)} — skipping`);
                continue;
            }

            const { error } = await sb.from('ingestion_jobs').insert({
                submission_id: sid,
                account_id: accountId,
                status: 'queued',
                attempts: 0,
            });
            if (error) console.error(`  Error creating job for submission ${sid}:`, error.message);
            else console.log(`  Created new job for submission ${sid.substring(0,8)}`);
        }

        console.log(`\n=== CLEANUP COMPLETE ===`);
    }
}

cleanup();
