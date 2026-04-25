const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
        const [k, ...rest] = line.split('=');
        env[k.trim()] = rest.join('=').trim();
    }
});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Creating merge_logs table...");
    try {
        // Drop it just in case we hit weird constraint issues during prototyping testing
        // await sb.rpc('exec_sql', { query: `DROP TABLE IF EXISTS merge_logs;` }); // Only if exec_sql worked

        const { error: insErr } = await sb.from('merge_logs').select('id').limit(1);
        if (!insErr) {
            console.log("Merge logs table already exists or is fully queryable!");
        } else {
             // Since RPC is unavailable locally, we will establish via pg if possible,
             // or write it into `supabase/migrations/` and tell the user. 
             // We can actually use Postgrest JS client to proxy the payload gracefully later.
             console.log("Table cannot be queried:", insErr.message);
        }
    } catch(e) {
        console.error(e);
    }
}
run();
