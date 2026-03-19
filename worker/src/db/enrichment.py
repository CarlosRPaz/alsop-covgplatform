"""
Property Enrichment Module — fetches external data for policies.

After a dec page is parsed and lifecycle entities are created, this module
enriches the policy with external property data (images, public records, etc.).

Architecture:
  - enrich_property() is the orchestrator, called from main.py after flags
  - Individual provider functions (_enrich_*) handle specific data sources
  - All results stored via upsert_enrichment() with full source attribution
  - Failures are non-fatal — logged but never block ingestion

Adding a new provider:
  1. Write an _enrich_* function
  2. Call it from enrich_property()
  3. Done — it will store results with source tracking automatically
"""

import logging
import os
import urllib.parse
from datetime import datetime, timezone

import httpx

from ..supabase_client import get_supabase

logger = logging.getLogger("worker.db.enrichment")


# ---------------------------------------------------------------------------
# Generic enrichment upsert
# ---------------------------------------------------------------------------

def upsert_enrichment(
    *,
    policy_id: str,
    field_key: str,
    field_value: str | None,
    source_name: str,
    source_type: str,
    source_url: str | None = None,
    confidence: str = "medium",
    notes: str | None = None,
) -> str | None:
    """
    Insert or update a property enrichment row.

    Uses the unique constraint (policy_id, field_key, source_name) to upsert.
    Returns the enrichment row id, or None on failure.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "policy_id": policy_id,
        "field_key": field_key,
        "field_value": field_value,
        "source_name": source_name,
        "source_type": source_type,
        "source_url": source_url,
        "confidence": confidence,
        "notes": notes,
        "fetched_at": now,
        "updated_at": now,
    }

    try:
        res = (
            sb.table("property_enrichments")
            .upsert(payload, on_conflict="policy_id,field_key,source_name")
            .execute()
        )
        if res.data:
            row_id = res.data[0].get("id")
            logger.info(
                "Upserted enrichment: policy=%s field=%s source=%s",
                policy_id, field_key, source_name,
            )
            return row_id
    except Exception as e:
        logger.error(
            "Failed to upsert enrichment: policy=%s field=%s error=%s",
            policy_id, field_key, e,
        )
    return None


# ---------------------------------------------------------------------------
# Google Maps Static API — satellite imagery
# ---------------------------------------------------------------------------

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")


def _build_static_map_url(address: str) -> str:
    """Build a Google Maps Static API URL for a satellite view of the address."""
    encoded = urllib.parse.quote(address)
    return (
        f"https://maps.googleapis.com/maps/api/staticmap"
        f"?center={encoded}"
        f"&zoom=19"
        f"&size=640x400"
        f"&maptype=satellite"
        f"&key={GOOGLE_MAPS_API_KEY}"
    )


def _enrich_satellite_image(policy_id: str, address: str) -> bool:
    """
    Fetch a satellite image from Google Maps and store it in Supabase Storage.

    Steps:
      1. Build the Static Maps API URL
      2. Download the image bytes
      3. Upload to Supabase Storage: property-images/{policy_id}.jpg
      4. Get the public URL
      5. Store in property_enrichments with full source attribution

    Returns True if successful, False otherwise.
    """
    if not GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not set, skipping satellite image enrichment")
        return False

    api_url = _build_static_map_url(address)
    logger.info("Fetching satellite image for policy=%s address=%s", policy_id, address)

    try:
        # 1. Download image
        with httpx.Client(timeout=15.0) as client:
            response = client.get(api_url)

        if response.status_code != 200:
            logger.warning(
                "Google Maps API returned %d for policy=%s",
                response.status_code, policy_id,
            )
            return False

        image_bytes = response.content

        # Basic sanity: Google returns a small error tile if the address is bad
        if len(image_bytes) < 5000:
            logger.warning(
                "Image suspiciously small (%d bytes) for policy=%s — may be error tile",
                len(image_bytes), policy_id,
            )

        # 2. Upload to Supabase Storage
        sb = get_supabase()
        storage_path = f"property-images/{policy_id}.jpg"

        # Upsert: overwrite if exists (re-enrichment)
        sb.storage.from_("cfp-raw-decpage").upload(
            storage_path,
            image_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )

        # 3. Get public URL
        public_url_res = sb.storage.from_("cfp-raw-decpage").get_public_url(storage_path)
        public_url = public_url_res if isinstance(public_url_res, str) else str(public_url_res)

        logger.info("Uploaded satellite image for policy=%s: %s", policy_id, public_url)

        # 4. Store enrichment with source attribution
        upsert_enrichment(
            policy_id=policy_id,
            field_key="property_image",
            field_value=public_url,
            source_name="Google Maps",
            source_type="api",
            source_url=f"https://maps.google.com/?q={urllib.parse.quote(address)}",
            confidence="high",
            notes=f"Satellite view at zoom 19 for address: {address}",
        )

        return True

    except Exception as e:
        logger.error("Satellite image enrichment failed for policy=%s: %s", policy_id, e)
        return False


# ---------------------------------------------------------------------------
# Orchestrator — called from main.py
# ---------------------------------------------------------------------------

def enrich_property(policy_id: str, property_address: str | None) -> dict:
    """
    Run all enrichment providers for a policy.

    Called non-blocking after flag evaluation. Failures are logged
    but never raise — the ingestion job should still complete.

    Returns a summary dict: {"satellite_image": True/False, ...}
    """
    summary = {
        "satellite_image": False,
    }

    if not property_address or not property_address.strip():
        logger.info("No property address for policy=%s, skipping enrichment", policy_id)
        return summary

    address = property_address.strip()

    # --- Provider 1: Satellite imagery ---
    try:
        summary["satellite_image"] = _enrich_satellite_image(policy_id, address)
    except Exception as e:
        logger.warning("Satellite image enrichment error (non-fatal): %s", e)

    # --- Future providers go here ---
    # try:
    #     summary["county_assessor"] = _enrich_county_assessor(policy_id, address)
    # except Exception as e:
    #     logger.warning("County assessor enrichment error (non-fatal): %s", e)

    logger.info("Enrichment complete for policy=%s: %s", policy_id, summary)
    return summary
