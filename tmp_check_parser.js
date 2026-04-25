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
    // Get the most recent ingestion_jobs to check for errors around LLM extraction
    console.log("=== RECENT INGESTION JOB ERRORS ===\n");
    const { data: jobs } = await sb.from('ingestion_jobs')
        .select('id, status, submission_id, document_id, last_error, error_detail, attempts, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(15);

    for (const j of (jobs || [])) {
        console.log(`Job ${j.id.substring(0,8)} | ${j.status} | att=${j.attempts} | sub=${j.submission_id?.substring(0,8)} | doc=${j.document_id?.substring(0,8) || '-'}`);
        if (j.last_error) console.log(`  ERROR: ${j.last_error.substring(0, 200)}`);
        if (j.error_detail?.step) console.log(`  STEP: ${j.error_detail.step}`);
        console.log(`  created: ${j.created_at} | updated: ${j.updated_at}`);
        console.log('');
    }

    // Check dec_pages parser field to see which used LLM vs regex
    console.log("\n=== PARSER DISTRIBUTION (last 20 dec pages) ===\n");
    const { data: pages } = await sb.from('dec_pages')
        .select('id, parse_status, created_at, extracted_json, insured_name')
        .order('created_at', { ascending: false })
        .limit(20);

    let llmCount = 0, regexCount = 0, unknownCount = 0;
    for (const p of (pages || [])) {
        const parser = p.extracted_json?.parser || 'unknown';
        if (parser.includes('llm')) llmCount++;
        else if (parser.includes('regex')) regexCount++;
        else unknownCount++;
        console.log(`  ${p.id.substring(0,8)} | ${parser} | name: ${p.insured_name?.substring(0, 40)} | ${p.created_at}`);
    }
    console.log(`\nLLM: ${llmCount}, Regex: ${regexCount}, Unknown: ${unknownCount}`);
})();
