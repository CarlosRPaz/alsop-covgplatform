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
 * Full detail for a single policy — used by the policy review page.
 * Combines policy, client, current term, and (optionally) the latest dec_page.
 */
export interface PolicyDetail {
    // Policy
    id: string;
    policy_number: string;
    property_address: string;
    carrier_name?: string;
    status: string;
    created_at?: string;
    // Client (joined)
    client_id: string;
    named_insured: string;
    secondary_insured_name?: string;
    client_email?: string;
    client_phone?: string;
    mailing_address?: string;
    // Current term (joined)
    policy_term_id?: string;
    effective_date?: string;
    expiration_date?: string;
    date_issued?: string;
    annual_premium?: string;
    // Dec page data (joined, optional — may not exist yet)
    dec_page_id?: string;
    year_built?: number;
    occupancy?: string;
    number_of_units?: number;
    construction_type?: string;
    deductible?: string;
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
    // Special coverage (from dec page)
    limit_actual_cash_value_coverage?: string;
    limit_replacement_cost_coverage?: string;
    limit_building_code_upgrade_coverage?: string;
    limit_extended_replacement_cost_coverage?: string;
    limit_guaranteed_replacement_cost_coverage?: string;
    // Flags (from dec page)
    cb_fire_lightning_smoke_damage?: boolean;
    cb_extended_coverages?: boolean;
    cb_vandalism_malicious_mischief?: boolean;
    // Broker (from dec page)
    broker_name?: string;
    broker_address?: string;
    broker_phone_number?: string;
    // Mortgagees (from dec page)
    mortgagee_1_name?: string;
    mortgagee_1_address?: string;
    mortgagee_1_code?: string;
    mortgagee_2_name?: string;
    mortgagee_2_address?: string;
    mortgagee_2_code?: string;
    // DIC (from dec page)
    dic_company?: string;
}

/**
 * Fetch a single policy by ID with client and current term (which now contains coverage data).
 * Used by the policy review page.
 * Coverage is read from policy_terms (curated/approved) — NOT from raw dec_pages.
 */
