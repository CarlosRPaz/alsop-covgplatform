import { supabase } from './supabaseClient';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw row shape from the `dec_pages` Supabase table.
 * Mirrors the DB schema so we can eliminate `any` casts.
 */
export interface SupabaseDeclarationRow {
    id: string;
    created_at?: string;
    // Relational links
    submission_id?: string;
    created_by_account_id?: string;
    client_id?: string;
    policy_id?: string;
    policy_term_id?: string;
    // Insured
    insured_name?: string;
    secondary_insured_name?: string;
    // Addresses
    mailing_address?: string;
    property_location?: string;
    // Policy metadata
    policy_number?: string;
    date_issued?: string;
    policy_period_start?: string;
    policy_period_end?: string;
    // Property details
    year_built?: string;
    occupancy?: string;
    number_of_units?: string;
    construction_type?: string;
    deductible?: string;
    // Coverage limits
    limit_dwelling?: string;
    limit_other_structures?: string;
    limit_personal_property?: string;
    limit_fair_rental_value?: string;
    limit_ordinance_or_law?: string;
    limit_debris_removal?: string;
    limit_extended_dwelling_coverage?: string;
    limit_dwelling_replacement_cost?: string;
    limit_inflation_guard?: string;
    limit_personal_property_replacement_cost?: string;
    limit_fences?: string;
    limit_permitted_incidental_occupancy?: string;
    limit_plants_shrubs_trees?: string;
    limit_outdoor_radio_tv_equipment?: string;
    limit_awnings?: string;
    limit_signs?: string;
    // Special coverage
    limit_actual_cash_value_coverage?: string;
    limit_replacement_cost_coverage?: string;
    limit_building_code_upgrade_coverage?: string;
    limit_extended_replacement_cost_coverage?: string;
    limit_guaranteed_replacement_cost_coverage?: string;
    // Flags (checkboxes)
    cb_fire_lightning_smoke_damage?: boolean;
    cb_extended_coverages?: boolean;
    cb_vandalism_malicious_mischief?: boolean;
    // Premium
    total_annual_premium?: string;
    // Broker
    broker_name?: string;
    broker_address?: string;
    broker_phone_number?: string;
    // Mortgagees
    mortgagee_1_name?: string;
    mortgagee_1_address?: string;
    mortgagee_1_code?: string;
    mortgagee_2_name?: string;
    mortgagee_2_address?: string;
    mortgagee_2_code?: string;
    // DIC
    dic_company?: string;
    // Raw text
    raw_text?: string;
    // System
    status?: string;
}

/**
 * Application-level Declaration type.
 * This is the canonical shape used by all UI components that need full dec page detail.
 */
export interface Declaration {
    id: string;
    // Relational links
    client_id?: string;
    policy_id?: string;
    policy_term_id?: string;
    submission_id?: string;
    client_email?: string;
    client_phone?: string;
    // Insured Information
    insured_name: string;
    secondary_insured_name?: string;
    // Addresses
    mailing_address: string;
    property_location: string;
    // Policy Metadata
    policy_number: string;
    date_issued: string;
    policy_period_start: string;
    policy_period_end: string;
    renewal_date: string;
    // Property Details
    year_built: number;
    occupancy: string;
    number_of_units: number;
    construction_type: string;
    deductible: string;
    // Coverage Limits
    limit_dwelling: string;
    limit_other_structures: string;
    limit_personal_property: string;
    limit_fair_rental_value: string;
    limit_ordinance_or_law: string;
    limit_debris_removal: string;
    limit_extended_dwelling_coverage: string;
    limit_dwelling_replacement_cost: string;
    limit_inflation_guard: string;
    limit_personal_property_replacement_cost: string;
    limit_fences: string;
    limit_permitted_incidental_occupancy: string;
    limit_plants_shrubs_trees: string;
    limit_outdoor_radio_tv_equipment: string;
    limit_awnings: string;
    limit_signs: string;
    // Special Coverage
    limit_actual_cash_value_coverage?: string;
    limit_replacement_cost_coverage?: string;
    limit_building_code_upgrade_coverage?: string;
    limit_extended_replacement_cost_coverage?: string;
    limit_guaranteed_replacement_cost_coverage?: string;
    // Flags (Checkboxes)
    cb_fire_lightning_smoke_damage: boolean;
    cb_extended_coverages: boolean;
    cb_vandalism_malicious_mischief: boolean;
    // Premium
    total_annual_premium: string;
    // Broker
    broker_name: string;
    broker_address: string;
    broker_phone_number: string;
    // Mortgagees
    mortgagee_1_name?: string;
    mortgagee_1_address?: string;
    mortgagee_1_code?: string;
    mortgagee_2_name?: string;
    mortgagee_2_address?: string;
    mortgagee_2_code?: string;
    // DIC (Difference in Conditions)
    dic_company?: string;

