import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

/**
 * POST /api/enrichment/run
 *
 * On-demand property enrichment for a specific policy.
 * Runs satellite imagery, geocoding, and fire risk enrichment
 * directly from the Next.js server — no worker needed.
 *
 * Body: { policy_id: string }
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const USDA_WHP_URL =
    'https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/RMRS_WildfireHazardPotential_2023/MapServer';

const WHP_LABELS: Record<number, string> = {
    1: 'Very Low',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Very High',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertEnrichment(
    sb: ReturnType<typeof getSupabaseAdmin>,
    payload: {
        policy_id: string;
        field_key: string;
        field_value: string | null;
        source_name: string;
        source_type: string;
        source_url?: string | null;
        confidence?: string;
        notes?: string | null;
    }
) {
    const now = new Date().toISOString();
    const row = {
        ...payload,
        confidence: payload.confidence || 'medium',
        fetched_at: now,
        updated_at: now,
    };

    const { error } = await sb
        .from('property_enrichments')
        .upsert(row, { onConflict: 'policy_id,field_key,source_name' });

    if (error) {
        logger.error('Enrichment', `upsert failed: ${error.message}`, { field_key: payload.field_key });
    }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!GOOGLE_MAPS_API_KEY) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results;
    if (!results || results.length === 0) return null;

    return results[0].geometry.location;
}

// ---------------------------------------------------------------------------
// Enrichment providers
// ---------------------------------------------------------------------------

async function enrichSatelliteImage(
    sb: ReturnType<typeof getSupabaseAdmin>,
    policyId: string,
    address: string
): Promise<boolean> {
    if (!GOOGLE_MAPS_API_KEY) return false;

    // Build the static map URL — this is the direct image URL that browsers load
    const mapUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${encodeURIComponent(address)}` +
        `&zoom=19&size=640x400&maptype=satellite` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

    // Verify the URL works before storing it
    const res = await fetch(mapUrl, { method: 'HEAD' });
    if (!res.ok) return false;

    // Store the direct Google Maps URL — no intermediary storage needed
    await upsertEnrichment(sb, {
        policy_id: policyId,
        field_key: 'property_image',
        field_value: mapUrl,
        source_name: 'Google Maps',
        source_type: 'api',
        source_url: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
        confidence: 'high',
        notes: `Satellite view at zoom 19 for address: ${address}`,
    });

    return true;
}

async function enrichStreetViewImage(
    sb: ReturnType<typeof getSupabaseAdmin>,
    policyId: string,
    coords: { lat: number; lng: number }
): Promise<boolean> {
    if (!GOOGLE_MAPS_API_KEY) return false;

    // 1. Check Metadata API to ensure a street view image actually exists here
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coords.lat},${coords.lng}&key=${GOOGLE_MAPS_API_KEY}`;
    
    try {
        const metaRes = await fetch(metaUrl);
        if (!metaRes.ok) return false;
        
        const metaData = await metaRes.json();
        if (metaData.status !== "OK") {
            // No street view image available
            return false;
        }

        // 2. Build the actual image URL (browser will load this directly)
        const imageUrl = `https://maps.googleapis.com/maps/api/streetview?location=${coords.lat},${coords.lng}&size=640x440&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
        
        // 3. Store the URL in enrichments
        await upsertEnrichment(sb, {
            policy_id: policyId,
            field_key: 'street_view_image',
            field_value: imageUrl,
            source_name: 'Google Street View',
            source_type: 'api',
            source_url: `https://maps.google.com/?q=${coords.lat},${coords.lng}&layer=c`,
            confidence: 'high',
            notes: `Street View image for coordinates: ${coords.lat}, ${coords.lng} (Date: ${metaData.date || 'Unknown'})`,
        });
        
        return true;
    } catch (e) {
        logger.error('Enrichment', `Street View Metadata error: ${e}`);
        return false;
    }
}

async function enrichCoordinates(
    sb: ReturnType<typeof getSupabaseAdmin>,
    policyId: string,
    address: string
): Promise<{ lat: number; lng: number } | null> {
    const coords = await geocodeAddress(address);
    if (!coords) return null;

    const sourceUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

    await upsertEnrichment(sb, {
        policy_id: policyId,
        field_key: 'latitude',
        field_value: String(coords.lat),
        source_name: 'Google Geocoding',
        source_type: 'api',
        source_url: sourceUrl,
        confidence: 'high',
        notes: `Geocoded from address: ${address}`,
    });

    await upsertEnrichment(sb, {
        policy_id: policyId,
        field_key: 'longitude',
        field_value: String(coords.lng),
        source_name: 'Google Geocoding',
        source_type: 'api',
        source_url: sourceUrl,
        confidence: 'high',
        notes: `Geocoded from address: ${address}`,
    });

    return coords;
}

async function enrichFireRisk(
    sb: ReturnType<typeof getSupabaseAdmin>,
    policyId: string,
    address: string,
    coords: { lat: number; lng: number }
): Promise<boolean> {
    const delta = 0.001;
    const params = new URLSearchParams({
        geometry: `${coords.lng},${coords.lat}`,
        geometryType: 'esriGeometryPoint',
        sr: '4326',
        layers: 'all',
        tolerance: '2',
        mapExtent: `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`,
        imageDisplay: '100,100,96',
        returnGeometry: 'false',
        f: 'json',
    });

    const res = await fetch(`${USDA_WHP_URL}/identify?${params}`, {
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;

    const data = await res.json();
    const results = data.results || [];

    let whpLabel = 'No Data';
    let whpClass: string = 'none';

    if (results.length > 0) {
        const pixelValue = results[0]?.attributes?.['Pixel Value'];
        if (pixelValue != null) {
            const cls = Math.round(Number(pixelValue));
            whpClass = String(cls);
            whpLabel = WHP_LABELS[cls] || `Class ${cls}`;
        }
    }

    await upsertEnrichment(sb, {
        policy_id: policyId,
        field_key: 'fire_risk_class',
        field_value: whpClass,
        source_name: 'USDA Forest Service',
        source_type: 'public_data',
        source_url: 'https://wildfirerisk.org',
        confidence: 'high',
        notes: `Wildfire Hazard Potential: ${whpLabel} at (${coords.lat}, ${coords.lng})`,
    });

    await upsertEnrichment(sb, {
        policy_id: policyId,
        field_key: 'fire_risk_label',
        field_value: whpLabel,
        source_name: 'USDA Forest Service',
        source_type: 'public_data',
        source_url: 'https://wildfirerisk.org',
        confidence: 'high',
        notes: 'Wildfire Hazard Potential classification (1=Very Low to 5=Very High)',
    });

    return true;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { policy_id } = body;

        if (!policy_id) {
            return NextResponse.json({ error: 'policy_id required' }, { status: 400 });
        }

        const sb = getSupabaseAdmin();

        // 1. Fetch the policy's property address
        const { data: policy, error: policyErr } = await sb
            .from('policies')
            .select('id, property_address_raw, property_address_norm')
            .eq('id', policy_id)
            .single();

        if (policyErr || !policy) {
            return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
        }

        const address = policy.property_address_norm || policy.property_address_raw;
        if (!address) {
            return NextResponse.json({
                error: 'No property address on this policy — cannot enrich',
                results: { satellite_image: false, coordinates: false, fire_risk: false },
            }, { status: 422 });
        }

        const results: Record<string, boolean | string> = {
            satellite_image: false,
            street_view_image: false,
            coordinates: false,
            fire_risk: false,
            vision_analysis: false,
            street_vision_analysis: false,
            address_used: address,
        };

        // 2. Satellite image
        try {
            results.satellite_image = await enrichSatelliteImage(sb, policy_id, address);
        } catch (e) {
            logger.error('Enrichment', `Satellite error: ${e}`);
        }

        // 3. Geocode → coordinates
        let coords: { lat: number; lng: number } | null = null;
        try {
            coords = await enrichCoordinates(sb, policy_id, address);
            results.coordinates = coords !== null;
        } catch (e) {
            logger.error('Enrichment', `Geocoding error: ${e}`);
        }

        // 4. Fire risk & Street View (needs coordinates)
        if (coords) {
            try {
                results.fire_risk = await enrichFireRisk(sb, policy_id, address, coords);
            } catch (e) {
                logger.error('Enrichment', `Fire risk error: ${e}`);
            }

            try {
                results.street_view_image = await enrichStreetViewImage(sb, policy_id, coords);
            } catch (e) {
                logger.error('Enrichment', `Street View error: ${e}`);
            }
        }

        // 5. AI Vision Analysis (needs satellite image)
        if (results.satellite_image) {
            try {
                const origin = request.nextUrl.origin;
                const visionRes = await fetch(`${origin}/api/enrichment/vision-analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ policy_id }),
                });
                if (visionRes.ok) {
                    const visionData = await visionRes.json();
                    results.vision_analysis = visionData.results?.analyzed ?? false;
                } else {
                    logger.error('Enrichment', `Vision analysis HTTP error: ${visionRes.status}`);
                }
            } catch (e) {
                logger.error('Enrichment', `Vision analysis error: ${e}`);
            }
        }

        // 6. AI Street Vision Analysis (needs street view image)
        if (results.street_view_image) {
            try {
                const origin = request.nextUrl.origin;
                const streetVisionRes = await fetch(`${origin}/api/enrichment/street-vision-analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ policy_id }),
                });
                if (streetVisionRes.ok) {
                    const streetVisionData = await streetVisionRes.json();
                    results.street_vision_analysis = streetVisionData.results?.analyzed ?? false;
                } else {
                    logger.error('Enrichment', `Street Vision analysis HTTP error: ${streetVisionRes.status}`);
                }
            } catch (e) {
                logger.error('Enrichment', `Street Vision analysis error: ${e}`);
            }
        }

        // 7. Auto-generate report after enrichment
        let reportGenerated = false;
        try {
            const origin = request.nextUrl.origin;
            const reportRes = await fetch(`${origin}/api/reports/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policyId: policy_id }),
            });
            if (reportRes.ok) {
                reportGenerated = true;
            } else {
                logger.error('Enrichment', `Report generation HTTP error: ${reportRes.status}`);
            }
        } catch (e) {
            logger.error('Enrichment', `Report generation error: ${e}`);
        }
        results.report_generated = reportGenerated;

        // 8. Activity event: enrichment complete
        try {
            await sb.from('activity_events').insert({
                event_type: 'enrichment.completed',
                title: 'Property data enriched',
                detail: `Satellite: ${results.satellite_image ? '✓' : '✗'}, Street View: ${results.street_view_image ? '✓' : '✗'}, Fire Risk: ${results.fire_risk ? '✓' : '✗'}, AI Vision: ${results.vision_analysis ? '✓' : '✗'}, Report: ${reportGenerated ? '✓' : '✗'}`,
                policy_id: policy_id,
                meta: { results },
            });
        } catch (e) {
            logger.warn('Enrichment', `Activity event insert failed (non-fatal): ${e}`);
        }

        return NextResponse.json({
            message: 'Enrichment complete',
            results,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Enrichment', `Unexpected error: ${msg}`);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
