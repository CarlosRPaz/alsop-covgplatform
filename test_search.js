// Test with ANON key (same as frontend uses)
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim();
    }
});

const { createClient } = require('@supabase/supabase-js');

// Use ANON key like the frontend does
const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
    // Simulate being logged in - the frontend uses the user's session
    // For anon key, RLS applies. Let's test without auth first
    
    console.log('=== Test with ANON key (no auth) ===');
    
    // Auto-recommend query
    const { data: d1, error: e1 } = await sb
        .from('policies')
        .select('id, policy_number, property_address_raw, carrier_name, client_id, clients!inner (id, named_insured)')
        .ilike('clients.named_insured', '%chavez%')
        .limit(6);
    console.log('Auto-recommend "chavez" - Error:', JSON.stringify(e1));
    console.log('Count:', d1?.length);
    
    // Manual search - policy fields
    const { data: d2, error: e2 } = await sb
        .from('policies')
        .select('id, policy_number, property_address_raw, carrier_name, client_id, clients (id, named_insured)')
        .or('policy_number.ilike.%chavez%,property_address_raw.ilike.%chavez%')
        .limit(5);
    console.log('\nManual search policy fields "chavez" - Error:', JSON.stringify(e2));
    console.log('Count:', d2?.length);
    
    // Manual search - client name
    const { data: d3, error: e3 } = await sb
        .from('policies')
        .select('id, policy_number, property_address_raw, carrier_name, client_id, clients!inner (id, named_insured)')
        .ilike('clients.named_insured', '%chavez%')
        .limit(5);
    console.log('\nManual search client name "chavez" - Error:', JSON.stringify(e3));
    console.log('Count:', d3?.length);
}

test().catch(console.error);
