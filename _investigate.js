const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
    'https://qbihizqbtimwvhxkneeb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU'
);

(async () => {
    const correctPropertyAddr = '2800 Huston Pl, Lancaster, CA 93536';
    const correctPropertyNorm = '2800 HUSTON PL LANCASTER CA 93536';
    const correctMailing = '725 S. Figueroa Street, Suite 3900, Los Angeles, CA 90017';
    const now = new Date().toISOString();

    // 1. Fix the policy record
    const { error: e1 } = await sb.from('policies').update({
        property_address_raw: correctPropertyAddr,
        property_address_norm: correctPropertyNorm,
        updated_at: now,
    }).eq('id', '4bf2ac2c-4a00-454f-9b3f-e1ee9453a9aa');
    console.log('FIX POLICY:', e1 ? e1.message : 'SUCCESS');

    // 2. Fix the dec_page record
    const { error: e2 } = await sb.from('dec_pages').update({
        property_location: correctPropertyAddr,
        mailing_address: correctMailing,
    }).eq('id', 'b3825e69-8503-44f7-8bb7-9f6d9763a0a2');
    console.log('FIX DEC_PAGE:', e2 ? e2.message : 'SUCCESS');

    // 3. Fix the policy_term record
    const { error: e3 } = await sb.from('policy_terms').update({
        property_location: correctPropertyAddr,
        updated_at: now,
    }).eq('id', 'e1e8f974-e87a-43b3-b3b6-d7b7a7206a6b');
    console.log('FIX POLICY_TERM:', e3 ? e3.message : 'SUCCESS');

    process.exit(0);
})();
