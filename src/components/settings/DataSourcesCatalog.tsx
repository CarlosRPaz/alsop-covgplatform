'use client';

import React, { useState, useMemo } from 'react';
import {
    Search, ChevronDown, ChevronUp, ExternalLink,
    CheckCircle2, Clock, AlertTriangle, Circle, Minus
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceType = 'parser' | 'public_data' | 'api' | 'ai_inferred' | 'manual' | 'future_vendor';
type Status = 'live' | 'partial' | 'planned' | 'manual_only' | 'deferred';
type Confidence = 'trusted' | 'inferred' | 'manual_review';
type UsedIn = 'policy_page' | 'report' | 'flags' | 'internal';
type Lifecycle = 'parsed' | 'enriched' | 'manual' | 'future';
type Category = 'property_basics' | 'fire_risk' | 'exterior_structures' | 'roof_condition' | 'property_condition' | 'interior';

interface DataPoint {
    id: string;
    name: string;
    category: Category;
    sourceType: SourceType;
    sourceName: string;
    status: Status;
    confidence: Confidence;
    usedIn: UsedIn[];
    lifecycle: Lifecycle;
    savedToDb: boolean;
    surfacedInUi: boolean;
    endpointBuilt: boolean;
    sourceAttribution: boolean;
    notes: string;
    detailNotes?: string;
    flagCode?: string;
    upgradeNote?: string;
}

// ---------------------------------------------------------------------------
// Data Catalog — single source of truth for all 42 enrichment data points
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<Category, string> = {
    property_basics: 'Property Basics',
    fire_risk: 'Fire & Risk',
    exterior_structures: 'Exterior Structures',
    roof_condition: 'Roof Condition',
    property_condition: 'Property Condition',
    interior: 'Interior',
};

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
    parser: 'Parser',
    public_data: 'Public Data',
    api: 'API',
    ai_inferred: 'AI / Inferred',
    manual: 'Manual',
    future_vendor: 'Future Vendor',
};

const STATUS_LABELS: Record<Status, string> = {
    live: 'Live',
    partial: 'Partial',
    planned: 'Planned',
    manual_only: 'Manual Only',
    deferred: 'Deferred',
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
    trusted: 'Trusted',
    inferred: 'Inferred',
    manual_review: 'Manual Review',
};

const USED_IN_LABELS: Record<UsedIn, string> = {
    policy_page: 'Policy Page',
    report: 'Report',
    flags: 'Flags',
    internal: 'Internal',
};

