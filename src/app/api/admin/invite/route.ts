import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { env } from '@/lib/env';

/**
 * POST /api/admin/invite
 *
 * Invite a new user to the CFP Platform.
 * ADMIN ONLY — server-side role check enforced via Bearer token.
 *
 * Uses Supabase auth.admin.inviteUserByEmail() which:
 * 1. Sends a Supabase-managed invite email with a secure magic link
 * 2. Stores the role in the user's auth metadata
 * 3. Our DB trigger then copies role from auth metadata → accounts table on signup
 *
 * Body: { email: string, role: 'admin' | 'service' | 'customer', firstName?: string, lastName?: string }
 * Returns: { success: boolean, email: string, role: string, error?: string }
 */

type InviteRole = 'admin' | 'service' | 'customer';

const ROLE_LABELS: Record<InviteRole, string> = {
    admin: 'Administrator',
    service: 'Agent',
    customer: 'Client',
};

export async function POST(req: NextRequest) {
    try {
        // ── Auth check: admin only (via Bearer token) ──
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required — please sign in and try again.' },
                { status: 401 }
            );
        }

        const token = authHeader.slice(7);
        const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Session expired — please sign in again.' },
                { status: 401 }
            );
        }

        // Look up role from accounts table
        const supabaseAdmin = getSupabaseAdmin();
        const { data: account } = await supabaseAdmin
            .from('accounts')
            .select('id, email, role')
            .eq('id', user.id)
            .single();

        if (!account || account.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden — admin access required' },
                { status: 403 }
            );
        }

        const profile = account;

        const body = await req.json();
        const { email, role, firstName, lastName } = body as {
            email?: string;
            role?: InviteRole;
            firstName?: string;
            lastName?: string;
        };

        // ── Validate ──
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
        }

        const normalizedRole = role as InviteRole;
        if (!normalizedRole || !['admin', 'service', 'customer'].includes(normalizedRole)) {
            return NextResponse.json(
                { error: 'Invalid role — must be admin, service, or customer' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // ── Invite via Supabase Admin (handles invite email + secure token) ──
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
                role: normalizedRole,
                first_name: firstName || '',
                last_name: lastName || '',
                invited_by: profile.id,
                invited_at: new Date().toISOString(),
            },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://coveragechecknow.com'}/auth/accept-invite`,
        });

        if (error) {
            // Handle common errors gracefully
            if (error.message?.includes('already been registered')) {
                return NextResponse.json(
                    { error: 'A user with this email address already exists.' },
                    { status: 409 }
                );
            }
            console.error('[Admin Invite] Supabase invite error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ── Log to activity events ──
        await supabase.from('activity_events').insert({
            event_type: 'user.invited',
            title: `User invited: ${email}`,
            detail: `Role: ${ROLE_LABELS[normalizedRole]} (${normalizedRole}) · Invited by: ${profile.email || profile.id}`,
            meta: {
                invitedEmail: email,
                role: normalizedRole,
                roleLabel: ROLE_LABELS[normalizedRole],
                invitedBy: profile.id,
                invitedByEmail: profile.email,
            },
        });

        return NextResponse.json({
            success: true,
            email,
            role: normalizedRole,
            roleLabel: ROLE_LABELS[normalizedRole],
            userId: data.user?.id,
        });

    } catch (err: any) {
        console.error('[Admin Invite] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