export async function getPolicyDetailById(policyId: string): Promise<PolicyDetail | undefined> {
    try {
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
                    date_issued,
                    annual_premium,
                    is_current,
                    source_dec_page_id,
                    approved_at,
                    deductible,
                    limit_dwelling,
                    limit_other_structures,
                    limit_personal_property,
                    limit_fair_rental_value,
                    limit_ordinance_or_law,
                    limit_debris_removal,
                    limit_extended_dwelling_coverage,
                    limit_dwelling_replacement_cost,
                    limit_inflation_guard,
                    limit_personal_property_replacement_cost,
                    broker_name,
                    broker_address,
                    broker_phone,
                    mortgagee_1_name,
                    mortgagee_1_address,
                    mortgagee_1_code,
                    mortgagee_2_name,
                    mortgagee_2_address,
                    mortgagee_2_code,
                    property_location,
                    year_built,
                    occupancy,
                    number_of_units,
                    construction_type
                )
            `)
            .eq('id', policyId)
            .single();

        if (error || !data) {
            logger.error('API', `Error fetching policy detail ${policyId}`, {
                message: error?.message,
            });
            return undefined;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any;
        const client = row.clients;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const terms: any[] = row.policy_terms || [];
        const currentTerm = terms.find(t => t.is_current === true) || terms[0] || null;

        return {
            id: row.id,
            policy_number: row.policy_number || 'N/A',
            property_address: row.property_address_raw || row.property_address_norm || 'No address',
            carrier_name: row.carrier_name || undefined,
            status: row.status || 'unknown',
            created_at: row.created_at,
            client_id: row.client_id,
            named_insured: client?.named_insured || 'Unknown',
            secondary_insured_name: undefined,
            client_email: client?.email || undefined,
            client_phone: client?.phone || undefined,
            mailing_address: client?.mailing_address_raw || undefined,
            policy_term_id: currentTerm?.id || undefined,
            effective_date: currentTerm?.effective_date || undefined,
            expiration_date: currentTerm?.expiration_date || undefined,
            date_issued: currentTerm?.date_issued || undefined,
            annual_premium: currentTerm?.annual_premium != null
                ? `$${Number(currentTerm.annual_premium).toLocaleString()}`
                : undefined,
            // Coverage — now from policy_terms (approved data)
            dec_page_id: currentTerm?.source_dec_page_id || undefined,
            year_built: currentTerm?.year_built ? parseInt(currentTerm.year_built, 10) : undefined,
            occupancy: currentTerm?.occupancy || undefined,
            number_of_units: currentTerm?.number_of_units ? parseInt(currentTerm.number_of_units, 10) : undefined,
            construction_type: currentTerm?.construction_type || undefined,
            deductible: currentTerm?.deductible || undefined,
            limit_dwelling: currentTerm?.limit_dwelling || undefined,
            limit_other_structures: currentTerm?.limit_other_structures || undefined,
            limit_personal_property: currentTerm?.limit_personal_property || undefined,
            limit_fair_rental_value: currentTerm?.limit_fair_rental_value || undefined,
            limit_ordinance_or_law: currentTerm?.limit_ordinance_or_law || undefined,
            limit_debris_removal: currentTerm?.limit_debris_removal || undefined,
            limit_extended_dwelling_coverage: currentTerm?.limit_extended_dwelling_coverage || undefined,
            limit_dwelling_replacement_cost: currentTerm?.limit_dwelling_replacement_cost || undefined,
            limit_inflation_guard: currentTerm?.limit_inflation_guard || undefined,
            limit_personal_property_replacement_cost: currentTerm?.limit_personal_property_replacement_cost || undefined,
            limit_fences: undefined,
            limit_permitted_incidental_occupancy: undefined,
            limit_plants_shrubs_trees: undefined,
            limit_outdoor_radio_tv_equipment: undefined,
            limit_awnings: undefined,
            limit_signs: undefined,
            limit_actual_cash_value_coverage: undefined,
            limit_replacement_cost_coverage: undefined,
            limit_building_code_upgrade_coverage: undefined,
            limit_extended_replacement_cost_coverage: undefined,
            limit_guaranteed_replacement_cost_coverage: undefined,
            cb_fire_lightning_smoke_damage: false,
            cb_extended_coverages: false,
            cb_vandalism_malicious_mischief: false,
            broker_name: currentTerm?.broker_name || undefined,
            broker_address: currentTerm?.broker_address || undefined,
            broker_phone_number: currentTerm?.broker_phone || undefined,
            mortgagee_1_name: currentTerm?.mortgagee_1_name || undefined,
            mortgagee_1_address: currentTerm?.mortgagee_1_address || undefined,
            mortgagee_1_code: currentTerm?.mortgagee_1_code || undefined,
            mortgagee_2_name: currentTerm?.mortgagee_2_name || undefined,
            mortgagee_2_address: currentTerm?.mortgagee_2_address || undefined,
            mortgagee_2_code: currentTerm?.mortgagee_2_code || undefined,
            dic_company: undefined,
        };
    } catch (err) {
        logger.error('API', `Unexpected error fetching policy detail ${policyId}`, {
            error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
    }
}

/**
 * Convert a PolicyDetail to a Declaration for backward-compat with PolicyDashboard.
 */
export function mapPolicyDetailToDeclaration(detail: PolicyDetail): Declaration {
    return {
        id: detail.dec_page_id || detail.id,
        client_id: detail.client_id,
        policy_id: detail.id,
        policy_term_id: detail.policy_term_id,
        client_email: detail.client_email,
        client_phone: detail.client_phone,
        insured_name: detail.named_insured,
        secondary_insured_name: detail.secondary_insured_name,
        mailing_address: detail.mailing_address || 'No address provided',
        property_location: detail.property_address || 'No location provided',
        policy_number: detail.policy_number,
        date_issued: detail.date_issued || '',
        policy_period_start: detail.effective_date || '',
        policy_period_end: detail.expiration_date || '',
        renewal_date: detail.expiration_date || '',
        year_built: detail.year_built || 0,
        occupancy: detail.occupancy || 'Unknown',
        number_of_units: detail.number_of_units || 1,
        construction_type: detail.construction_type || 'Unknown',
        deductible: detail.deductible || '$0',
        limit_dwelling: detail.limit_dwelling || '$0',
        limit_other_structures: detail.limit_other_structures || '$0',
        limit_personal_property: detail.limit_personal_property || '$0',
        limit_fair_rental_value: detail.limit_fair_rental_value || '$0',
        limit_ordinance_or_law: detail.limit_ordinance_or_law || '$0',
        limit_debris_removal: detail.limit_debris_removal || '$0',
        limit_extended_dwelling_coverage: detail.limit_extended_dwelling_coverage || 'None',
        limit_dwelling_replacement_cost: detail.limit_dwelling_replacement_cost || 'None',
        limit_inflation_guard: detail.limit_inflation_guard || 'None',
        limit_personal_property_replacement_cost: detail.limit_personal_property_replacement_cost || 'None',
        limit_fences: detail.limit_fences || '$0',
        limit_permitted_incidental_occupancy: detail.limit_permitted_incidental_occupancy || '$0',
        limit_plants_shrubs_trees: detail.limit_plants_shrubs_trees || '$0',
        limit_outdoor_radio_tv_equipment: detail.limit_outdoor_radio_tv_equipment || '$0',
        limit_awnings: detail.limit_awnings || '$0',
        limit_signs: detail.limit_signs || '$0',
        limit_actual_cash_value_coverage: detail.limit_actual_cash_value_coverage,
        limit_replacement_cost_coverage: detail.limit_replacement_cost_coverage,
        limit_building_code_upgrade_coverage: detail.limit_building_code_upgrade_coverage,
        limit_extended_replacement_cost_coverage: detail.limit_extended_replacement_cost_coverage,
        limit_guaranteed_replacement_cost_coverage: detail.limit_guaranteed_replacement_cost_coverage,
        cb_fire_lightning_smoke_damage: detail.cb_fire_lightning_smoke_damage || false,
        cb_extended_coverages: detail.cb_extended_coverages || false,
        cb_vandalism_malicious_mischief: detail.cb_vandalism_malicious_mischief || false,
        total_annual_premium: detail.annual_premium || '$0',
        broker_name: detail.broker_name || 'Unknown',
        broker_address: detail.broker_address || '',
        broker_phone_number: detail.broker_phone_number || '',
        mortgagee_1_name: detail.mortgagee_1_name,
        mortgagee_1_address: detail.mortgagee_1_address,
        mortgagee_1_code: detail.mortgagee_1_code,
        mortgagee_2_name: detail.mortgagee_2_name,
        mortgagee_2_address: detail.mortgagee_2_address,
        mortgagee_2_code: detail.mortgagee_2_code,
        dic_company: detail.dic_company,
        status: 'Pending Review',
        flags: [],
    };
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

// ---------------------------------------------------------------------------
// Policy Files (Dec Pages for a Policy)
// ---------------------------------------------------------------------------

export interface DecPageFileInfo {
    id: string;
    dec_page_id: string;
    storage_path: string | null;
    file_name: string | null;
    file_size: number | null;
    uploaded_at: string;
    parse_status: string | null;
    insured_name: string | null;
    policy_number: string | null;
}

/**
 * Fetch dec page files linked to a policy.
 * Joins dec_pages → dec_page_submissions to get file metadata.
 */
export async function fetchDecPageFilesByPolicyId(policyId: string): Promise<DecPageFileInfo[]> {
    try {
        const { data, error } = await supabase
            .from('dec_pages')
            .select(`
                id,
                insured_name,
                policy_number,
                parse_status,
                created_at,
                submission_id,
                dec_page_submissions!inner (
                    id,
                    storage_path,
                    file_name,
                    file_size,
                    created_at
                )
            `)
            .eq('policy_id', policyId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('API', 'Error fetching dec page files', { message: error.message, policyId });
            return [];
        }

        if (!data) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((row: any) => {
            const sub = Array.isArray(row.dec_page_submissions)
                ? row.dec_page_submissions[0]
                : row.dec_page_submissions;
            return {
                id: sub?.id || row.id,
                dec_page_id: row.id,
                storage_path: sub?.storage_path || null,
                file_name: sub?.file_name || null,
                file_size: sub?.file_size || null,
                uploaded_at: sub?.created_at || row.created_at,
                parse_status: row.parse_status,
                insured_name: row.insured_name,
                policy_number: row.policy_number,
            };
        });
    } catch (err) {
        logger.error('API', 'Unexpected error fetching dec page files', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

/**
 * Generate a signed download URL for a file in Supabase Storage.
 */
export async function getDecPageFileDownloadUrl(storagePath: string): Promise<string | null> {
    try {
        const { data, error } = await supabase.storage
            .from('cfp-raw-decpage')
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (error || !data?.signedUrl) {
            logger.error('API', 'Error creating signed URL', { message: error?.message, storagePath });
            return null;
        }

        return data.signedUrl;
    } catch (err) {
        logger.error('API', 'Unexpected error creating signed URL', {
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

export interface ActivityFeedItem {
    id: string;
    type: 'upload';
    status: string;
    created_at: string;
    file_path: string | null;
    // From dec_pages (joined)
    insured_name?: string;
    policy_number?: string;
    policy_id?: string;
    client_id?: string;
    // Uploader info
    uploaded_by: string;
}

/**
 * Fetch recent declaration uploads for the activity feed.
 * Joins dec_page_submissions → dec_pages (for insured/policy info).
 */
export async function fetchActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
    try {
        const { data, error } = await supabase
            .from('dec_page_submissions')
            .select(`
                id,
                status,
                file_path,
                created_at,
                account_id,
                dec_pages (
                    insured_name,
                    policy_number,
                    policy_id,
                    client_id
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('API', 'Error fetching activity feed', { message: error.message });
            return [];
        }

        if (!data) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((row: any) => {
            // dec_pages can be an array (one-to-many) or a single object (FK)
            const dpRaw = row.dec_pages;
            const dp = Array.isArray(dpRaw)
                ? (dpRaw.length > 0 ? dpRaw[0] : null)
                : (dpRaw || null);
            return {
                id: row.id,
                type: 'upload' as const,
                status: row.status,
                created_at: row.created_at,
                file_path: row.file_path,
                insured_name: dp?.insured_name || undefined,
                policy_number: dp?.policy_number || undefined,
                policy_id: dp?.policy_id || undefined,
                client_id: dp?.client_id || undefined,
                uploaded_by: 'Agent',  // TODO: join accounts table for real name
            };
        });
    } catch (err) {
        logger.error('API', 'Unexpected error fetching activity feed', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

// ---------------------------------------------------------------------------
// Dec Page Review & Approval
// ---------------------------------------------------------------------------

export interface DecPageSummary {
    id: string;
    created_at: string;
    policy_number?: string;
    insured_name?: string;
    review_status: string;
    parse_status?: string;
    // Key coverage fields for comparison
    limit_dwelling?: string;
    limit_other_structures?: string;
    limit_personal_property?: string;
    deductible?: string;
    broker_name?: string;
    total_annual_premium?: string;
    policy_period_start?: string;
    policy_period_end?: string;
}

/**
 * Fetch all dec pages for a given policy, ordered most recent first.
 */
export async function fetchDecPagesForPolicy(policyId: string): Promise<DecPageSummary[]> {
    try {
        const { data, error } = await supabase
            .from('dec_pages')
            .select(`
                id, created_at, policy_number, insured_name, review_status, parse_status,
                limit_dwelling, limit_other_structures, limit_personal_property,
                deductible, broker_name, total_annual_premium,
                policy_period_start, policy_period_end
            `)
            .eq('policy_id', policyId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('API', 'Error fetching dec pages for policy', { message: error.message });
            return [];
        }
        return (data || []) as DecPageSummary[];
    } catch (err) {
        logger.error('API', 'Unexpected error', { error: String(err) });
        return [];
    }
}

/**
 * Approve a dec page: copy its coverage data into the current policy_term.
 * Supersedes any previously approved dec pages for the same policy.
 */
export async function approveDecPage(decPageId: string, policyId: string): Promise<boolean> {
    try {
        // 1. Fetch full dec page data
        const { data: dp, error: dpErr } = await supabase
            .from('dec_pages')
            .select('*')
            .eq('id', decPageId)
            .single();

        if (dpErr || !dp) {
            logger.error('API', 'Cannot fetch dec page for approval', { message: dpErr?.message });
            return false;
        }

        // 2. Find the current policy_term for this policy
        const { data: terms, error: termErr } = await supabase
            .from('policy_terms')
            .select('id')
            .eq('policy_id', policyId)
            .eq('is_current', true)
            .limit(1);

        if (termErr || !terms?.length) {
            logger.error('API', 'No current term found for policy', { policyId });
            return false;
        }

        const termId = terms[0].id;
        const now = new Date().toISOString();

        // 3. Get current user for approved_by
        const { data: { user } } = await supabase.auth.getUser();

        // 4. Promote dec page data → policy_term
        const { error: updateErr } = await supabase
            .from('policy_terms')
            .update({
                source_dec_page_id: decPageId,
                approved_at: now,
                approved_by: user?.id || null,
                effective_date: dp.policy_period_start || undefined,
                expiration_date: dp.policy_period_end || undefined,
                date_issued: dp.date_issued || undefined,
                deductible: dp.deductible || undefined,
                limit_dwelling: dp.limit_dwelling || undefined,
                limit_other_structures: dp.limit_other_structures || undefined,
                limit_personal_property: dp.limit_personal_property || undefined,
                limit_fair_rental_value: dp.limit_fair_rental_value || undefined,
                limit_ordinance_or_law: dp.limit_ordinance_or_law || undefined,
                limit_debris_removal: dp.limit_debris_removal || undefined,
                limit_extended_dwelling_coverage: dp.limit_extended_dwelling_coverage || undefined,
                limit_dwelling_replacement_cost: dp.limit_dwelling_replacement_cost || undefined,
                limit_inflation_guard: dp.limit_inflation_guard || undefined,
                limit_personal_property_replacement_cost: dp.limit_personal_property_replacement_cost || undefined,
                broker_name: dp.broker_name || undefined,
                broker_address: dp.broker_address || undefined,
                broker_phone: dp.broker_phone_number || undefined,
                mortgagee_1_name: dp.mortgagee_1_name || undefined,
                mortgagee_1_address: dp.mortgagee_1_address || undefined,
                mortgagee_1_code: dp.mortgagee_1_code || undefined,
                mortgagee_2_name: dp.mortgagee_2_name || undefined,
                mortgagee_2_address: dp.mortgagee_2_address || undefined,
                mortgagee_2_code: dp.mortgagee_2_code || undefined,
                property_location: dp.property_location || undefined,
                year_built: dp.year_built || undefined,
                occupancy: dp.occupancy || undefined,
                number_of_units: dp.number_of_units || undefined,
                construction_type: dp.construction_type || undefined,
                annual_premium: dp.total_annual_premium
                    ? parseFloat(dp.total_annual_premium.replace(/[$,]/g, '').trim()) || undefined
                    : undefined,
                updated_at: now,
            })
            .eq('id', termId);

        if (updateErr) {
            logger.error('API', 'Error promoting dec page to term', { message: updateErr.message });
            return false;
        }

        // 5. Mark this dec page as approved, supersede others
        await supabase
            .from('dec_pages')
            .update({ review_status: 'superseded' })
            .eq('policy_id', policyId)
            .eq('review_status', 'approved')
            .neq('id', decPageId);

        await supabase
            .from('dec_pages')
            .update({ review_status: 'approved' })
            .eq('id', decPageId);

        logger.info('API', `Dec page ${decPageId} approved for policy ${policyId}`);
        return true;
    } catch (err) {
        logger.error('API', 'Error in approveDecPage', { error: String(err) });
        return false;
    }
}
