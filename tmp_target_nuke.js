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

async function findNukeRequeue() {
    console.log("=== TARGETED NUKE & REQUEUE ===");

    // Target: CFP 0100394519
    const targetPolicyNum = 'CFP 0100394519';

    // 1. Find the dec page(s) linked to this policy number
    const { data: decPages, error: pErr } = await sb.from('dec_pages')
        .select('*')
        .eq('policy_number', targetPolicyNum);

    if (pErr) {
        console.error("Error fetching dec page:", pErr);
        return;
    }

    if (!decPages || decPages.length === 0) {
        console.log(`Could not find any dec_pages for policy ${targetPolicyNum}`);
        
        // Maybe try to find the policy first
        const { data: polData } = await sb.from('policies').select('*').eq('policy_number', targetPolicyNum);
        console.log("Policies found directly by number:", JSON.stringify(polData, null, 2));
        return;
    }

    console.log(`Found ${decPages.length} dec pages associated with ${targetPolicyNum}`);

    for (const dp of decPages) {
        console.log(`\nProcessing dec_page: ${dp.id}`);
        console.log(`  Insured: ${dp.insured_name}`);
        console.log(`  Submission ID: ${dp.submission_id}`);

        if (dp.submission_id) {
            // Unlink from policy terms
            await sb.from('policy_terms').delete().eq('source_dec_page_id', dp.id);
            console.log("  Deleted linked policy_terms");

            // Delete dec page
            await sb.from('dec_pages').delete().eq('id', dp.id);
            console.log("  Deleted dec_page record");

            // Delete policy (if we're sure it's junk)
            if (dp.policy_id) {
                await sb.from('policies').delete().eq('id', dp.policy_id);
                console.log(`  Deleted policy ${dp.policy_id}`);
            }

            // Delete client if it's "Unknown Insured" or "Unknown"
            if (dp.client_id) {
                const { data: client } = await sb.from('clients').select('named_insured').eq('id', dp.client_id).single();
                if (client && client.named_insured && client.named_insured.includes('Unknown')) {
                    await sb.from('clients').delete().eq('id', dp.client_id);
                    console.log(`  Deleted 'Unknown' client ${dp.client_id}`);
                }
            }

            // Requeue submission
            await sb.from('dec_page_submissions').update({ status: 'queued', error_message: null }).eq('id', dp.submission_id);
            await sb.from('ingestion_jobs').delete().eq('submission_id', dp.submission_id);
            
            const { data: sub } = await sb.from('dec_page_submissions').select('account_id').eq('id', dp.submission_id).single();
            if (sub && sub.account_id) {
                await sb.from('ingestion_jobs').insert({
                    submission_id: dp.submission_id,
                    account_id: sub.account_id,
                    status: 'queued',
                    attempts: 0
                });
                console.log(`  ✓ Successfully requeued submission ${dp.submission_id}`);
            }
        }
    }
}

findNukeRequeue();
