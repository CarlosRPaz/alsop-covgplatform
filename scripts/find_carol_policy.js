const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qbihizqbtimwvhxkneeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const policyId = 'CFP 0100367475';
    // wait, I need the UUID of the policy. I'll search by policy_number
    const { data: pol } = await sb.from('policies')
        .select('id, policy_number, client_id')
        .eq('policy_number', policyId)
        .single();
        
    console.log('Policy:', pol);
    if (!pol) return;

    // check platform_documents by policy_id
    const { data: docs } = await sb.from('platform_documents')
        .select('id, doc_type, original_filename, created_at, parse_status')
        .eq('policy_id', pol.id);
    console.log('Documents linked to policy:', docs);
    
    // check dec_pages
    const { data: decs } = await sb.from('dec_pages')
        .select('id, document_id, submission_id, property_location')
        .eq('policy_id', pol.id);
    console.log('Dec pages linked to policy:', decs);
}

main().catch(console.error);
