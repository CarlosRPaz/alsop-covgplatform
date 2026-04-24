const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        env[k.trim()] = v.trim();
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    const docId = 'b118b5ef-fe8e-4dff-a7b3-8ce5c62c5e5d';

    // Get the doc
    const { data: doc } = await supabase.from('platform_documents')
        .select('id, account_id').eq('id', docId).single();

    // Reset the doc for candidate re-matching only (keep parse data)
    const { data, error } = await supabase.from('platform_documents').update({
        match_status: 'pending',
        match_confidence: null,
        match_log: null,
        policy_id: null,
        client_id: null,
        policy_term_id: null,
        processing_step: 'parsed',  // Skip re-parsing, go straight to matching
        updated_at: new Date().toISOString(),
    }).eq('id', docId).select('id, match_status').single();

    if (error) {
        console.error("Failed to reset:", error.message);
        return;
    }
    console.log("Document reset:", data);

    // Queue job
    const { data: job, error: jobErr } = await supabase.from('ingestion_jobs').insert({
        document_id: docId,
        account_id: doc.account_id,
        status: 'queued',
        attempts: 0,
        max_attempts: 3,
        run_after: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select('id').single();

    if (jobErr) console.error("Job error:", jobErr.message);
    else console.log("Job queued:", job);
}
fix();
