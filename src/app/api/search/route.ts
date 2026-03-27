import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

/**
 * GET /api/search?q=<query>
 *
 * Global search across clients and policies.
 * Returns up to 5 clients + 5 policies matching the query.
 */
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
        return NextResponse.json({ clients: [], policies: [] });
    }

    const supabase = getSupabaseAdmin();
    const pattern = `%${q}%`;

    // Search clients by name, email, or phone
    const clientsPromise = supabase
        .from('clients')
        .select('id, named_insured, email, phone')
        .or(`named_insured.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(5);

    // Search policies by policy number or address
    const policiesPromise = supabase
        .from('policies')
        .select('id, policy_number, property_address_raw, carrier_name, client_id, clients(named_insured)')
        .or(`policy_number.ilike.${pattern},property_address_raw.ilike.${pattern},carrier_name.ilike.${pattern}`)
        .limit(5);

    const [clientsRes, policiesRes] = await Promise.all([clientsPromise, policiesPromise]);

    const clients = (clientsRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.named_insured || 'Unknown',
        email: c.email || null,
        phone: c.phone || null,
        type: 'client' as const,
    }));

    const policies = (policiesRes.data || []).map((p: any) => ({
        id: p.id,
        policyNumber: p.policy_number || '—',
        address: p.property_address_raw || '—',
        carrier: p.carrier_name || '—',
        clientName: p.clients?.named_insured || '—',
        type: 'policy' as const,
    }));

    return NextResponse.json({ clients, policies });
}
