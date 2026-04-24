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

async function check() {
    // 1. Get Mark Adams DIC doc
    console.log("=== MARK ADAMS DIC DOC ===");
    const { data: doc } = await supabase.from('platform_documents')
        .select('id, file_name, doc_type, parse_status, match_status, match_confidence, policy_id, client_id, extracted_owner_name, extracted_address, extracted_address_norm, match_log, processing_step, writeback_status')
        .eq('id', 'b118b5ef-fe8e-4dff-a7b3-8ce5c62c5e5d')
        .single();
    
    console.log(`Status: ${doc.parse_status} / ${doc.match_status} / step: ${doc.processing_step}`);
    console.log(`Extracted: ${doc.extracted_owner_name} / ${doc.extracted_address}`);
    console.log(`Matched to: policy=${doc.policy_id}, client=${doc.client_id}`);
    console.log(`Confidence: ${doc.match_confidence}`);
    console.log(`Writeback: ${doc.writeback_status}`);
    
    if (doc.policy_id) {
        const { data: pol } = await supabase.from('policies').select('id, policy_number, client_id, property_address_raw').eq('id', doc.policy_id).single();
        console.log(`\nMatched Policy: ${pol?.policy_number} / addr: ${pol?.property_address_raw}`);
        if (pol?.client_id) {
            const { data: cl } = await supabase.from('clients').select('id, named_insured').eq('id', pol.client_id).single();
            console.log(`Policy's Client: ${cl?.named_insured}`);
        }
    }

    // 2. Mark Adams actual policy
    console.log("\n=== MARK ADAMS REAL POLICY ===");
    const { data: markClient } = await supabase.from('clients').select('id, named_insured').ilike('named_insured', '%Mark Adams%');
    console.log("Clients:", markClient);
    
    if (markClient?.length > 0) {
        const { data: markPols } = await supabase.from('policies').select('id, policy_number, property_address_raw, property_address_norm').eq('client_id', markClient[0].id);
        console.log("Policies:", markPols);
    }
    
    // 3. Show match log
    console.log("\n=== MATCH LOG ===");
    doc.match_log?.forEach((l, i) => {
        console.log(`${i}. [${l.step}] ${l.result}: ${l.reason}`);
        if (l.details) console.log("   Details:", JSON.stringify(l.details));
    });
}
check();
