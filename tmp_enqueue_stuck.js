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

(async () => {
    console.log("=== QUEUE ENFORCER ===");
    // Find submissions marked physical status 'queued' 
    const { data: subs, error: sErr } = await sb.from('dec_page_submissions')
        .select('id, account_id')
        .eq('status', 'queued');

    if (sErr) {
        console.error("Error fetching queued submissions:", sErr);
        return;
    }

    console.log(`Found ${subs?.length || 0} submissions marked as queued.`);

    for (const sub of (subs || [])) {
        // Check if there's inherently a job for it
        const { data: jobs, error: jErr } = await sb.from('ingestion_jobs')
            .select('id, status')
            .eq('submission_id', sub.id)
            .in('status', ['queued', 'processing']);

        if (jobs && jobs.length > 0) {
            console.log(`  Submission ${sub.id.substring(0,8)} already has an active job (${jobs[0].status}). Skipping...`);
            continue;
        }

        // Insert new ingestion job
        const payload = {
            submission_id: sub.id,
            status: 'queued',
            attempts: 0
        };
        // Use document_id if present (rce/dic framework), else account_id for dec pages
        if (sub.account_id) {
            payload.account_id = sub.account_id;
        }

        const { error: insErr } = await sb.from('ingestion_jobs').insert(payload);
        if (insErr) {
            console.error(`  Failed to enqueue submission ${sub.id.substring(0,8)}:`, insErr.message);
        } else {
            console.log(`  Successfully enqueued submission ${sub.id.substring(0,8)}!`);
        }
    }
    console.log("=== DONE ===");
})();
