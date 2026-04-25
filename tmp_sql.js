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
    const { data, error } = await sb.rpc('exec_sql', { query: `
        ALTER TABLE policy_terms ADD COLUMN IF NOT EXISTS term_sequence VARCHAR(10);
    `});
    if (error) console.error("Error:", error);
    else console.log("Added column:", data);
}
run();
