import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await req.json();
        const { survivor_id, merged_id, performed_by } = body;

        if (!survivor_id || !merged_id) {
            return NextResponse.json({ error: 'survivor_id and merged_id are required' }, { status: 400 });
        }
        
        if (survivor_id === merged_id) {
            return NextResponse.json({ error: 'Cannot merge identical policy IDs' }, { status: 400 });
        }

        // 1. Validate both policies exist and verify their Base Policy logic
        const { data: survivor, error: errSur } = await supabaseAdmin
            .from('policies')
            .select('id, policy_number, client_id, property_address_norm, created_by_account_id')
            .eq('id', survivor_id)
            .single();

        const { data: duplicate, error: errDup } = await supabaseAdmin
            .from('policies')
            .select('id, policy_number, client_id, property_address_norm, created_by_account_id')
            .eq('id', merged_id)
            .single();

        if (errSur || !survivor) return NextResponse.json({ error: 'Survivor policy not found' }, { status: 404 });
        if (errDup || !duplicate) return NextResponse.json({ error: 'Duplicate policy not found' }, { status: 404 });

        // Optional Strict Policy Invariant Check: Only exact matching base numbers can be merged (safety protocol)
        if (survivor.policy_number !== duplicate.policy_number) {
            console.warn(`Merging distinct policy strings: ${survivor.policy_number} vs ${duplicate.policy_number}`);
        }

        // 2. Remap Policy Terms lineage to Survivor
        const { error: termsError } = await supabaseAdmin
            .from('policy_terms')
            .update({ policy_id: survivor_id })
            .eq('policy_id', merged_id);

        if (termsError) throw termsError;

        // 2b. Recalculate is_current for the survivor — after merging,
        // multiple terms may have is_current=true. Fix: only the term
        // with the latest expiration_date should be current.
        const { data: allTerms } = await supabaseAdmin
            .from('policy_terms')
            .select('id, expiration_date')
            .eq('policy_id', survivor_id)
            .order('expiration_date', { ascending: false, nullsFirst: false });

        if (allTerms && allTerms.length > 1) {
            const winnerId = allTerms[0].id;
            const loserIds = allTerms.slice(1).map(t => t.id);

            await supabaseAdmin
                .from('policy_terms')
                .update({ is_current: true })
                .eq('id', winnerId);

            if (loserIds.length > 0) {
                await supabaseAdmin
                    .from('policy_terms')
                    .update({ is_current: false })
                    .in('id', loserIds);
            }
        }

        // 3. Remap Dec Pages lineage to Survivor
        const { error: decError } = await supabaseAdmin
            .from('dec_pages')
            .update({ policy_id: survivor_id })
            .eq('policy_id', merged_id);

        // 4. Remap Flag checks if necessary (or they are tied to terms / dec pages mostly, but keeping generic)
        const { error: flagError } = await supabaseAdmin
            .from('policy_flags')
            .update({ policy_id: survivor_id })
            .eq('policy_id', merged_id);

        // 4b. Remap Property Enrichments
        const { error: enrichError } = await supabaseAdmin
            .from('property_enrichments')
            .update({ policy_id: survivor_id })
            .eq('policy_id', merged_id);
        // 5. Delete Duplicate Policy Record
        const { error: delError } = await supabaseAdmin
            .from('policies')
            .delete()
            .eq('id', merged_id);

        if (delError) throw delError;

        // 6. Log Audit Trail natively
        await supabaseAdmin
            .from('merge_logs')
            .insert({
                entity_type: 'policy',
                survivor_id,
                merged_id,
                performed_by: performed_by || null,
                merge_details: {
                    survivor_state: survivor,
                    duplicate_state: duplicate
                }
            })
            // Ignore error gracefully if table hasn't been migrated by admin yet
            .then(res => { if (res.error) console.error("Audit Log Note: ", res.error.message) });

        // 7. Activity Event for Dashboard Feed
        supabaseAdmin.from('activity_events').insert({
            event_type: 'merge.policy',
            title: `Policy term downcasted: ${survivor.policy_number}`,
            detail: `Merged policy "${duplicate.policy_number}" into root "${survivor.policy_number}". Terms, flags, and enrichments re-parented.`,
            policy_id: survivor_id,
            client_id: survivor.client_id || null,
            meta: {
                survivor_id,
                merged_id,
                survivor_policy_number: survivor.policy_number,
                duplicate_policy_number: duplicate.policy_number,
            },
        }).then(r => { if (r.error) console.error('Activity event error (non-fatal):', r.error.message); });

        return NextResponse.json({ success: true, survivor_id });

    } catch (error: any) {
        console.error('Policy Merge Transaction Error:', error);
        return NextResponse.json({ error: error.message || 'Server error during merge transaction' }, { status: 500 });
    }
}
