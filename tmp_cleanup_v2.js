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

    const { data: badPages, error: pErr } = await sb.from('dec_pages')
        .select('id, submission_id, policy_id, client_id, insured_name, policy_number, property_location')
        .in('insured_name', BAD_NAMES);

    if (pErr) console.error("Error:", pErr);
    
    for (const dp of (badPages || [])) {
        // Clear FK references in policy_terms
        await sb.from('policy_terms').update({ source_dec_page_id: null }).eq('source_dec_page_id', dp.id);
        // Delete dec_page
        await sb.from('dec_pages').delete().eq('id', dp.id);
        if (dp.policy_id) await sb.from('policies').delete().eq('id', dp.policy_id);
        if (dp.client_id) await sb.from('clients').delete().eq('id', dp.client_id);
        if (dp.submission_id) await sb.from('dec_page_submissions').update({ status: 'queued', error_message: null }).eq('id', dp.submission_id);
    }

    console.log("Cleanup finished.");
}
cleanup();
