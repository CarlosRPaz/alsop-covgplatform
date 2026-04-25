import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await req.json();
        const { survivor_id, merged_id, performed_by, consolidated_fields, keep_documents = true } = body;

        if (!survivor_id || !merged_id) {
            return NextResponse.json({ error: 'survivor_id and merged_id are required' }, { status: 400 });
        }
        
        if (survivor_id === merged_id) {
            return NextResponse.json({ error: 'Cannot merge identical client IDs' }, { status: 400 });
        }

        // 1. Validate both clients exist
        const { data: survivor, error: errSur } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', survivor_id)
            .single();

        const { data: duplicate, error: errDup } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', merged_id)
            .single();

        if (errSur || !survivor) return NextResponse.json({ error: 'Survivor client not found' }, { status: 404 });
        if (errDup || !duplicate) return NextResponse.json({ error: 'Duplicate client not found' }, { status: 404 });

        // 2 & 3. Remap associated Policies and Docs (ONLY if keep_documents is true)
        if (keep_documents) {
            const { error: polError } = await supabaseAdmin
                .from('policies')
                .update({ client_id: survivor_id })
                .eq('client_id', merged_id);
            if (polError) throw polError;

            const { error: decError } = await supabaseAdmin
                .from('dec_pages')
                .update({ client_id: survivor_id })
                .eq('client_id', merged_id);
            if (decError) throw decError;
        }

        // 4. Consolidate contact data via explicit agent selection picking
        let finalConsolidatedFields: Record<string, any> = {};
        if (consolidated_fields && Object.keys(consolidated_fields).length > 0) {
            // Validate safety constraints on incoming fields
            const safeFields = ['named_insured', 'email', 'phone', 'mailing_address_raw', 'mailing_address_norm'];
            const safeUpdatePayload: Record<string, any> = {};
            for (const key of safeFields) {
                if (consolidated_fields[key] !== undefined) {
                    safeUpdatePayload[key] = consolidated_fields[key];
                }
            }
            if (Object.keys(safeUpdatePayload).length > 0) {
                await supabaseAdmin.from('clients').update(safeUpdatePayload).eq('id', survivor_id);
                finalConsolidatedFields = safeUpdatePayload;
            }
        }

        // 5. Delete Duplicate Record
        const { error: delError } = await supabaseAdmin
            .from('clients')
            .delete()
            .eq('id', merged_id);

        if (delError) throw delError;

        // 6. Log Audit Trail
        await supabaseAdmin
            .from('merge_logs')
            .insert({
                entity_type: 'client',
                survivor_id,
                merged_id,
                performed_by: performed_by || null,
                merge_details: {
                    survivor_state: survivor,
                    duplicate_state: duplicate,
                    consolidated_fields: finalConsolidatedFields
                }
            })
            // Ignore error gracefully if table hasn't been migrated by admin yet
            .then(res => { if (res.error) console.error("Audit Log Note: ", res.error.message) });

        // 7. Activity Event for Dashboard Feed
        const survivorName = finalConsolidatedFields.named_insured || survivor.named_insured || 'Unknown';
        const dupName = duplicate.named_insured || 'Unknown';
        supabaseAdmin.from('activity_events').insert({
            event_type: 'merge.client',
            title: `Client records consolidated: ${survivorName}`,
            detail: `Merged "${dupName}" into "${survivorName}". ${keep_documents ? 'All policies and documents migrated.' : 'Documents not migrated.'}`,
            client_id: survivor_id,
            meta: {
                survivor_id,
                merged_id,
                survivor_name: survivorName,
                duplicate_name: dupName,
                keep_documents,
                fields_consolidated: Object.keys(finalConsolidatedFields),
            },
        }).then(r => { if (r.error) console.error('Activity event error (non-fatal):', r.error.message); });

        return NextResponse.json({ success: true, survivor_id });

    } catch (error: any) {
        console.error('Client Merge Transaction Error:', error);
        return NextResponse.json({ error: error.message || 'Server error during merge transaction' }, { status: 500 });
    }
}