    // System Fields
    status: 'Pending Review' | 'Approved' | 'Rejected' | 'Incomplete';
    flags: string[];
}

// ---------------------------------------------------------------------------
// New Normalized Schema Types
// ---------------------------------------------------------------------------

/** Row shape from the `clients` table. */
export interface ClientRow {
    id: string;
    created_by_account_id: string;
    named_insured: string;
    insured_type?: string;
    email?: string;
    phone?: string;
    mailing_address_raw?: string;
    mailing_address_norm?: string;
    created_at?: string;
    updated_at?: string;
}

/** Row shape from the `policies` table. */
export interface PolicyRow {
    id: string;
    created_by_account_id: string;
    client_id: string;
    policy_number: string;
    carrier_name?: string;
    property_address_raw?: string;
    property_address_norm?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
}

/** Row shape from the `policy_terms` table. */
export interface PolicyTermRow {
    id: string;
    policy_id: string;
    effective_date?: string;
    expiration_date?: string;
    date_issued?: string;
    annual_premium?: number;
    is_current?: boolean;
    created_at?: string;
    updated_at?: string;
}

/** Row shape from the `policy_flags` table. */
export interface PolicyFlagRow {
    id: string;
    policy_id: string;
    source_dec_page_id?: string;
    code: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message?: string;
    details?: Record<string, unknown>;
    source: string;            // 'ai' | 'rule' | 'system' | 'user'
    rule_version?: string;
    created_by_account_id?: string;
    created_at?: string;
    resolved_at?: string | null;
    resolved_by_account_id?: string | null;
}

/**
 * Dashboard-level Policy type — a joined view for the agent dashboard table.
 * One row per policy (with current term info).
 */
