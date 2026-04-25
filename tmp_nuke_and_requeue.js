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

const BAD_NAMES = ['Copy Cfp-R3A (09/2019)', 'Name And', 'Unknown Carrier', 'Unknown'];

async function completeWipeAndRequeue() {
    console.log("=== NUKE & REQUEUE ===");

    // 1. Find all corrupted dec_pages
    const { data: badPages, error: pErr } = await sb.from('dec_pages')
        .select('id, submission_id, policy_id, client_id, insured_name, policy_number, property_location')
        .in('insured_name', BAD_NAMES);

    if (pErr) console.error("Error finding bad pages:", pErr);
    
    console.log(`Found ${badPages?.length || 0} corrupted dec_pages.`);

    const submissionIds = new Set();

    for (const dp of (badPages || [])) {
        console.log(`Cleaning up corrupted entities from submission ${dp.submission_id}...`);
        if (dp.submission_id) submissionIds.add(dp.submission_id);

        // Delete policy_terms references
        await sb.from('policy_terms').delete().eq('source_dec_page_id', dp.id);
        
        // Delete dec_page itself
        await sb.from('dec_pages').delete().eq('id', dp.id);
        
        // Delete policy if exists
        if (dp.policy_id) await sb.from('policies').delete().eq('id', dp.policy_id);
    }
    
    // Also explicitly destroy any client named "Copy Cfp-R3A"
    const { data: badClients } = await sb.from('clients').select('id').in('named_insured', BAD_NAMES);
    for (const c of (badClients || [])) {
        await sb.from('clients').delete().eq('id', c.id);
    }

    console.log("\n=== RE-ENQUEUING ===");
    for (const sid of submissionIds) {
        // Reset the UI state
        await sb.from('dec_page_submissions').update({ status: 'queued', error_message: null }).eq('id', sid);

        // Nuke old job queue items for this submission
        await sb.from('ingestion_jobs').delete().eq('submission_id', sid);

        // Create a pristine new job queue item
        const { data: subQuery } = await sb.from('dec_page_submissions').select('account_id').eq('id', sid).limit(1);
        if (subQuery && subQuery[0]) {
            await sb.from('ingestion_jobs').insert({
                submission_id: sid,
                account_id: subQuery[0].account_id,
                status: 'queued',
                attempts: 0
            });
            console.log(`Enqueued pristine job for ${sid}`);
        }
    }

    console.log("Done!");
}

completeWipeAndRequeue();
