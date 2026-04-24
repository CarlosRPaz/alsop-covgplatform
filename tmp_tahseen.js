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

async function investigate() {
    // Search all recent submissions logged in the activity feed
    console.log("=== RECENT ACTIVITY EVENTS WITH 'Tahseen' ===");
    const { data: events } = await supabase.from('activity_events')
        .select('*')
        .ilike('title', '%Tahseen%')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log(`Events: ${events?.length}`);
    events?.forEach(e => {
        console.log(`  ${e.event_type} | ${e.title}`);
        console.log(`    policy=${e.policy_id} | sub=${e.submission_id} | client=${e.client_id}`);
        console.log(`    details=${JSON.stringify(e.details)?.substring(0,200)}`);
        console.log(`    created_at=${e.created_at}`);
    });

    // Search submissions by file_name containing Tahseen or Halool
    console.log("\n=== SUBMISSIONS BY FILE NAME ===");
    const { data: subs1 } = await supabase.from('dec_page_submissions')
        .select('id, status, file_hash, file_name, parse_status, created_at, policy_id, duplicate_of_submission_id, account_id')
        .ilike('file_name', '%Halool%')
        .order('created_at', { ascending: false });
    console.log(`By 'Halool': ${subs1?.length}`);
    subs1?.forEach(s => console.log(`  ${s.id} | ${s.status} | parse=${s.parse_status} | dup=${s.duplicate_of_submission_id} | policy=${s.policy_id} | ${s.file_name}`));

    const { data: subs2 } = await supabase.from('dec_page_submissions')
        .select('id, status, file_hash, file_name, parse_status, created_at, policy_id, duplicate_of_submission_id')
        .ilike('file_name', '%Tahseen%')
        .order('created_at', { ascending: false });
    console.log(`\nBy 'Tahseen': ${subs2?.length}`);
    subs2?.forEach(s => console.log(`  ${s.id} | ${s.status} | parse=${s.parse_status} | dup=${s.duplicate_of_submission_id} | policy=${s.policy_id} | ${s.file_name}`));

    // Search by policy_number in file_name
    const { data: subs3 } = await supabase.from('dec_page_submissions')
        .select('id, status, file_hash, file_name, parse_status, created_at, policy_id, duplicate_of_submission_id')
        .ilike('file_name', '%0102042711%')
        .order('created_at', { ascending: false });
    console.log(`\nBy '0102042711': ${subs3?.length}`);
    subs3?.forEach(s => console.log(`  ${s.id} | ${s.status} | parse=${s.parse_status} | dup=${s.duplicate_of_submission_id} | policy=${s.policy_id} | ${s.file_name}`));

    // Check ingestion_jobs with failures
    console.log("\n=== RECENT FAILED/QUEUED JOBS ===");
    const { data: jobs } = await supabase.from('ingestion_jobs')
        .select('id, status, submission_id, document_id, last_error, attempts, created_at')
        .in('status', ['failed', 'queued'])
        .order('created_at', { ascending: false })
        .limit(15);
    jobs?.forEach(j => console.log(`  ${j.id} | ${j.status} | sub=${j.submission_id} | doc=${j.document_id} | att=${j.attempts} | err=${j.last_error?.substring(0,80)}`));

    // Get ALL most recent submissions  
    console.log("\n=== 15 MOST RECENT SUBMISSIONS ===");
    const { data: recent } = await supabase.from('dec_page_submissions')
        .select('id, status, file_hash, file_name, parse_status, created_at, policy_id, duplicate_of_submission_id')
        .order('created_at', { ascending: false })
        .limit(15);
    recent?.forEach(s => console.log(`  ${s.id} | ${s.status} | parse=${s.parse_status} | dup=${s.duplicate_of_submission_id} | policy=${s.policy_id} | ${s.file_name}`));
}
investigate();
