const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: terms, error } = await supabase
        .from('policy_terms')
        .select('*')
        .eq('policy_id', '09b3edc1-f56e-4e2f-9181-8f849a2e83f8');
        
    console.log("Terms for root policy:", JSON.stringify(terms, null, 2));

    const { data: logs } = await supabase
        .from('merge_logs')
        .select('*')
        .eq('survivor_id', '09b3edc1-f56e-4e2f-9181-8f849a2e83f8')
        .order('created_at', { ascending: false })
        .limit(1);

    console.log("\nMerge Log:", JSON.stringify(logs, null, 2));
}
check();
