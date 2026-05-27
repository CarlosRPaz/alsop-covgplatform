const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qbihizqbtimwvhxkneeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU';

const admin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('=== Finding 032727 CAROL MCELWEE.pdf ===');
    const { data: docs, error } = await admin
        .from('platform_documents')
        .select('id, file_name, doc_type, account_id')
        .ilike('file_name', '%032727 CAROL MCELWEE.pdf%');

    if (error) {
        console.error('Error finding doc:', error);
        return;
    }

    if (!docs || docs.length === 0) {
        console.log('No document found with that name.');
        return;
    }

    console.log('Found docs:', docs);
    const doc = docs[0];

    // Change doc_type to dec_page if it isn't already
    if (doc.doc_type !== 'dec_page') {
        console.log(`Changing doc_type from ${doc.doc_type} to dec_page...`);
        const { error: updateErr } = await admin
            .from('platform_documents')
            .update({ doc_type: 'dec_page' })
            .eq('id', doc.id);
        if (updateErr) {
            console.error('Error updating doc_type:', updateErr);
            return;
        }
    }

    // Now trigger retry
    console.log(`Triggering retry for ${doc.id}...`);
    await admin.from('doc_data_rce').delete().eq('document_id', doc.id);
    await admin.from('doc_data_dic').delete().eq('document_id', doc.id);

    await admin
        .from('ingestion_jobs')
        .update({ status: 'failed', last_error: 'Superseded by manual retry as dec_page' })
        .eq('document_id', doc.id)
        .in('status', ['queued', 'processing']);

    await admin
        .from('platform_documents')
        .update({
            parse_status: 'pending',
            processing_step: 'queued',
            match_status: 'pending',
            match_confidence: null,
            match_log: [],
            error_message: null,
            writeback_status: 'none',
            writeback_log: [],
            raw_text: null,
            extracted_owner_name: null,
            extracted_address: null,
            extracted_address_norm: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

    const { error: jobError } = await admin
        .from('ingestion_jobs')
        .insert({
            document_id: doc.id,
            account_id: doc.account_id,
            status: 'queued',
            attempts: 0,
            max_attempts: 5,
        });

    if (jobError) {
        console.error('Failed to queue job:', jobError);
    } else {
        console.log('Retry queued successfully as a dec_page for', doc.id);
    }
}

main().catch(console.error);
