import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

/**
 * POST /api/flags/evaluate
 *
 * On-demand flag evaluation for a specific policy.
 * Fetches policy, current term, and client data, then runs all flag checks.
 * Creates/refreshes open flags and auto-resolves cleared conditions.
 *
 * Body: { policy_id: string }
 */

const RULE_VERSION = '1.0.0';

// Severity for each rule
interface FlagCheck {
    code: string;
    severity: string;
    title: string;
    category: string;
    entity_scope: 'policy' | 'client' | 'policy_term';
    auto_resolve: boolean;
    check: (ctx: EvalCtx) => string | null;
}

interface EvalCtx {
    policy_id: string;
    client_id: string | null;
    policy_term_id: string | null;
    data: Record<string, unknown>;       // coverage_data from term
    term: Record<string, unknown>;       // full term row
    client: Record<string, unknown>;     // full client row
    policy: Record<string, unknown>;     // full policy row
}

function get(ctx: EvalCtx, key: string): unknown {
    return ctx.data[key] || ctx.term[key] || ctx.client[key] || ctx.policy[key] || null;
}

function isMissing(val: unknown): boolean {
    if (val === null || val === undefined) return true;
    const s = String(val).trim();
    return s === '' || s === '0' || s === '$0' || s === '$0.00' || s === 'None';
}

function isZeroOrMissing(val: unknown): boolean {
    if (val === null || val === undefined) return true;
    const cleaned = String(val).replace(/[$,]/g, '').trim();
    try {
        return parseFloat(cleaned) <= 0;
    } catch {
        return false;
    }
}

// ── Check functions ──────────────────────────────────────────

function checkMissingField(key: string, label: string) {
    return (ctx: EvalCtx): string | null => {
        if (isMissing(get(ctx, key))) return `${label} is missing or empty.`;
        return null;
    };
}

function checkZeroValue(key: string, label: string) {
    return (ctx: EvalCtx): string | null => {
        const val = get(ctx, key);
        if (val === null || val === undefined) return null;
        if (isZeroOrMissing(val)) return `${label} is $0.`;
        return null;
    };
}

function checkNoDic(ctx: EvalCtx): string | null {
    const dic = ctx.term.dic_exists;
    if (dic === false) return 'DIC coverage is not on file for this policy term.';
    return null;
}

function checkRenewalUpcoming(ctx: EvalCtx): string | null {
    const exp = (ctx.term.expiration_date || ctx.data.policy_period_end) as string | null;
    if (!exp) return null;
    try {
        const expDate = new Date(exp);
        const now = new Date();
        const diffMs = expDate.getTime() - now.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days >= 0 && days <= 21) {
            return `Policy term expires in ${days} day${days !== 1 ? 's' : ''} (${expDate.toLocaleDateString()}).`;
        }
    } catch { /* ignore */ }
    return null;
}

function checkPersonalPropertyZeroOwner(ctx: EvalCtx): string | null {
    const occ = String(get(ctx, 'occupancy') || '').toLowerCase();
    if (!occ.includes('owner')) return null;
    const val = get(ctx, 'limit_personal_property');
    if (val === null || val === undefined) return null;
    if (isZeroOrMissing(val)) return 'Personal property (Coverage C) is $0 for owner-occupied property.';
    return null;
}

function checkDwellingRcNotIncluded(ctx: EvalCtx): string | null {
    const rc = get(ctx, 'limit_dwelling_replacement_cost');
    if (!rc) return null;
    const s = String(rc).toLowerCase().trim();
    if (['not included', 'no', 'false', 'excluded'].includes(s)) return 'Dwelling replacement cost is not included.';
    return null;
}

function checkDwellingRcLowOrdinance(ctx: EvalCtx): string | null {
    const rc = get(ctx, 'limit_dwelling_replacement_cost');
    if (!rc) return null;
    const rcStr = String(rc).toLowerCase();
    if (!rcStr.includes('included') && !rcStr.includes('yes')) return null;
    const ord = get(ctx, 'limit_ordinance_or_law');
    if (!ord) return 'Replacement cost is included but ordinance or law coverage is missing.';
    const cleaned = String(ord).replace(/[$,%]/g, '').trim();
    try {
        if (parseFloat(cleaned) < 10) return 'Replacement cost is included but ordinance or law coverage is very low.';
    } catch { /* ignore */ }
    return null;
}

