const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // get tables with policy_term_id
    const { data, error } = await supabase.rpc('query_schema', { query: `
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'policy_term_id' AND table_schema = 'public';
    `});
    
    if (error) {
        console.log("No rpc or error:", error.message);
        // Fallback: manually list tables we suspect
        console.log("Guessing: dec_pages, policy_flags, property_enrichments, platform_documents");
    } else {
        console.log("Tables with policy_term_id:", data);
    }
}
check();
