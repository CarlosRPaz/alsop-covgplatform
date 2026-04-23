const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
    'https://qbihizqbtimwvhxkneeb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU'
);

(async () => {
    const now = new Date().toISOString();

    // Requeue the first failed job (reset attempts so it gets picked up)
    const jobId = 'fc4f6e84-852b-4abf-a519-978b3020d227';
    const submissionId = 'e5e8eb3a-5ce8-467a-a4cd-f00b56a3520a';

    const { data, error } = await sb.from('ingestion_jobs').update({
        status: 'queued',
        attempts: 0,
        locked_at: null,
        locked_by: null,
        run_after: now,
        last_error: 'Manually requeued after upsert_policy fix',
        updated_at: now,
    }).eq('id', jobId);
    
    console.log('REQUEUE JOB:', error ? error.message : 'SUCCESS');

    // Also reset submission status
    const { error: e2 } = await sb.from('dec_page_submissions').update({
        status: 'queued',
        error_message: null,
        processing_step: 'creating_records',
        updated_at: now,
    }).eq('id', submissionId);
    
    console.log('RESET SUBMISSION:', e2 ? e2.message : 'SUCCESS');

    // Mark the second duplicate job as superseded so it doesn't also retry
    const dupJobId = '447c6fb1-b384-4994-9f47-a75e42f664c1';
    const { error: e3 } = await sb.from('ingestion_jobs').update({
        status: 'failed',
        last_error: 'Superseded — duplicate job for same submission, other job requeued',
        updated_at: now,
    }).eq('id', dupJobId);
    
    console.log('SUPERSEDE DUP JOB:', e3 ? e3.message : 'SUCCESS');

    process.exit(0);
})();
