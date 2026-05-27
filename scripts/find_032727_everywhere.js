const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qbihizqbtimwvhxkneeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU';

const admin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('=== Finding 032727 CAROL MCELWEE.pdf ===');
    const { data: platformDocs } = await admin.from('platform_documents').select('id, file_name, doc_type').ilike('file_name', '%032727%');
    console.log('platform_documents by file_name:', platformDocs);
    
    // Also check storage objects
    const { data: storageObjects, error: sErr } = await admin.storage.from('documents').list('', { search: '032727' });
    console.log('storage objects (documents):', storageObjects);

    const { data: storageObjects2 } = await admin.storage.from('dec-pages').list('', { search: '032727' });
    console.log('storage objects (dec-pages):', storageObjects2);
}

main().catch(console.error);
