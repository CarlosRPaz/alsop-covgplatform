const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.rpc('query_schema', { query: `
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'policy_id' AND table_schema = 'public';
    `});
    
    if (error) {
        console.log("No rpc or error:", error.message);
    } else {
        console.log("Tables with policy_id:", data);
    }
}
check();
