const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    let res2 = await supabase.from('policies').select('id, status').not('status', 'in', '("expired","cancelled","non_renewed")').neq('client_id', '00000000-0000-4000-a000-000000000001');
    console.log("With quotes string:", res2.data ? res2.data.length : res2.error);
    
    let res3 = await supabase.from('policies').select('id, status').not('status', 'in', '(expired,cancelled,non_renewed)').neq('client_id', '00000000-0000-4000-a000-000000000001');
    console.log("No quotes string:", res3.data ? res3.data.length : res3.error);

    let res4 = await supabase.from('policies').select('id, status').neq('client_id', '00000000-0000-4000-a000-000000000001');
    console.log("Total policies:", res4.data ? res4.data.length : res4.error);
}
test();
