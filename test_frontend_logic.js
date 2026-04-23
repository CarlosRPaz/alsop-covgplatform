const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim();
    }
});

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
    const docStatus = {
        extracted_owner_name: 'Chavez Family Trust dated January 16, 2026',
        file_name: 'Adrian Chavez bamboo updated dec page.pdf'
    };

    const searchTerms = [];
    const seen = new Set();

    const addTerm = (t) => {
        const clean = t.toLowerCase().trim();
        if (clean.length >= 3 && !seen.has(clean)) { seen.add(clean); searchTerms.push(clean); }
    };

    const stopWords = new Set([
        'dec', 'page', 'pdf', 'updated', 'new', 'bamboo', 'aegis', 'psic', 'dic', 'document', 'scan', 'copy', 'file',
        'trust', 'family', 'dated', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
    ]);

    // 1. Terms from file name first (highest signal, agent-provided)
    if (docStatus.file_name) {
        const nameNoExt = docStatus.file_name.replace(/\.[^.]+$/, '');
        const fileWords = nameNoExt.replace(/[^a-zA-Z\s-]/g, ' ').split(/\s+/).filter(Boolean);
        for (const w of fileWords) {
            if (!stopWords.has(w.toLowerCase())) {
                addTerm(w);
            }
        }
    }

    // 2. Terms from extracted owner name
    if (docStatus.extracted_owner_name) {
        const words = docStatus.extracted_owner_name.replace(/[^a-zA-Z\s-]/g, '').split(/\s+/).filter(Boolean);
        if (words.length > 1) {
            const lastWord = words[words.length - 1];
            const firstWord = words[0];
            if (!stopWords.has(lastWord.toLowerCase())) addTerm(lastWord);
            if (!stopWords.has(firstWord.toLowerCase())) addTerm(firstWord);
        } else if (words.length === 1) {
            if (!stopWords.has(words[0].toLowerCase())) addTerm(words[0]);
        }
    }

    console.log('Search terms:', searchTerms);

    const allResults = [];
    const seenIds = new Set();

    for (const term of searchTerms.slice(0, 4)) {
        console.log(`Querying: ${term}`);
        const { data, error } = await sb
            .from('policies')
            .select(`
                id,
                policy_number,
                property_address_raw,
                carrier_name,
                client_id,
                clients!inner (
                    id,
                    named_insured
                )
            `)
            .ilike('clients.named_insured', `%${term}%`)
            .limit(6);
            
        if (error) console.error('Error:', error);

        if (data) {
            console.log(`Found ${data.length} for ${term}`);
            for (const row of data) {
                if (!seenIds.has(row.id)) {
                    seenIds.add(row.id);
                    allResults.push(row);
                }
            }
        }
    }

    const finalResults = allResults.slice(0, 8);
    console.log('\nFinal Results Count:', finalResults.length);
    finalResults.forEach(r => console.log(`- ${r.policy_number} / ${r.clients.named_insured}`));
}

test().catch(console.error);