function checkOtherStructuresZero(ctx: EvalCtx): string | null {
    const val = get(ctx, 'limit_other_structures');
    if (val === null || val === undefined) return null;
    if (isZeroOrMissing(val)) return 'Other structures coverage is $0.';
    return null;
}

function checkMortgageeDwellingZero(ctx: EvalCtx): string | null {
    const mortgagee = get(ctx, 'mortgagee_1_name');
    if (!mortgagee) return null;
    const dwelling = get(ctx, 'limit_dwelling');
    if (!dwelling) return 'Mortgagee is present but dwelling coverage is missing.';
    if (isZeroOrMissing(dwelling)) return 'Mortgagee is present but dwelling coverage is $0.';
    return null;
}

function checkFairRentalValue(ctx: EvalCtx): string | null {
    const val = get(ctx, 'limit_fair_rental_value');
    if (!val) return 'Fair rental value coverage is missing.';
    if (isZeroOrMissing(val)) return 'Fair rental value coverage is $0.';
    return null;
}

function checkEcmPremium(ctx: EvalCtx): string | null {
    const val = get(ctx, 'total_annual_premium') || ctx.term.annual_premium;
    if (!val) return 'Annual premium is missing.';
    if (isZeroOrMissing(val)) return 'Annual premium is $0.';
    return null;
}

// ── Rule registry ────────────────────────────────────────────

