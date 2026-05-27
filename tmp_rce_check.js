const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://qbihizqbtimwvhxkneeb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU'
);

(async () => {
  // === RCE #3 - Carlos Melendez Gallardo (the one that found candidates) ===
  const clientId = 'aa23bf28-17b5-446f-b228-1e610a17d2a8';
  const policyId = '33ea18da-db13-4e76-86af-86e17b19acfc';

  const { data: client } = await sb.from('clients').select('id, named_insured').eq('id', clientId).single();
  console.log('=== MATCHED CLIENT ===');
  console.log(JSON.stringify(client, null, 2));

  const { data: policy } = await sb.from('policies')
    .select('id, client_id, policy_number, carrier_name, property_address_raw, property_address_norm')
    .eq('id', policyId).single();
  console.log('\n=== MATCHED POLICY ===');
  console.log(JSON.stringify(policy, null, 2));

  // Get the full match_log with candidate details
  const { data: doc } = await sb.from('platform_documents')
    .select('match_log')
    .eq('doc_type', 'rce')
    .eq('client_id', clientId)
    .single();

  if (doc && doc.match_log) {
    const candStep = doc.match_log.find(l => l.step === 'candidates');
    if (candStep && candStep.details && candStep.details.candidates) {
      console.log('\n=== CANDIDATE DETAILS ===');
      candStep.details.candidates.forEach((c, i) => {
        console.log(`Candidate #${i + 1}:`, JSON.stringify(c, null, 2));
      });
    }
  }

  // === Check for the two no_match RCEs — do these clients exist? ===
  console.log('\n=== JOSEFINA JUAREZ - does this client exist? ===');
  const { data: josefina } = await sb.from('clients').select('id, named_insured')
    .ilike('named_insured', '%josefina%juarez%');
  console.log('Exact match results:', josefina);

  console.log('\n=== MARI DELROCIO VARGAS - does this client exist? ===');
  const { data: mari } = await sb.from('clients').select('id, named_insured')
    .ilike('named_insured', '%vargas%');
  console.log('Vargas clients:', mari);

  // Check addresses
  console.log('\n=== Address check: 6958 REMMET AVE ===');
  const { data: remmet } = await sb.from('policies').select('id, client_id, property_address_raw, property_address_norm')
    .ilike('property_address_raw', '%remmet%');
  console.log('Remmet Ave policies:', remmet);

  console.log('\n=== Address check: 515 N SANTA MONICA ST ===');
  const { data: santaMonica } = await sb.from('policies').select('id, client_id, property_address_raw, property_address_norm')
    .ilike('property_address_raw', '%santa monica%');
  console.log('Santa Monica policies:', santaMonica);
})();
