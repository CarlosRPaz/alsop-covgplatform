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

const sids = [
    'bd19014f-8d35-4ebb-8d77-d02a6a325ce7',
    'e536bab7-5ab7-4480-9891-8dfd3926e36d',
    '4ddf736a-7cb1-49b8-9c32-ebe377ab995f',
    '36760804-e978-45fc-836c-63a819a42744',
    '09d50a94-f901-429d-93ed-b944099aa674',
    '0950c402-2652-43a8-aa90-df0460289dce',
    '65da0ed1-77d6-4c7d-8831-a0a186471a8f',
    '88154519-88ab-4c93-8f00-b641805db2fd',
    '7e65120c-920f-432f-b162-d5ecd44d2344',
    '756841a3-b6ca-49a7-90cf-ed6ffa1f4cb1',
    '9880523c-d792-4a82-abde-03e0998cdd9a',
];

async function report() {
    console.log("=== SUBMISSION PROCESSING REPORT ===\n");
    const { data: subs, error } = await sb.from('dec_page_submissions')
        .select(`
            id, file_name, status,
            dec_pages (
                insured_name, policy_number, property_location
            )
        `)
        .in('id', sids);

    if (error) {
        console.error(error);
        return;
    }

    let parsedCount = 0;
    let failedCount = 0;
    let queuedCount = 0;

    for (const sub of (subs || [])) {
        console.log(`File: ${sub.file_name.substring(0,25)} | Status: ${sub.status}`);
        if (sub.status === 'parsed' || sub.status === 'done') {
            parsedCount++;
            if (sub.dec_pages && sub.dec_pages.length > 0) {
                const dp = sub.dec_pages[0];
                console.log(`  └─> Extracted: ${dp.insured_name} - ${dp.policy_number}`);
            }
        } else if (sub.status === 'queued' || sub.status === 'processing') {
            queuedCount++;
        } else {
            failedCount++;
        }
    }

    console.log(`\nTotals: ${parsedCount} Parsed | ${queuedCount} In-Queue | ${failedCount} Failed`);
}
report();
