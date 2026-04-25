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
    // Get the 10 most recent dec pages with their extracted data
    console.log("=== 10 MOST RECENT DEC PAGES ===\n");
    const { data: pages } = await sb.from('dec_pages')
        .select('id, submission_id, policy_id, client_id, parse_status, created_at, insured_name, policy_number, property_location, mailing_address, extracted_json')
        .order('created_at', { ascending: false })
        .limit(10);

    for (const p of (pages || [])) {
        console.log(`--- Dec Page ${p.id.substring(0,8)} ---`);
        console.log(`  Created: ${p.created_at}`);
        console.log(`  Status: ${p.parse_status}`);
        console.log(`  Insured: ${p.insured_name}`);
        console.log(`  Policy#: ${p.policy_number}`);
        console.log(`  Property: ${p.property_location}`);
        console.log(`  Mailing: ${p.mailing_address}`);
        console.log(`  Parser: ${p.extracted_json?.parser || 'unknown'}`);
        console.log('');
    }

    // Also check recent clients
    console.log("\n=== 10 MOST RECENTLY UPDATED CLIENTS ===\n");
    const { data: clients } = await sb.from('clients')
        .select('id, named_insured, mailing_address_raw, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    for (const c of (clients || [])) {
        console.log(`  ${c.named_insured} | mail: ${c.mailing_address_raw} | updated: ${c.updated_at}`);
    }

    // And recent policies
    console.log("\n=== 10 MOST RECENTLY UPDATED POLICIES ===\n");
    const { data: policies } = await sb.from('policies')
        .select('id, policy_number, carrier_name, property_address_raw, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    for (const pol of (policies || [])) {
        console.log(`  ${pol.policy_number} | ${pol.carrier_name} | addr: ${pol.property_address_raw} | updated: ${pol.updated_at}`);
    }
})();
