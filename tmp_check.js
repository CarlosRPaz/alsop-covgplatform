const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        env[k.trim()] = v.trim();
    }
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data } = await s.from('platform_documents')
        .select('id, parse_status, match_status, match_confidence, match_log, policy_id, client_id, extracted_owner_name, processing_step')
        .eq('id', 'b118b5ef-fe8e-4dff-a7b3-8ce5c62c5e5d')
        .single();

    console.log('Status:', data.parse_status, '/', data.match_status);
    console.log('Step:', data.processing_step);
    console.log('Owner:', data.extracted_owner_name);
    console.log('Policy:', data.policy_id);
    console.log('Client:', data.client_id);
    console.log('Confidence:', data.match_confidence);
    console.log('Match log entries:', data.match_log?.length || 'NULL');

    if (data.match_log) {
        const cands = data.match_log.find(l => l.step === 'candidates')?.details?.candidates || [];
        console.log('\nCandidates:', cands.length);
        cands.forEach(c => {
            console.log(`  ${c.named_insured} | ${c.policy_number} | name=${c.name_similarity} addr=${c.address_similarity} | ${c.match_source}`);
        });
    }
})();
