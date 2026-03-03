import { supabase } from './supabaseClient';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw row shape from the `parsed_cfpdecpage_data` Supabase table.
 * Mirrors the DB schema so we can eliminate `any` casts.
 */
export interface SupabaseDeclarationRow {
    id: string;
    created_at?: string;
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
    // Wildfire
    wildfire_risk_score_l1?: string;
    wildfire_risk_score_l2?: string;
    wildfire_premium?: string;
    wildfire_score_classification_l1?: string;
    wildfire_score_classification_l2?: string;
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
    // System
    status?: string;
}

/**
 * Application-level Declaration type.
 * This is the canonical shape used by all UI components.
 */
export interface Declaration {
    id: string;
    // Client Information
    client_id?: string;
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
    // Wildfire
    wildfire_risk_score_l1?: string;
    wildfire_risk_score_l2?: string;
    wildfire_premium: string;
    wildfire_score_classification_l1?: string;
    wildfire_score_classification_l2?: string;
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

    // Check for wildfire risk
    if (row.wildfire_risk_score_l1 || row.wildfire_risk_score_l2) {
        flags.push('Wildfire Zone');
    }

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
        // Client Information (synthetic until real client table exists)
        client_id: `client-${row.id.substring(0, 8)}`,
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
        // Wildfire
        wildfire_risk_score_l1: row.wildfire_risk_score_l1 || undefined,
        wildfire_risk_score_l2: row.wildfire_risk_score_l2 || undefined,
        wildfire_premium: row.wildfire_premium || '$0',
        wildfire_score_classification_l1: row.wildfire_score_classification_l1 || undefined,
        wildfire_score_classification_l2: row.wildfire_score_classification_l2 || undefined,
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
 * Fetch all declarations from Supabase, ordered by most recent first.
 */
export async function fetchSupabaseDeclarations(): Promise<Declaration[]> {
    try {
        const { data, error } = await supabase
            .from('parsed_cfpdecpage_data')
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
 * Fetch a single declaration by ID.
 */
export async function getDeclarationById(id: string): Promise<Declaration | undefined> {
    try {
        const { data, error } = await supabase
            .from('parsed_cfpdecpage_data')
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
 * Fetch all declarations matching a synthetic client_id.
 *
 * Because client_id is derived as `client-{row.id.substring(0,8)}`,
 * we extract the ID prefix and use a Supabase `like` query
 * instead of fetching all rows and filtering in memory.
 */
export async function fetchDeclarationsByClientId(clientId: string): Promise<Declaration[]> {
    try {
        // Extract the ID prefix from the synthetic client_id
        const idPrefix = clientId.replace('client-', '');
        if (!idPrefix || idPrefix.length < 8) {
            logger.warn('API', 'Invalid client_id format', { clientId });
            return [];
        }

        const { data, error } = await supabase
            .from('parsed_cfpdecpage_data')
            .select('*')
            .like('id', `${idPrefix}%`)
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
    if (declaration.flags.includes('Wildfire Zone')) {
        flagDetails.push('Property is in a wildfire risk zone');
        score -= 5;
    }
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
