import { supabase } from './supabaseClient';

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
    dic_company?: string; // Company name or "None"

    // System Fields
    status: 'Pending Review' | 'Approved' | 'Rejected' | 'Incomplete';
    flags: string[]; // For UI display
}

export async function submitDeclaration(data: any) {
    console.log('Submitting declaration:', data);
    return { success: true };
}

// Fetch declarations from Supabase
export async function fetchSupabaseDeclarations(): Promise<Declaration[]> {
    try {
        const { data, error } = await supabase
            .from('parsed_cfpdecpage_data')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching from Supabase:', error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Transform Supabase data to Declaration interface
        return data.map((row: any) => ({
            id: row.id,
            // Client Information (not in current schema, using defaults)
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
            renewal_date: row.policy_period_end || '', // Use end date as renewal
            // Property Details
            year_built: row.year_built ? parseInt(row.year_built) : 0,
            occupancy: row.occupancy || 'Unknown',
            number_of_units: row.number_of_units ? parseInt(row.number_of_units) : 1,
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
            dic_company: undefined,
            // System Fields - Derive status and flags
            status: 'Pending Review' as const,
            flags: generateFlags(row),
        }));
    } catch (err) {
        console.error('Unexpected error fetching Supabase data:', err);
        return [];
    }
}

// Helper function to generate flags based on policy data
function generateFlags(row: any): string[] {
    const flags: string[] = [];

    // Check for missing critical data
    if (!row.policy_number) flags.push('Missing Policy #');
    if (!row.limit_dwelling) flags.push('Missing Coverage');

    // Check for wildfire risk
    if (row.wildfire_risk_score_l1 || row.wildfire_risk_score_l2) {
        flags.push('Wildfire Zone');
    }

    // Check for occupancy type
    if (row.occupancy?.toLowerCase() === 'tenant') {
        flags.push('Tenant-Occupied');
    } else if (row.occupancy?.toLowerCase() === 'secondary') {
        flags.push('Secondary Residence');
    }

    return flags;
}

// Re-export fetchSupabaseDeclarations under the old name for backward compat
export const fetchDeclarations = fetchSupabaseDeclarations;

export async function getDeclarationById(id: string): Promise<Declaration | undefined> {
    const { data, error } = await supabase
        .from('parsed_cfpdecpage_data')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) return undefined;

    // Re-use the same mapping logic as fetchSupabaseDeclarations
    const row = data as any;
    return {
        id: row.id,
        client_id: `client-${row.id.substring(0, 8)}`,
        client_email: undefined,
        client_phone: undefined,
        insured_name: row.insured_name || 'Unknown',
        secondary_insured_name: row.secondary_insured_name || undefined,
        mailing_address: row.mailing_address || 'No address provided',
        property_location: row.property_location || 'No location provided',
        policy_number: row.policy_number || 'N/A',
        date_issued: row.date_issued || '',
        policy_period_start: row.policy_period_start || '',
        policy_period_end: row.policy_period_end || '',
        renewal_date: row.policy_period_end || '',
        year_built: row.year_built ? parseInt(row.year_built) : 0,
        occupancy: row.occupancy || 'Unknown',
        number_of_units: row.number_of_units ? parseInt(row.number_of_units) : 1,
        construction_type: row.construction_type || 'Unknown',
        deductible: row.deductible || '$0',
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
        limit_actual_cash_value_coverage: row.limit_actual_cash_value_coverage || undefined,
        limit_replacement_cost_coverage: row.limit_replacement_cost_coverage || undefined,
        limit_building_code_upgrade_coverage: row.limit_building_code_upgrade_coverage || undefined,
        cb_fire_lightning_smoke_damage: row.cb_fire_lightning_smoke_damage || false,
        cb_extended_coverages: row.cb_extended_coverages || false,
        cb_vandalism_malicious_mischief: row.cb_vandalism_malicious_mischief || false,
        wildfire_risk_score_l1: row.wildfire_risk_score_l1 || undefined,
        wildfire_risk_score_l2: row.wildfire_risk_score_l2 || undefined,
        wildfire_premium: row.wildfire_premium || '$0',
        wildfire_score_classification_l1: row.wildfire_score_classification_l1 || undefined,
        wildfire_score_classification_l2: row.wildfire_score_classification_l2 || undefined,
        total_annual_premium: row.total_annual_premium || '$0',
        broker_name: row.broker_name || 'Unknown',
        broker_address: row.broker_address || '',
        broker_phone_number: row.broker_phone_number || '',
        mortgagee_1_name: row.mortgagee_1_name || undefined,
        mortgagee_1_address: row.mortgagee_1_address || undefined,
        mortgagee_1_code: row.mortgagee_1_code || undefined,
        mortgagee_2_name: row.mortgagee_2_name || undefined,
        mortgagee_2_address: row.mortgagee_2_address || undefined,
        mortgagee_2_code: row.mortgagee_2_code || undefined,
        dic_company: undefined,
        status: 'Pending Review' as const,
        flags: generateFlags(row),
    };
}

// Fetch all declarations matching a client_id
// client_id is synthetic: "client-{row.id.substring(0,8)}"
// so we reverse-lookup by fetching all declarations and filtering
export async function fetchDeclarationsByClientId(clientId: string): Promise<Declaration[]> {
    const allDeclarations = await fetchSupabaseDeclarations();
    return allDeclarations.filter(d => d.client_id === clientId);
}

// AI Report types and function
export interface AIReportData {
    overallScore: number;
    coverageGaps: string[];
    flagDetails: string[];
    suggestions: string[];
}

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

// Fetch AI report for a specific policy by ID
export async function fetchAIReport(id: string): Promise<AIReportData> {
    const declaration = await getDeclarationById(id);
    if (!declaration) {
        return {
            overallScore: 0,
            coverageGaps: ['Unable to load policy data'],
            flagDetails: ['Policy not found'],
            suggestions: ['Please verify the policy ID'],
        };
    }
    return generateAIReport(declaration);
}
