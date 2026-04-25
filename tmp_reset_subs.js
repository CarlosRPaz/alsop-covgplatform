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

(async () => {
    // Check what columns dec_page_submissions actually has
    const { data: sample } = await sb.from('dec_page_submissions')
        .select('*')
        .limit(1);
    if (sample && sample[0]) {
        console.log('dec_page_submissions columns:', Object.keys(sample[0]).join(', '));
    }

    // Reset submissions to queued (only status + error_message)
    const subs = [
        '88154519-88ab-4c93-8f00-b641805db2fd',
        '0950c402-2652-43a8-aa90-df0460289dce',
        'dd53f31e-dc48-4be1-a673-76c955430b25',
        '09d50a94-f901-429d-93ed-b944099aa674',
        '36760804-e978-45fc-836c-63a819a42744',
        '756841a3-b6ca-49a7-90cf-ed6ffa1f4cb1',
        '225ca7cc-0286-4895-9898-049f415d5700',
        '65da0ed1-77d6-4c7d-8831-a0a186471a8f',
        '4ddf736a-7cb1-49b8-9c32-ebe377ab995f',
        '9880523c-d792-4a82-abde-03e0998cdd9a',
        'e536bab7-5ab7-4480-9891-8dfd3926e36d',
        'bd19014f-8d35-4ebb-8d77-d02a6a325ce7',
        '7e65120c-920f-432f-b162-d5ecd44d2344',
        'a2648d15-a743-4073-9f97-2857b2fe677e',
        '916097d9-c6e3-441b-afd8-5857a1bd2990',
    ];
    for (const sid of subs) {
        const { error } = await sb.from('dec_page_submissions').update({
            status: 'queued',
            error_message: null,
        }).eq('id', sid);
        if (error) console.error(`Error resetting ${sid.substring(0,8)}:`, error.message);
        else console.log(`Reset ${sid.substring(0,8)} → queued`);
    }
    console.log('\nDone!');
})();
