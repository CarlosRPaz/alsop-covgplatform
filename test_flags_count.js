const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://qbihizqbtimwvhxkneeb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWhpenFidGltd3ZoeGtuZWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE2OTExNSwiZXhwIjoyMDgxNzQ1MTE1fQ.nb7eSlJkSZE-iXJMHtiLvhlMzpCzlaA-_usl8bLOIoU');

async function test() {
    let { count, error } = await supabase
        .from('policy_flags')
        .select('*', { count: 'exact', head: true })
        .in('severity', ['high', 'critical'])
        .eq('status', 'open');

    console.log("Total HIGH/CRITICAL flags in database:", count, error || '');

    let activeFlags = await supabase
        .from('policy_flags')
        .select(`
            severity,
            policies!inner(status)
        `)
        .in('severity', ['high', 'critical'])
        .eq('status', 'open');

    // Filter JS side
    const activeCount = activeFlags.data ? activeFlags.data.filter(f => !['expired', 'cancelled', 'non_renewed'].includes(f.policies.status)).length : 0;
    console.log("Total ACTIVE high/critical flags:", activeCount, activeFlags.error || '');

    // Check total policies with any high/critical flag
    let activeFlagsPolicies = await supabase
        .from('policy_flags')
        .select(`
            policy_id,
            policies!inner(status, client_id)
        `)
        .in('severity', ['high', 'critical'])
        .eq('status', 'open');

    const activeValidPolicies = activeFlagsPolicies.data
        ? new Set(activeFlagsPolicies.data.filter(f =>
            !['expired', 'cancelled', 'non_renewed'].includes(f.policies.status) && f.policies.client_id !== '00000000-0000-4000-a000-000000000001'
        ).map(f => f.policy_id)).size
        : 0;

    console.log("Unique ACTIVE policies with high/critical flags:", activeValidPolicies, activeFlagsPolicies.error || '');
}
test();