const DATA_POINTS: DataPoint[] = [
    // ── Property Basics ──
    {
        id: 'address', name: 'Address', category: 'property_basics',
        sourceType: 'parser', sourceName: 'Dec Page Parser',
        status: 'live', confidence: 'trusted', usedIn: ['policy_page', 'report'],
        lifecycle: 'parsed', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: false,
        notes: 'Extracted from dec page during ingestion.',
        detailNotes: 'Stored on policies.property_address_raw and policies.property_address_norm. Used as input for geocoding and satellite imagery enrichment.',
    },
    {
        id: 'year_built', name: 'House Year Built', category: 'property_basics',
        sourceType: 'api', sourceName: 'Property Data API',
        status: 'planned', confidence: 'trusted', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Needs RentCast or county assessor API key.',
        detailNotes: 'Critical for ROOF_AGE_OVER_25_WITH_RC flag. Once live, stored in property_enrichments with source attribution. Will feed report v1 and policy page basics section.',
        flagCode: 'ROOF_AGE_OVER_25_WITH_RC_INCLUDED',
        upgradeNote: 'Add county-specific assessor data as a higher-confidence backup source.',
    },
    {
        id: 'sq_footage', name: 'Sq Footage', category: 'property_basics',
        sourceType: 'api', sourceName: 'Property Data API',
        status: 'planned', confidence: 'trusted', usedIn: ['policy_page', 'report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Needs RentCast or county assessor API key.',
        detailNotes: 'Will help with coverage adequacy analysis. Stored in property_enrichments with source attribution.',
    },
    {
        id: 'stories', name: '# of Stories', category: 'property_basics',
        sourceType: 'api', sourceName: 'Property Data API',
        status: 'planned', confidence: 'trusted', usedIn: ['policy_page', 'report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Needs RentCast or county assessor API key.',
    },
    {
        id: 'home_occupancy', name: 'Home Occupancy', category: 'property_basics',
        sourceType: 'parser', sourceName: 'Dec Page Parser',
        status: 'live', confidence: 'trusted', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'parsed', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: false,
        notes: 'Derived from coverage form type (HO-3 owner / HO-4 renter / etc.).',
        flagCode: 'PERSONAL_PROPERTY_ZERO_OWNER_OCCUPIED',
    },
    {
        id: 'roof_age', name: 'Roof Age', category: 'property_basics',
        sourceType: 'api', sourceName: 'Derived (year built)',
        status: 'planned', confidence: 'trusted', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Must be under 25 years for replacement cost eligibility.',
        detailNotes: 'Calculated from year_built or roof_year enrichment. Critical flag: policies with RC on structures over 25 years old may not be eligible.',
        flagCode: 'ROOF_AGE_OVER_25_WITH_RC_INCLUDED',
        upgradeNote: 'Upgrade to dedicated roof_year source from county records when available.',
    },
    {
        id: 'roof_type', name: 'Roof Type', category: 'property_basics',
        sourceType: 'ai_inferred', sourceName: 'Aerial Imagery AI',
        status: 'planned', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2: County records or AI analysis.',
    },

    // ── Fire & Risk ──
    {
        id: 'firescore', name: 'Firescore', category: 'fire_risk',
        sourceType: 'public_data', sourceName: 'USDA Forest Service',
        status: 'live', confidence: 'trusted', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'USDA Wildfire Hazard Potential via ArcGIS REST API (free).',
        detailNotes: 'Queries the USDA WHP 2023 MapServer identify endpoint using geocoded coordinates. Risk classes: 1 (Very Low) to 5 (Very High). Shows as fire risk badge on property banner.',
    },
    {
        id: 'satellite_image', name: 'Satellite Image', category: 'fire_risk',
        sourceType: 'api', sourceName: 'Google Maps Static API',
        status: 'live', confidence: 'trusted', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Google Maps satellite view at zoom 19. Free tier: $200/mo.',
        detailNotes: 'Stored as direct URL in property_enrichments. Displayed on the property banner with source attribution badge showing "Google Maps · Api ✓".',
    },
    {
        id: 'coordinates', name: 'Lat/Lng Coordinates', category: 'fire_risk',
        sourceType: 'api', sourceName: 'Google Geocoding',
        status: 'live', confidence: 'trusted', usedIn: ['internal'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: false, endpointBuilt: true, sourceAttribution: true,
        notes: 'Used by fire risk and future structure detection providers.',
        detailNotes: 'Geocoded once and reused across enrichment providers. Stored as separate latitude/longitude enrichment rows.',
    },
    {
        id: 'street_view_image', name: 'Street View Image', category: 'property_basics',
        sourceType: 'api', sourceName: 'Google Street View API',
        status: 'live', confidence: 'trusted', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Google Street View static image for front elevation analysis.',
    },
    {
        id: 'ai_sv_stories', name: 'Number of Stories (SV)', category: 'property_basics',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI inferred number of stories from front elevation.',
    },

    // ── Exterior Structures (Live via AI Vision) ──
    {
        id: 'pool', name: 'Pool', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision analysis of satellite imagery. Detects pools from overhead view with high confidence.',
        detailNotes: 'GPT-4o analyzes the existing satellite image to detect rectangular/freeform blue water areas. Stored in property_enrichments with confidence score and AI rationale.',
    },
    {
        id: 'solar_panels', name: 'Solar Panels', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of rooftop solar panels from satellite imagery.',
    },
    {
        id: 'detached_garage', name: 'Detached Garage', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection. Other structures coverage flag potential.',
    },
    {
        id: 'shed', name: 'Shed', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of small detached outbuildings.',
    },
    {
        id: 'guest_house', name: 'Guest House / ADU', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of secondary dwelling structures. Fair rental value flag potential.',
    },
    {
        id: 'fences', name: 'Fences', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of fence lines from satellite view. Lower confidence — may be subtle.',
    },
    {
        id: 'deck_patio', name: 'Deck / Patio', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of decks, patios, and patio overhangs from satellite imagery.',
    },
    {
        id: 'gazebos', name: 'Gazebos', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of freestanding garden structures.',
    },
    {
        id: 'driveways', name: 'Driveways', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of paved or gravel driveways from satellite view.',
    },
    {
        id: 'carport', name: 'Car Port', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of open-sided covered vehicle structures.',
    },
    {
        id: 'recreational', name: 'Tennis / Basketball / Rec Area', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report', 'flags'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'AI vision detection of sports courts and recreational areas. Liability flag potential.',
    },
    {
        id: 'ai_sv_garage', name: 'Front Garage / Carport (SV)', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Presence of front-facing attached/detached garage or carport.',
    },
    {
        id: 'ai_sv_fencing', name: 'Front Fencing / Gates (SV)', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Visible fencing or gate across the front property line.',
    },
    {
        id: 'bbq_barn', name: 'BBQ Pit / Barn', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'planned', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2: Other structures.',
    },
    {
        id: 'walkways', name: 'Walkways', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'planned', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2.',
    },
    {
        id: 'walls', name: 'Walls', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'planned', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2.',
    },
    {
        id: 'stairs', name: 'Stairs', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Street View AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Requires street view imagery.',
    },
    {
        id: 'water_tank', name: 'Water Tank', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },
    {
        id: 'chicken_coops', name: 'Chicken Coops', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },
    {
        id: 'tennis_rec', name: 'Tennis / Basketball / Rec', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Liability flag potential.',
    },
    {
        id: 'jacuzzi_spa', name: 'Jacuzzis / Spa', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Liability flag.',
    },
    {
        id: 'outdoor_bathroom', name: 'Outdoor Bathroom', category: 'exterior_structures',
        sourceType: 'ai_inferred', sourceName: 'Satellite Imagery AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },

    // ── Roof Condition ──
    {
        id: 'ai_sv_roof_condition', name: 'Roof Condition Clues (SV)', category: 'roof_condition',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Front elevation view of roof condition clues like missing shingles or tarps.',
    },
    {
        id: 'damaged_roof', name: 'Damaged Roof', category: 'roof_condition',
        sourceType: 'ai_inferred', sourceName: 'Aerial Imagery AI',
        status: 'planned', confidence: 'manual_review', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2: AI detection, needs manual review confirmation.',
    },
    {
        id: 'roof_calcification', name: 'Roof Calcification / Moss / Staining', category: 'roof_condition',
        sourceType: 'ai_inferred', sourceName: 'Aerial Imagery AI',
        status: 'planned', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2: Condition indicator.',
    },
    {
        id: 'roof_change', name: 'Roof Change Over Time', category: 'roof_condition',
        sourceType: 'ai_inferred', sourceName: 'Historical Aerial Comparison',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Compare historical satellite images. Requires Nearmap or similar.',
    },

    // ── Property Condition ──
    {
        id: 'ai_sv_exterior_condition', name: 'Exterior Condition (SV)', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Visible signs of siding damage, peeling paint, etc. from street view.',
    },
    {
        id: 'ai_sv_vegetation', name: 'Overgrown Vegetation (SV)', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Street Vision AI (GPT-4o)',
        status: 'live', confidence: 'inferred', usedIn: ['policy_page', 'report'],
        lifecycle: 'enriched', savedToDb: true, surfacedInUi: true, endpointBuilt: true, sourceAttribution: true,
        notes: 'Detection of yard debris or overgrown vegetation near structures.',
    },
    {
        id: 'overgrown_veg', name: 'Overgrown Vegetation / Debris', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Aerial / Street View AI',
        status: 'planned', confidence: 'manual_review', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 2: Fire risk amplifier. Needs manual review.',
    },
    {
        id: 'property_mods', name: 'Property Modifications', category: 'property_condition',
        sourceType: 'manual', sourceName: 'Permit Records / Manual',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Future: Permit records API (county-specific).',
    },
    {
        id: 'home_damage', name: 'Home Damage', category: 'property_condition',
        sourceType: 'manual', sourceName: 'Street View AI / Inspection',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Condition flag.',
    },
    {
        id: 'cracked_foundation', name: 'Cracked Foundation', category: 'property_condition',
        sourceType: 'manual', sourceName: 'Street View AI / Inspection',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },
    {
        id: 'structural_issues', name: 'Structural Issues', category: 'property_condition',
        sourceType: 'manual', sourceName: 'Inspection / Manual',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report', 'flags'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },
    {
        id: 'land_shifting', name: 'Land Shifting', category: 'property_condition',
        sourceType: 'manual', sourceName: 'Geological Data / Manual',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Future: Geological survey data.',
    },
    {
        id: 'awnings', name: 'Awnings', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Street View AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },
    {
        id: 'signs', name: 'Signs', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Street View AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3: Occupancy type indicator.',
    },
    {
        id: 'outdoor_equipment', name: 'Outdoor Radio/TV Equipment', category: 'property_condition',
        sourceType: 'ai_inferred', sourceName: 'Street View AI',
        status: 'deferred', confidence: 'inferred', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Phase 3.',
    },

    // ── Interior ──
    {
        id: 'floor_types', name: 'Floor Types', category: 'interior',
        sourceType: 'future_vendor', sourceName: 'Premium Vendor / Manual',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Future: Requires interior inspection or premium data vendor.',
    },
    {
        id: 'counter_tops', name: 'Counter Tops', category: 'interior',
        sourceType: 'future_vendor', sourceName: 'Premium Vendor / Manual',
        status: 'deferred', confidence: 'manual_review', usedIn: ['report'],
        lifecycle: 'future', savedToDb: false, surfacedInUi: false, endpointBuilt: false, sourceAttribution: true,
        notes: 'Future: Requires interior inspection or premium data vendor.',
    },
];

// ---------------------------------------------------------------------------
// Badge styling
// ---------------------------------------------------------------------------

const statusColors: Record<Status, { bg: string; text: string; border: string }> = {
    live: { bg: 'rgba(34, 197, 94, 0.1)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.2)' },
    partial: { bg: 'rgba(234, 179, 8, 0.1)', text: '#facc15', border: 'rgba(234, 179, 8, 0.2)' },
    planned: { bg: 'rgba(99, 102, 241, 0.1)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.2)' },
    manual_only: { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' },
    deferred: { bg: 'rgba(100, 116, 139, 0.08)', text: '#64748b', border: 'rgba(100, 116, 139, 0.15)' },
};

const sourceTypeColors: Record<SourceType, { bg: string; text: string; border: string }> = {
    parser: { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.2)' },
    public_data: { bg: 'rgba(34, 197, 94, 0.1)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.2)' },
    api: { bg: 'rgba(168, 85, 247, 0.1)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.2)' },
    ai_inferred: { bg: 'rgba(249, 115, 22, 0.1)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.2)' },
    manual: { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' },
    future_vendor: { bg: 'rgba(100, 116, 139, 0.08)', text: '#64748b', border: 'rgba(100, 116, 139, 0.15)' },
};

const confidenceColors: Record<Confidence, { bg: string; text: string; border: string }> = {
    trusted: { bg: 'rgba(34, 197, 94, 0.1)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.2)' },
    inferred: { bg: 'rgba(249, 115, 22, 0.1)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.2)' },
    manual_review: { bg: 'rgba(234, 179, 8, 0.1)', text: '#facc15', border: 'rgba(234, 179, 8, 0.2)' },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string; border: string } }) {
    return (
        <span style={{
            display: 'inline-block',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: colors.text,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            whiteSpace: 'nowrap',
        }}>{label}</span>
    );
}

function StatusIcon({ status }: { status: Status }) {
    switch (status) {
        case 'live': return <CheckCircle2 size={13} style={{ color: '#4ade80' }} />;
        case 'partial': return <AlertTriangle size={13} style={{ color: '#facc15' }} />;
        case 'planned': return <Clock size={13} style={{ color: '#a5b4fc' }} />;
        case 'manual_only': return <Circle size={13} style={{ color: '#94a3b8' }} />;
        case 'deferred': return <Minus size={13} style={{ color: '#64748b' }} />;
    }
}

function BoolDot({ value }: { value: boolean }) {
    return (
        <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: value ? '#4ade80' : 'rgba(100,116,139,0.3)',
            border: value ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(100,116,139,0.15)',
        }} />
    );
}

// ---------------------------------------------------------------------------
// Detail Drawer
// ---------------------------------------------------------------------------

function DetailDrawer({ dp, onClose }: { dp: DataPoint; onClose: () => void }) {
    const rows: { label: string; value: React.ReactNode }[] = [
        { label: 'Category', value: CATEGORY_LABELS[dp.category] },
        { label: 'Source', value: dp.sourceName },
        { label: 'Source Type', value: <Badge label={SOURCE_TYPE_LABELS[dp.sourceType]} colors={sourceTypeColors[dp.sourceType]} /> },
        { label: 'Status', value: <><StatusIcon status={dp.status} /> <Badge label={STATUS_LABELS[dp.status]} colors={statusColors[dp.status]} /></> },
        { label: 'Confidence', value: <Badge label={CONFIDENCE_LABELS[dp.confidence]} colors={confidenceColors[dp.confidence]} /> },
        { label: 'Used In', value: dp.usedIn.map(u => USED_IN_LABELS[u]).join(', ') },
        { label: 'Lifecycle', value: dp.lifecycle.charAt(0).toUpperCase() + dp.lifecycle.slice(1) },
    ];

    const boolRows: { label: string; value: boolean }[] = [
        { label: 'Endpoint Built', value: dp.endpointBuilt },
        { label: 'Saved to DB', value: dp.savedToDb },
        { label: 'Surfaced in UI', value: dp.surfacedInUi },
        { label: 'Source Attribution', value: dp.sourceAttribution },
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw',
            background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
            zIndex: 1000, boxShadow: '-8px 0 30px rgba(0,0,0,0.4)', overflowY: 'auto',
            animation: 'slideIn 0.2s ease-out',
        }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem' }}>{dp.name}</h3>
                        <Badge label={STATUS_LABELS[dp.status]} colors={statusColors[dp.status]} />
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                {/* Properties */}
                <div style={{ marginBottom: '1.25rem' }}>
                    {rows.map(r => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '110px', flexShrink: 0, fontWeight: 500 }}>{r.label}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>{r.value}</span>
                        </div>
                    ))}
                </div>

                {/* Build Status */}
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Build Status</div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.625rem 0.875rem', marginBottom: '1.25rem' }}>
                    {boolRows.map(r => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', padding: '0.35rem 0', gap: '0.5rem' }}>
                            <BoolDot value={r.value} />
                            <span style={{ fontSize: '0.75rem', color: r.value ? 'var(--text-mid)' : '#475569' }}>{r.label}</span>
                        </div>
                    ))}
                </div>

                {/* Notes */}
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Notes</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{dp.notes}</p>
                {dp.detailNotes && <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>{dp.detailNotes}</p>}

                {dp.flagCode && (
                    <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Related Flag</div>
                        <code style={{ fontSize: '0.72rem', color: '#c084fc', background: 'rgba(168,85,247,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{dp.flagCode}</code>
                    </div>
                )}

                {dp.upgradeNote && (
                    <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Upgrade Path</div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{dp.upgradeNote}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DataSourcesCatalog() {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
    const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType | 'all'>('all');
    const [selectedDp, setSelectedDp] = useState<DataPoint | null>(null);

    const filtered = useMemo(() => {
        return DATA_POINTS.filter(dp => {
            if (search && !dp.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (categoryFilter !== 'all' && dp.category !== categoryFilter) return false;
            if (statusFilter !== 'all' && dp.status !== statusFilter) return false;
            if (sourceTypeFilter !== 'all' && dp.sourceType !== sourceTypeFilter) return false;
            return true;
        });
    }, [search, categoryFilter, statusFilter, sourceTypeFilter]);

    const stats = useMemo(() => {
        const live = DATA_POINTS.filter(d => d.status === 'live').length;
        const partial = DATA_POINTS.filter(d => d.status === 'partial').length;
        const planned = DATA_POINTS.filter(d => d.status === 'planned').length;
        const manualOnly = DATA_POINTS.filter(d => d.status === 'manual_only').length;
        const deferred = DATA_POINTS.filter(d => d.status === 'deferred').length;
        const reportReady = DATA_POINTS.filter(d => d.usedIn.includes('report') && (d.status === 'live' || d.status === 'partial')).length;
        const flagCapable = DATA_POINTS.filter(d => d.usedIn.includes('flags') || d.flagCode).length;
        return { total: DATA_POINTS.length, live, partial, planned, manualOnly, deferred, reportReady, flagCapable };
    }, []);

    const selectStyle: React.CSSProperties = {
        padding: '0.4rem 0.6rem',
        fontSize: '0.72rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        color: 'var(--text-mid)',
        cursor: 'pointer',
        outline: 'none',
    };

    return (
        <div>
            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-default)' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-high)', marginBottom: '0.25rem' }}>Data Sources</h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>All property enrichment data points, their sources, and current build status.</p>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                    { label: 'Total', value: stats.total, color: 'var(--text-mid)' },
                    { label: 'Live', value: stats.live, color: '#4ade80' },
                    { label: 'Partial', value: stats.partial, color: '#facc15' },
                    { label: 'Planned', value: stats.planned, color: '#a5b4fc' },
                    { label: 'Manual Only', value: stats.manualOnly, color: '#94a3b8' },
                    { label: 'Report-Ready', value: stats.reportReady, color: '#38bdf8' },
                    { label: 'Flag-Capable', value: stats.flagCapable, color: '#f472b6' },
                ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: s.color }}>{s.value}</span>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search data points..."
                        style={{ ...selectStyle, width: '100%', paddingLeft: '1.75rem' }}
                    />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as Category | 'all')} style={selectStyle}>
                    <option value="all">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')} style={selectStyle}>
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={sourceTypeFilter} onChange={e => setSourceTypeFilter(e.target.value as SourceType | 'all')} style={selectStyle}>
                    <option value="all">All Source Types</option>
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Data Point', 'Source', 'Type', 'Status', 'Confidence', 'Used In', 'DB', 'UI', 'Attr.', ''].map(h => (
                                <th key={h} style={{ padding: '0.5rem 0.625rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(dp => (
                            <tr
                                key={dp.id}
                                onClick={() => setSelectedDp(dp)}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td style={{ padding: '0.5rem 0.625rem', fontWeight: 600, color: 'var(--text-high)', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <StatusIcon status={dp.status} />
                                        {dp.name}
                                    </div>
                                </td>
                                <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-mid)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dp.sourceName}</td>
                                <td style={{ padding: '0.5rem 0.625rem' }}><Badge label={SOURCE_TYPE_LABELS[dp.sourceType]} colors={sourceTypeColors[dp.sourceType]} /></td>
                                <td style={{ padding: '0.5rem 0.625rem' }}><Badge label={STATUS_LABELS[dp.status]} colors={statusColors[dp.status]} /></td>
                                <td style={{ padding: '0.5rem 0.625rem' }}><Badge label={CONFIDENCE_LABELS[dp.confidence]} colors={confidenceColors[dp.confidence]} /></td>
                                <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-muted)', fontSize: '0.68rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {dp.usedIn.map(u => USED_IN_LABELS[u]).join(', ')}
                                </td>
                                <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}><BoolDot value={dp.savedToDb} /></td>
                                <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}><BoolDot value={dp.surfacedInUi} /></td>
                                <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}><BoolDot value={dp.sourceAttribution} /></td>
                                <td style={{ padding: '0.5rem 0.625rem' }}><ChevronDown size={12} style={{ color: '#475569' }} /></td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No data points match your filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: '#475569' }}>
                Showing {filtered.length} of {DATA_POINTS.length} data points · Click any row for details
            </div>

            {/* Detail Drawer */}
            {selectedDp && (
                <>
                    <div onClick={() => setSelectedDp(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
                    <DetailDrawer dp={selectedDp} onClose={() => setSelectedDp(null)} />
                </>
            )}
        </div>
    );
}
