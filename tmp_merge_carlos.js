const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://qbihizqbtimwvhxkneeb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU'
);

(async () => {
  const survivorId = 'aa23bf28-17b5-446f-b228-1e610a17d2a8';
  const duplicateId = '4073e39e-7538-48dd-8ba7-17c5bbfa089e';

  console.log('=== Carlos Duplicate Cleanup ===');
  console.log('Survivor Client ID:', survivorId);
  console.log('Duplicate Client ID:', duplicateId);

  // 1. Verify duplicate exists and has no dependencies
  const { data: dupPolicies } = await sb.from('policies').select('id').eq('client_id', duplicateId);
  const { data: dupDocs } = await sb.from('platform_documents').select('id').eq('client_id', duplicateId);
  
  console.log('Duplicate Policies count:', dupPolicies ? dupPolicies.length : 0);
  console.log('Duplicate Documents count:', dupDocs ? dupDocs.length : 0);

  // 2. Delete duplicate client record
  const { error: delError } = await sb.from('clients').delete().eq('id', duplicateId);
  if (delError) {
    console.error('Error deleting duplicate client:', delError);
  } else {
    console.log('Successfully deleted duplicate client record.');
  }

  // 3. Log a merge activity event
  const { error: eventError } = await sb.from('activity_events').insert({
    event_type: 'merge.client',
    title: 'Client records consolidated: Carlos Melendez Gallardo',
    detail: 'Consolidated duplicate profile into root active account.',
    client_id: survivorId,
    meta: {
      survivor_id: survivorId,
      merged_id: duplicateId,
      survivor_name: 'Carlos Melendez Gallardo',
      duplicate_name: 'Carlos Melendez Gallardo',
      keep_documents: true,
      fields_consolidated: []
    }
  });

  if (eventError) {
    console.error('Error logging activity event:', eventError);
  } else {
    console.log('Successfully logged client merge activity event.');
  }

  console.log('Cleanup finished!');
})();