const FLAG_CHECKS: FlagCheck[] = [
    { code: 'MISSING_POLICY_NUMBER', severity: 'critical', title: 'Missing Policy Number', category: 'data_quality', entity_scope: 'policy', auto_resolve: true, check: (ctx) => { if (!ctx.policy.policy_number) return 'Policy number is missing.'; return null; } },
    { code: 'MISSING_PROPERTY_LOCATION', severity: 'critical', title: 'Missing Property Location', category: 'data_quality', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('property_location', 'Property location') },
    { code: 'MISSING_DWELLING_LIMIT', severity: 'critical', title: 'Missing Dwelling Limit', category: 'data_quality', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_dwelling', 'Dwelling coverage limit') },
    { code: 'MISSING_ORDINANCE_OR_LAW', severity: 'critical', title: 'Missing Ordinance or Law', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_ordinance_or_law', 'Ordinance or law coverage') },
    { code: 'MISSING_EXTENDED_DWELLING', severity: 'critical', title: 'Missing Extended Dwelling Coverage', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_extended_dwelling_coverage', 'Extended dwelling coverage') },
    { code: 'MISSING_DWELLING_REPLACEMENT_COST', severity: 'critical', title: 'Missing Dwelling Replacement Cost', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_dwelling_replacement_cost', 'Dwelling replacement cost') },
    { code: 'MISSING_PERSONAL_PROPERTY_REPLACEMENT_COST', severity: 'critical', title: 'Missing Personal Property RC', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_personal_property_replacement_cost', 'Personal property replacement cost') },
    { code: 'MISSING_FENCES_COVERAGE', severity: 'critical', title: 'Missing Fences Coverage', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_fences', 'Fences coverage') },
    { code: 'MISSING_PERSONAL_PROPERTY_COVERAGE_C', severity: 'critical', title: 'Missing Personal Property (Cov C)', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkMissingField('limit_personal_property', 'Personal property (Coverage C)') },
    { code: 'MORTGAGEE_PRESENT_DWELLING_ZERO', severity: 'critical', title: 'Mortgagee Present, Dwelling $0', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: false, check: checkMortgageeDwellingZero },
    { code: 'NO_DIC', severity: 'high', title: 'DIC Not on File', category: 'dic', entity_scope: 'policy', auto_resolve: false, check: checkNoDic },
    { code: 'RENEWAL_UPCOMING', severity: 'high', title: 'Renewal Upcoming', category: 'renewal', entity_scope: 'policy', auto_resolve: true, check: checkRenewalUpcoming },
    { code: 'DWELLING_RC_NOT_INCLUDED', severity: 'high', title: 'Dwelling RC Not Included', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: false, check: checkDwellingRcNotIncluded },
    { code: 'DWELLING_RC_INCLUDED_LOW_ORDINANCE', severity: 'high', title: 'RC Included, Low Ordinance/Law', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkDwellingRcLowOrdinance },
    { code: 'FAIR_RENTAL_VALUE_ZERO_OR_MISSING', severity: 'high', title: 'Fair Rental Value Zero or Missing', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkFairRentalValue },
    { code: 'ECM_PREMIUM_MISSING_OR_ZERO', severity: 'high', title: 'Premium Missing or Zero', category: 'data_quality', entity_scope: 'policy', auto_resolve: true, check: checkEcmPremium },
    { code: 'OTHER_STRUCTURES_ZERO', severity: 'warning', title: 'Other Structures $0', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkOtherStructuresZero },
    { code: 'PERSONAL_PROPERTY_ZERO_OWNER_OCCUPIED', severity: 'warning', title: 'Personal Property $0 (Owner-Occupied)', category: 'coverage_gap', entity_scope: 'policy', auto_resolve: true, check: checkPersonalPropertyZeroOwner },
];

// ── Build stable flag_key ────────────────────────────────────
function buildFlagKey(scope: string, entityId: string, code: string, subjectPath = ''): string {
    return `${scope}:${entityId}:${code}${subjectPath ? ':' + subjectPath : ''}`;
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const policyId = body.policy_id;

        if (!policyId || typeof policyId !== 'string') {
            return NextResponse.json({ success: false, error: 'policy_id is required' }, { status: 400 });
        }

        const sb = getSupabaseAdmin();
        const summary = { created: 0, refreshed: 0, resolved: 0, checked: 0 };

        // 1. Fetch policy
        const { data: policy, error: pErr } = await sb
            .from('policies')
            .select('*')
            .eq('id', policyId)
            .single();

        if (pErr || !policy) {
            return NextResponse.json({ success: false, error: 'Policy not found' }, { status: 404 });
        }

        // 2. Fetch current term
        const { data: term } = await sb
            .from('policy_terms')
            .select('*')
            .eq('policy_id', policyId)
            .eq('is_current', true)
            .single();

        // 3. Fetch client
        let client: Record<string, unknown> = {};
        if (policy.client_id) {
            const { data: c } = await sb.from('clients').select('*').eq('id', policy.client_id).single();
            if (c) client = c;
        }

        // 4. Build coverage_data from term's coverage_data JSONB
        const coverageData = (term?.coverage_data || {}) as Record<string, unknown>;

        const ctx: EvalCtx = {
            policy_id: policyId,
            client_id: policy.client_id || null,
            policy_term_id: term?.id || null,
            data: coverageData,
            term: term || {},
            client,
            policy,
        };

        // 5. Run each check
        for (const rule of FLAG_CHECKS) {
            summary.checked++;
            const entityId = rule.entity_scope === 'client'
                ? ctx.client_id
                : rule.entity_scope === 'policy_term'
                    ? ctx.policy_term_id
                    : ctx.policy_id;

            if (!entityId) continue;

            const flagKey = buildFlagKey(rule.entity_scope, entityId, rule.code);
            const message = rule.check(ctx);

            if (message) {
                // Flag should fire — upsert
                const now = new Date().toISOString();

                // Check if open flag already exists
                const { data: existing } = await sb
                    .from('policy_flags')
                    .select('id, times_seen')
                    .eq('flag_key', flagKey)
                    .eq('status', 'open')
                    .single();

                if (existing) {
                    // Refresh existing flag
                    await sb.from('policy_flags').update({
                        last_seen_at: now,
                        times_seen: (existing.times_seen || 1) + 1,
                        message,
                        updated_at: now,
                    }).eq('id', existing.id);
                    summary.refreshed++;
                } else {
                    // Create new flag
                    const { data: newFlag } = await sb.from('policy_flags').insert({
                        flag_key: flagKey,
                        code: rule.code,
                        severity: rule.severity,
                        title: rule.title,
                        message,
                        category: rule.category,
                        source: 'system',
                        status: 'open',
                        policy_id: rule.entity_scope !== 'client' ? ctx.policy_id : null,
                        client_id: ctx.client_id,
                        policy_term_id: rule.entity_scope === 'policy_term' ? ctx.policy_term_id : null,
                        rule_version: RULE_VERSION,
                        first_seen_at: now,
                        last_seen_at: now,
                        times_seen: 1,
                        created_at: now,
                        updated_at: now,
                    }).select('id').single();

                    if (newFlag) {
                        await sb.from('flag_events').insert({
                            flag_id: newFlag.id,
                            event_type: 'created',
                            note: `Flag check: ${rule.title}`,
                        });
                        summary.created++;
                    }
                }
            } else if (rule.auto_resolve) {
                // Condition clear — auto-resolve if open flag exists
                const { data: openFlag } = await sb
                    .from('policy_flags')
                    .select('id')
                    .eq('flag_key', flagKey)
                    .eq('status', 'open')
                    .single();

                if (openFlag) {
                    await sb.from('policy_flags').update({
                        status: 'resolved',
                        resolved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }).eq('id', openFlag.id);

                    await sb.from('flag_events').insert({
                        flag_id: openFlag.id,
                        event_type: 'resolved',
                        note: `Auto-resolved: ${rule.title} condition no longer applies.`,
                    });
                    summary.resolved++;
                }
            }
        }

        // 6. Also check for duplicates
        if (policy.policy_number) {
            const flagKey = buildFlagKey('policy', policyId, 'DUPLICATE_ID_IN_TABLE');
            const { data: dupes } = await sb
                .from('policies')
                .select('id')
                .eq('policy_number', policy.policy_number)
                .neq('id', policyId)
                .limit(3);

            summary.checked++;

            if (dupes && dupes.length > 0) {
                const msg = `Found ${dupes.length} other polic${dupes.length > 1 ? 'ies' : 'y'} with the same policy number (${policy.policy_number}).`;
                const { data: existing } = await sb
                    .from('policy_flags')
                    .select('id, times_seen')
                    .eq('flag_key', flagKey)
                    .eq('status', 'open')
                    .single();

                if (existing) {
                    await sb.from('policy_flags').update({
                        last_seen_at: new Date().toISOString(),
                        times_seen: (existing.times_seen || 1) + 1,
                        message: msg,
                        updated_at: new Date().toISOString(),
                    }).eq('id', existing.id);
                    summary.refreshed++;
                } else {
                    const { data: newF } = await sb.from('policy_flags').insert({
                        flag_key: flagKey,
                        code: 'DUPLICATE_ID_IN_TABLE',
                        severity: 'warning',
                        title: 'Possible Duplicate Policy',
                        message: msg,
                        category: 'duplicate',
                        source: 'system',
                        status: 'open',
                        policy_id: policyId,
                        client_id: policy.client_id,
                        rule_version: RULE_VERSION,
                        first_seen_at: new Date().toISOString(),
                        last_seen_at: new Date().toISOString(),
                        times_seen: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }).select('id').single();
                    if (newF) {
                        await sb.from('flag_events').insert({
                            flag_id: newF.id,
                            event_type: 'created',
                            note: 'Flag check: Possible Duplicate Policy',
                        });
                        summary.created++;
                    }
                }
            }
        }

        logger.info('API', `Flag evaluation for policy ${policyId}`, summary);

        return NextResponse.json({
            success: true,
            summary,
            message: `Checked ${summary.checked} rules: ${summary.created} created, ${summary.refreshed} refreshed, ${summary.resolved} resolved.`,
        });

    } catch (err) {
        logger.error('API', 'Error in flag evaluation', {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