export interface DashboardPolicy {
    // Policy fields
    id: string;               // policies.id
    policy_number: string;
    property_address: string;
    status: string;
    carrier_name?: string;
    // Client fields (joined)
    client_id: string;
    named_insured: string;
    client_email?: string;
    client_phone?: string;
    mailing_address?: string;
    // Current term fields (joined)
    policy_term_id?: string;
    effective_date?: string;
    expiration_date?: string;
    annual_premium?: string;
    // Flag summary (joined)
    flag_count: number;
    highest_severity?: 'info' | 'warning' | 'critical';
    // Metadata
    created_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers (Single Source of Truth)
// ---------------------------------------------------------------------------

/**
 * Generate flags based on policy data.
 * Flags are displayed in the UI to highlight issues/risks.
 */
function generateFlags(row: SupabaseDeclarationRow): string[] {
    const flags: string[] = [];

    // Check for missing critical data
    if (!row.policy_number) flags.push('Missing Policy #');
    if (!row.limit_dwelling) flags.push('Missing Coverage');

    // Check for occupancy type
    const occupancy = row.occupancy?.toLowerCase();
    if (occupancy === 'tenant') {
        flags.push('Tenant-Occupied');
    } else if (occupancy === 'secondary') {
        flags.push('Secondary Residence');
    }

    return flags;
}

/**
 * Derive status from the DB row.
 * If the row has a `status` column, map it to one of our valid statuses.
 * Otherwise, derive from data completeness.
 */
function deriveStatus(row: SupabaseDeclarationRow): Declaration['status'] {
    // If a status is stored in the DB, trust it
    if (row.status) {
        const normalized = row.status.trim();
        if (['Approved', 'Rejected', 'Incomplete', 'Pending Review'].includes(normalized)) {
            return normalized as Declaration['status'];
        }
    }

    // Derive from data completeness
    const missingCritical =
        !row.policy_number ||
        !row.insured_name ||
        !row.mailing_address ||
        !row.limit_dwelling;

    return missingCritical ? 'Incomplete' : 'Pending Review';
}

/**
 * Maps a raw Supabase row to the application-level Declaration type.
 * SINGLE SOURCE OF TRUTH — all fetch functions use this.
 */
function mapRowToDeclaration(row: SupabaseDeclarationRow): Declaration {
    return {
        id: row.id,
        // Relational links (real FKs from dec_pages)
        client_id: row.client_id || undefined,
        policy_id: row.policy_id || undefined,
        policy_term_id: row.policy_term_id || undefined,
        submission_id: row.submission_id || undefined,
        client_email: undefined,
        client_phone: undefined,
        // Insured Information
        insured_name: row.insured_name || 'Unknown',
        secondary_insured_name: row.secondary_insured_name || undefined,
        // Addresses
        mailing_address: row.mailing_address || 'No address provided',
        property_location: row.property_location || 'No location provided',
        // Policy Metadata
        policy_number: row.policy_number || 'N/A',
        date_issued: row.date_issued || '',
        policy_period_start: row.policy_period_start || '',
        policy_period_end: row.policy_period_end || '',
        renewal_date: row.policy_period_end || '',
        // Property Details
        year_built: row.year_built ? parseInt(row.year_built, 10) : 0,
        occupancy: row.occupancy || 'Unknown',
        number_of_units: row.number_of_units ? parseInt(row.number_of_units, 10) : 1,
        construction_type: row.construction_type || 'Unknown',
        deductible: row.deductible || '$0',
        // Coverage Limits
        limit_dwelling: row.limit_dwelling || '$0',
        limit_other_structures: row.limit_other_structures || '$0',
        limit_personal_property: row.limit_personal_property || '$0',
        limit_fair_rental_value: row.limit_fair_rental_value || '$0',
        limit_ordinance_or_law: row.limit_ordinance_or_law || '$0',
        limit_debris_removal: row.limit_debris_removal || '$0',
        limit_extended_dwelling_coverage: row.limit_extended_dwelling_coverage || 'None',
        limit_dwelling_replacement_cost: row.limit_dwelling_replacement_cost || 'None',
        limit_inflation_guard: row.limit_inflation_guard || 'None',
        limit_personal_property_replacement_cost: row.limit_personal_property_replacement_cost || 'None',
        limit_fences: row.limit_fences || '$0',
        limit_permitted_incidental_occupancy: row.limit_permitted_incidental_occupancy || '$0',
        limit_plants_shrubs_trees: row.limit_plants_shrubs_trees || '$0',
        limit_outdoor_radio_tv_equipment: row.limit_outdoor_radio_tv_equipment || '$0',
        limit_awnings: row.limit_awnings || '$0',
        limit_signs: row.limit_signs || '$0',
        // Special Coverage
        limit_actual_cash_value_coverage: row.limit_actual_cash_value_coverage || undefined,
        limit_replacement_cost_coverage: row.limit_replacement_cost_coverage || undefined,
        limit_building_code_upgrade_coverage: row.limit_building_code_upgrade_coverage || undefined,
        limit_extended_replacement_cost_coverage: row.limit_extended_replacement_cost_coverage || undefined,
        limit_guaranteed_replacement_cost_coverage: row.limit_guaranteed_replacement_cost_coverage || undefined,
        // Flags (Checkboxes)
        cb_fire_lightning_smoke_damage: row.cb_fire_lightning_smoke_damage || false,
        cb_extended_coverages: row.cb_extended_coverages || false,
        cb_vandalism_malicious_mischief: row.cb_vandalism_malicious_mischief || false,
        // Premium
        total_annual_premium: row.total_annual_premium || '$0',
        // Broker
        broker_name: row.broker_name || 'Unknown',
        broker_address: row.broker_address || '',
        broker_phone_number: row.broker_phone_number || '',
        // Mortgagees
        mortgagee_1_name: row.mortgagee_1_name || undefined,
        mortgagee_1_address: row.mortgagee_1_address || undefined,
        mortgagee_1_code: row.mortgagee_1_code || undefined,
        mortgagee_2_name: row.mortgagee_2_name || undefined,
        mortgagee_2_address: row.mortgagee_2_address || undefined,
        mortgagee_2_code: row.mortgagee_2_code || undefined,
        // DIC
        dic_company: row.dic_company || undefined,
        // System Fields
        status: deriveStatus(row),
        flags: generateFlags(row),
    };
}

// ---------------------------------------------------------------------------
// Data Access Functions
// ---------------------------------------------------------------------------

/**
 * Fetch all declarations from Supabase (dec_pages table), ordered by most recent first.
 */
export async function fetchSupabaseDeclarations(): Promise<Declaration[]> {
    try {
        const { data, error } = await supabase
            .from('dec_pages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('API', 'Error fetching declarations from Supabase', {
                message: error.message,
                code: error.code,
                details: error.details,
            });
            return [];
        }

