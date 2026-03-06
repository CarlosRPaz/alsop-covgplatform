"""
dec_pages table operations.
Upserts extracted dec page data by submission_id (idempotent).
Uses Supabase's native upsert with on_conflict to prevent duplicates.
"""

import logging
from datetime import datetime, timezone

from ..supabase_client import get_supabase

logger = logging.getLogger("worker.db.dec_pages")


def _title_case(name: str | None) -> str | None:
    """Normalize a name to title case. Returns None if input is None/empty."""
    if not name:
        return None
    return name.strip().title()


def upsert_dec_page(
    submission_id: str,
    account_id: str,
    raw_text: str,
    extracted_json: dict,
    missing_fields: list[str],
    parse_status: str,
    extracted_data: dict | None = None,
    # Legacy individual field args (still accepted for backward compat)
    insured_name: str | None = None,
    policy_number: str | None = None,
    property_location: str | None = None,
    policy_period_start: str | None = None,
    policy_period_end: str | None = None,
) -> str:
    """
    Upsert a dec_pages row by submission_id (atomic, no duplicates).

    Uses Supabase upsert with on_conflict='submission_id' so that:
      - First call inserts a new row.
      - Subsequent calls update the existing row in place.

    Returns the dec_pages row id.
    """
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Prefer extracted_data dict if provided, fall back to individual args
    data = extracted_data or {}
    insured_name = _title_case(data.get("insured_name") or insured_name)
    policy_number = data.get("policy_number") or policy_number
    property_location = data.get("property_location") or property_location
    policy_period_start = data.get("policy_period_start") or policy_period_start
    policy_period_end = data.get("policy_period_end") or policy_period_end

    payload = {
        "submission_id": submission_id,
        "created_by_account_id": account_id,
        "raw_text": raw_text,
        "extracted_json": extracted_json,
        "needs_review": (parse_status == "needs_review"),
        "missing_fields": missing_fields if missing_fields else [],
        "parse_status": parse_status,
        # Core fields
        "insured_name": insured_name,
        "policy_number": policy_number,
        "property_location": property_location,
        "policy_period_start": policy_period_start,
        "policy_period_end": policy_period_end,
        # Timestamps
        "extracted_at": now_iso,
        "updated_at": now_iso,
    }

    # Add extended fields from extracted_data if present
    extended_fields = [
        "secondary_insured_name", "mailing_address",
        "year_built", "construction_type", "occupancy", "number_of_units",
        "deductible", "total_annual_premium",
        "broker_name", "broker_address", "broker_phone_number",
        # Coverage limits
        "limit_dwelling", "limit_personal_property", "limit_other_structures",
        "limit_loss_of_use", "limit_liability", "limit_medical",
    ]
    for field in extended_fields:
        val = data.get(field)
        if val is not None:
            payload[field] = val

    result = (
        sb.table("dec_pages")
        .upsert(payload, on_conflict="submission_id")
        .execute()
    )

    if not result.data:
        raise RuntimeError(f"Failed to upsert dec_pages row for submission {submission_id}")

    row_id = result.data[0]["id"]
    logger.info("Upserted dec_pages row %s for submission %s (parse_status=%s, insured=%s, policy=%s)",
                row_id, submission_id, parse_status, insured_name, policy_number)
    return row_id
