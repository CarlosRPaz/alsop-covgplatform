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

async function inspect() {
    // PostgREST doesn't directly expose information_schema securely, but we can query 1 row to see keys
    const tables = ['clients', 'policies', 'policy_terms'];
    for (const t of tables) {
        const { data, error } = await sb.from(t).select('*').limit(1);
        console.log(`\n=== Table: ${t} ===`);
        if (error) console.error(error);
        else if (data && data.length > 0) console.log(Object.keys(data[0]).join(', '));
        else console.log("Table is empty, cannot infer columns.");
    }
}
inspect();