        if (!data || data.length === 0) {
            logger.info('API', 'No declarations found in Supabase');
            return [];
        }

        logger.info('API', `Fetched ${data.length} declarations`);
        return (data as SupabaseDeclarationRow[]).map(mapRowToDeclaration);
    } catch (err) {
        logger.error('API', 'Unexpected error fetching Supabase data', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

/** Backward-compat alias. */
export const fetchDeclarations = fetchSupabaseDeclarations;

/**
 * Fetch a single declaration by ID from dec_pages.
 */
export async function getDeclarationById(id: string): Promise<Declaration | undefined> {
    try {
        const { data, error } = await supabase
            .from('dec_pages')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            logger.error('API', `Error fetching declaration ${id}`, {
                message: error.message,
                code: error.code,
            });
            return undefined;
        }

        if (!data) return undefined;

        return mapRowToDeclaration(data as SupabaseDeclarationRow);
    } catch (err) {
        logger.error('API', `Unexpected error fetching declaration ${id}`, {
            error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
    }
}

/**
 * Fetch all declarations for a client by their real client_id FK.
 */
export async function fetchDeclarationsByClientId(clientId: string): Promise<Declaration[]> {
    try {
        const { data, error } = await supabase
            .from('dec_pages')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('API', 'Error fetching declarations by client_id', {
                clientId,
                message: error.message,
            });
            return [];
        }

        if (!data || data.length === 0) return [];

        return (data as SupabaseDeclarationRow[]).map(mapRowToDeclaration);
    } catch (err) {
        logger.error('API', 'Unexpected error in fetchDeclarationsByClientId', {
            clientId,
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

// ---------------------------------------------------------------------------
// Dashboard: Policy-Centric Queries
// ---------------------------------------------------------------------------

/**
 * Fetch policies joined with clients and current policy terms for the dashboard.
 * One row per policy — this replaces fetchSupabaseDeclarations for the dashboard.
 */
export async function fetchDashboardPolicies(): Promise<DashboardPolicy[]> {
    try {
        // Use Supabase's embedded resource syntax to join related tables.
        // policies → clients (via client_id), policy_terms (via policy_id)
        const { data, error } = await supabase
            .from('policies')
            .select(`
                id,
                policy_number,
                property_address_raw,
                property_address_norm,
                carrier_name,
                status,
                created_at,
                client_id,
                clients!inner (
                    id,
                    named_insured,
                    email,
                    phone,
                    mailing_address_raw
                ),
                policy_terms (
                    id,
                    effective_date,
                    expiration_date,
                    annual_premium,
                    is_current
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('API', 'Error fetching dashboard policies', {
                message: error.message,
                code: error.code,
                details: error.details,
            });
            return [];
        }

        if (!data || data.length === 0) {
            logger.info('API', 'No policies found for dashboard');
            return [];
        }

        // Batch-fetch flag counts for all policies (avoids N+1)
        const policyIds = data.map((r: { id: string }) => r.id);
        const flagMap = await fetchFlagSummaryForPolicies(policyIds);

        // Map the joined result to DashboardPolicy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((row: any) => {
            // clients is an object (inner join, one-to-one via FK)
            const client = row.clients;
            // policy_terms is an array; find the current term
            const terms: Array<{ id: string; effective_date?: string; expiration_date?: string; annual_premium?: number; is_current?: boolean }> = row.policy_terms || [];
            const currentTerm = terms.find(t => t.is_current === true) || terms[0] || null;
            const flagInfo = flagMap.get(row.id) || { count: 0, severity: undefined };

            return {
                id: row.id,
                policy_number: row.policy_number || 'N/A',
                property_address: row.property_address_raw || row.property_address_norm || 'No address',
                status: row.status || 'unknown',
                carrier_name: row.carrier_name || undefined,
                client_id: row.client_id,
                named_insured: client?.named_insured || 'Unknown',
                client_email: client?.email || undefined,
                client_phone: client?.phone || undefined,
                mailing_address: client?.mailing_address_raw || undefined,
                policy_term_id: currentTerm?.id || undefined,
                effective_date: currentTerm?.effective_date || undefined,
                expiration_date: currentTerm?.expiration_date || undefined,
                annual_premium: currentTerm?.annual_premium != null
                    ? `$${Number(currentTerm.annual_premium).toLocaleString()}`
                    : undefined,
                flag_count: flagInfo.count,
                highest_severity: flagInfo.severity,
                created_at: row.created_at,
            } as DashboardPolicy;
        });
    } catch (err) {
        logger.error('API', 'Unexpected error fetching dashboard policies', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

/**
 * Fetch a single client by ID.
 */
export async function getClientById(clientId: string): Promise<ClientRow | undefined> {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error || !data) {
            logger.error('API', `Error fetching client ${clientId}`, {
                message: error?.message,
            });
            return undefined;
        }

        return data as ClientRow;
    } catch (err) {
        logger.error('API', `Unexpected error fetching client ${clientId}`, {
            error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
    }
}

/**
 * Fetch policies for a given client_id (with current terms).
 */
export async function fetchPoliciesByClientId(clientId: string): Promise<DashboardPolicy[]> {
    try {
        const { data, error } = await supabase
            .from('policies')
            .select(`
                id,
                policy_number,
                property_address_raw,
                carrier_name,
                status,
                created_at,
                client_id,
                clients (
                    id,
                    named_insured,
                    email,
                    phone,
                    mailing_address_raw
                ),
                policy_terms (
                    id,
                    effective_date,
                    expiration_date,
                    annual_premium,
                    is_current
                )
            `)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error || !data) {
            logger.error('API', 'Error fetching policies by client_id', {
                clientId,
                message: error?.message,
            });
            return [];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((row: any) => {
            const client = row.clients;
            const terms = row.policy_terms || [];
            const currentTerm = terms.find((t: PolicyTermRow) => t.is_current === true) || terms[0] || null;

            return {
                id: row.id,
                policy_number: row.policy_number || 'N/A',
                property_address: row.property_address_raw || 'No address',
                status: row.status || 'unknown',
                carrier_name: row.carrier_name || undefined,
                client_id: row.client_id,
                named_insured: client?.named_insured || 'Unknown',
                client_email: client?.email || undefined,
                client_phone: client?.phone || undefined,
                mailing_address: client?.mailing_address_raw || undefined,
                policy_term_id: currentTerm?.id || undefined,
                effective_date: currentTerm?.effective_date || undefined,
                expiration_date: currentTerm?.expiration_date || undefined,
                annual_premium: currentTerm?.annual_premium != null
                    ? `$${Number(currentTerm.annual_premium).toLocaleString()}`
                    : undefined,
                created_at: row.created_at,
            } as DashboardPolicy;
        });
    } catch (err) {
        logger.error('API', 'Unexpected error fetching policies by client', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

// ---------------------------------------------------------------------------
// AI Report
// ---------------------------------------------------------------------------

export interface AIReportData {
    overallScore: number;
    coverageGaps: string[];
    flagDetails: string[];
    suggestions: string[];
}

/**
 * Generate an AI report for a declaration.
 * Currently uses deterministic rule-based logic.
 * TODO: Replace with actual AI integration.
 */
export function generateAIReport(declaration: Declaration): AIReportData {
    const gaps: string[] = [];
    const flagDetails: string[] = [];
    const suggestions: string[] = [];
    let score = 85;

    // Check coverage limits
    if (declaration.limit_ordinance_or_law === '$0' || declaration.limit_ordinance_or_law === 'None') {
        gaps.push('No Ordinance or Law coverage');
        score -= 10;
    }
    if (declaration.limit_extended_dwelling_coverage === 'None') {
        gaps.push('No Extended Dwelling coverage');
        score -= 5;
    }
    if (declaration.limit_inflation_guard === 'None') {
        gaps.push('No Inflation Guard');
        score -= 5;
    }

    // Check flags
    if (declaration.flags.includes('Missing Coverage')) {
        flagDetails.push('Missing critical coverage information');
        score -= 10;
    }

    // Generate suggestions
    if (declaration.limit_ordinance_or_law === '$0' || declaration.limit_ordinance_or_law === 'None') {
        suggestions.push('Increase Ordinance or Law coverage to 50%');
    }
    if (!declaration.limit_personal_property || declaration.limit_personal_property === '$0') {
        suggestions.push('Review personal property limits (currently low relative to dwelling)');
    }
    suggestions.push('Add Service Line Coverage');

    return {
        overallScore: Math.max(0, Math.min(100, score)),
        coverageGaps: gaps.length > 0 ? gaps : ['No significant coverage gaps detected'],
        flagDetails: flagDetails.length > 0 ? flagDetails : ['No flags detected'],
        suggestions,
    };
}

/**
 * Fetch an AI report for a specific policy by ID.
 */
export async function fetchAIReport(id: string): Promise<AIReportData> {
    const declaration = await getDeclarationById(id);
    if (!declaration) {
        logger.warn('API', `Cannot generate AI report — declaration ${id} not found`);
        return {
            overallScore: 0,
            coverageGaps: ['Unable to load policy data'],
            flagDetails: ['Policy not found'],
            suggestions: ['Please verify the policy ID'],
        };
    }
    return generateAIReport(declaration);
}

// ---------------------------------------------------------------------------
// Policy Flags
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { critical: 3, warning: 2, info: 1 };

/**
 * Batch-fetch flag summary (count + highest severity) for a list of policy IDs.
 * Used by fetchDashboardPolicies to avoid N+1 queries.
 * Only counts active (unresolved) flags when resolved_at column exists.
 */
async function fetchFlagSummaryForPolicies(
    policyIds: string[]
): Promise<Map<string, { count: number; severity?: 'info' | 'warning' | 'critical' }>> {
    const result = new Map<string, { count: number; severity?: 'info' | 'warning' | 'critical' }>();
    if (policyIds.length === 0) return result;

    try {
        const { data, error } = await supabase
            .from('policy_flags')
            .select('id, policy_id, severity, resolved_at')
            .in('policy_id', policyIds);

        if (error || !data) {
            // Table might not exist yet — return empty map gracefully
            logger.warn('API', 'Could not fetch flag summaries', { message: error?.message });
            return result;
        }

        // Group by policy_id, filtering to active (unresolved) flags
        for (const flag of data) {
            // If resolved_at exists and is set, skip (resolved flag)
            if (flag.resolved_at) continue;

            const existing = result.get(flag.policy_id) || { count: 0, severity: undefined };
            existing.count++;

            const sev = flag.severity as 'info' | 'warning' | 'critical';
            if (!existing.severity || (SEVERITY_ORDER[sev] || 0) > (SEVERITY_ORDER[existing.severity] || 0)) {
                existing.severity = sev;
            }
            result.set(flag.policy_id, existing);
        }
    } catch (err) {
        logger.warn('API', 'Unexpected error fetching flag summaries', {
            error: err instanceof Error ? err.message : String(err),
        });
    }

    return result;
}

/**
 * Fetch all flags for a given policy, ordered by severity desc then created_at desc.
 */
export async function fetchFlagsByPolicyId(policyId: string): Promise<PolicyFlagRow[]> {
    try {
        const { data, error } = await supabase
            .from('policy_flags')
            .select('*')
            .eq('policy_id', policyId)
            .order('created_at', { ascending: false });

        if (error || !data) {
            logger.error('API', 'Error fetching flags for policy', {
                policyId,
                message: error?.message,
            });
            return [];
        }

        // Sort: active first, then by severity desc
        return (data as PolicyFlagRow[]).sort((a, b) => {
            // Active (unresolved) first
            const aResolved = a.resolved_at ? 1 : 0;
            const bResolved = b.resolved_at ? 1 : 0;
            if (aResolved !== bResolved) return aResolved - bResolved;
            // Then by severity
            return (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
        });
    } catch (err) {
        logger.error('API', 'Unexpected error fetching flags', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

/**
 * Resolve a flag (set resolved_at and resolved_by_account_id).
 */
export async function resolveFlag(flagId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('policy_flags')
            .update({
                resolved_at: new Date().toISOString(),
            })
            .eq('id', flagId);

        if (error) {
            logger.error('API', 'Error resolving flag', { flagId, message: error.message });
            return false;
        }
        return true;
    } catch (err) {
        logger.error('API', 'Unexpected error resolving flag', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

/**
 * Unresolve a flag (clear resolved_at and resolved_by_account_id).
 */
export async function unresolveFlag(flagId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('policy_flags')
            .update({
                resolved_at: null,
                resolved_by_account_id: null,
            })
            .eq('id', flagId);

        if (error) {
            logger.error('API', 'Error unresolving flag', { flagId, message: error.message });
            return false;
        }
        return true;
    } catch (err) {
        logger.error('API', 'Unexpected error unresolving flag', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

/**
 * Update a flag's title, message, severity, and/or details.
 */
export async function updateFlag(
    flagId: string,
    updates: { title?: string; message?: string; severity?: string; details?: Record<string, unknown> }
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('policy_flags')
            .update(updates)
            .eq('id', flagId);

        if (error) {
            logger.error('API', 'Error updating flag', { flagId, message: error.message });
            return false;
        }
        return true;
    } catch (err) {
        logger.error('API', 'Unexpected error updating flag', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

/**
 * Create a new flag manually.
 */
export async function createFlag(
    policyId: string,
    fields: { code: string; severity: string; title: string; message?: string; details?: Record<string, unknown> }
): Promise<PolicyFlagRow | null> {
    try {
        const { data, error } = await supabase
            .from('policy_flags')
            .insert({
                policy_id: policyId,
                code: fields.code,
                severity: fields.severity,
                title: fields.title,
                message: fields.message || null,
                details: fields.details || {},
                source: 'user',
            })
            .select('*')
            .single();

        if (error || !data) {
            logger.error('API', 'Error creating flag', {
                policyId,
                message: error?.message,
            });
            return null;
        }
        return data as PolicyFlagRow;
    } catch (err) {
        logger.error('API', 'Unexpected error creating flag', {
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}

// --- Ingestion Debug (Phase 2) ---

export interface SubmissionDebugRow {
    id: string;
    account_id: string;
    status: string;
    file_path: string | null;
    storage_path: string | null;
    created_at: string;
    error_message: string | null;

    // Joined dec_pages data
    dec_page_id?: string;
    parse_status?: string;
    missing_fields?: string[];
    insured_name?: string;
    policy_number?: string;
    extracted_json?: any;
}

export async function fetchRecentSubmissions(limit = 20): Promise<SubmissionDebugRow[]> {
    try {
        const { data, error } = await supabase
            .from('dec_page_submissions')
            .select(`
        id,
        account_id,
        status,
        file_path,
        storage_path,
        created_at,
        error_message,
        dec_pages (
          id,
          parse_status,
          missing_fields,
          insured_name,
          policy_number,
          extracted_json
        )
      `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Error fetching submissions:", error);
            throw error;
        }

        if (!data) return [];

        return data.map((row: any) => {
            const dp = row.dec_pages && row.dec_pages.length > 0 ? row.dec_pages[0] : null;
            return {
                id: row.id,
                account_id: row.account_id,
                status: row.status,
                file_path: row.file_path,
                storage_path: row.storage_path,
                created_at: row.created_at,
                error_message: row.error_message,
                dec_page_id: dp?.id,
                parse_status: dp?.parse_status,
                missing_fields: dp?.missing_fields,
                insured_name: dp?.insured_name,
                policy_number: dp?.policy_number,
                extracted_json: dp?.extracted_json,
            };
        });
    } catch (err) {
        console.error("Exception in fetchRecentSubmissions:", err);
        throw err;
    }
}
