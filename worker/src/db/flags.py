"""
policy_flags database operations.
Auto-generates flags based on extracted missing fields or validation rules.
Auto-resolves system flags that no longer apply.
"""

import logging
from datetime import datetime, timezone

from ..supabase_client import get_supabase

logger = logging.getLogger("worker.db.flags")

# MVP Flag Generation
def generate_and_resolve_flags(policy_id: str, dec_page_id: str, missing_fields: list[str]) -> None:
    """
    Evaluate system flags for a policy.
    1. Resolve previous "Missing Extraction Fields" flags if missing_fields is empty.
    2. Insert new "Missing Extraction Fields" flag if missing_fields exists.
    """
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # 1. Look for existing active system flags of type MISSING_FIELDS
    existing_flags = sb.table("policy_flags").select("*").eq("policy_id", policy_id).eq("code", "MISSING_FIELDS").is_("resolved_at", "null").execute()
    
    if existing_flags.data:
        if not missing_fields:
            # The fields are no longer missing; resolve old flags
            logger.info("Resolving old MISSING_FIELDS flags for policy %s", policy_id)
            for flag in existing_flags.data:
                sb.table("policy_flags").update({
                    "resolved_at": now_iso,
                    # We do not have "is_resolved" column, just resolved_at and resolved_by_account_id
                    # We will assume a None account_id means system resolution, but we can set note in details
                    "details": { **(flag.get("details") or {}), "resolution_note": "Auto-resolved by new document upload" }
                }).eq("id", flag["id"]).execute()
        else:
            # We still have missing fields, perhaps update the existing flag's message
            msg = f"Document parsing failed to identify keys: {', '.join(missing_fields)}"
            for flag in existing_flags.data:
                 sb.table("policy_flags").update({
                     "message": msg,
                     "updated_at": now_iso
                 }).eq("id", flag["id"]).execute()
            logger.info("Updated existing MISSING_FIELDS flag for policy %s", policy_id)
            return

    # 2. Create new missing fields flag if needed and not updated above
    if missing_fields:
        msg = f"Document parsing failed to identify keys: {', '.join(missing_fields)}"
        logger.info("Inserting new MISSING_FIELDS flag for policy %s", policy_id)
        sb.table("policy_flags").insert({
            "policy_id": policy_id,
            "source_dec_page_id": dec_page_id,
            "code": "MISSING_FIELDS",
            "severity": "warning",
            "title": "Incomplete Data Extraction",
            "message": msg,
            "source": "system",
            "details": {
                "missing_keys": missing_fields
            }
        }).execute()
        
    # Also generated an INFO flag that a new dec page was uploaded
    sb.table("policy_flags").insert({
        "policy_id": policy_id,
        "source_dec_page_id": dec_page_id,
        "code": "NEW_DOCUMENT",
        "severity": "info",
        "title": "New Declaration Processed",
        "message": "A new declaration page was successfully parsed and applied.",
        "source": "system"
    }).execute()
