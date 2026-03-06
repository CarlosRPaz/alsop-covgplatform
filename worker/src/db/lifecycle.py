"""
Policy lifecycle database operations.
Upserts clients, policies, and policy_terms rows based on extracted dec page data.
"""

import logging
from datetime import datetime, timezone

from ..supabase_client import get_supabase

logger = logging.getLogger("worker.db.lifecycle")


def normalize_address(address_str: str | None) -> str | None:
    """Normalize address for unique contraints and matching."""
    if not address_str:
        return None
    # Basic normalization for matching: upper case, remove commas, trim excess spaces
    s = address_str.upper().replace(',', '')
    s = " ".join(s.split())
    return s


def upsert_client(account_id: str, named_insured: str) -> str:
    """
    Upsert a client purely by account_id and named_insured.
    Returns client.id
    """
    if not named_insured:
        raise ValueError("named_insured is required to upsert client")

    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Check existing
    existing = (
        sb.table("clients")
        .select("id")
        .eq("created_by_account_id", account_id)
        .eq("named_insured", named_insured)
        .limit(1)
        .execute()
    )

    if existing.data:
        client_id = existing.data[0]["id"]
        # Touch updated_at perhaps, or just return id
        sb.table("clients").update({"updated_at": now_iso}).eq("id", client_id).execute()
        return client_id

    # Insert
    payload = {
        "created_by_account_id": account_id,
        "named_insured": named_insured,
    }
    result = sb.table("clients").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Failed to insert client")
    return result.data[0]["id"]


def upsert_policy(client_id: str, account_id: str, policy_number: str, property_address: str | None) -> str:
    """
    Upsert a policy by policy_number + normalized property_address.
    Returns policy.id
    """
    if not policy_number:
        raise ValueError("policy_number is required to upsert policy")

    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    norm_address = normalize_address(property_address)

    # Note: policy uniqueness is usually by policy_number and carrier, but for MVP
    # we use policy_number + property_address_norm as per the NextJS implementation logic.
    query = sb.table("policies").select("id").eq("policy_number", policy_number)
    
    # We must match normalized address exactly as well, or if empty, just check policy_number
    # It's cleaner to query just by policy_number and filter in Python for now.
    existing_result = query.execute()
    
    found_id = None
    if existing_result.data:
        for row in existing_result.data:
            # We need to fetch full row to check norm address if multiple
            # For robustness, we can just do a multi-field DB query:
            pass
            
    # Refined DB query:
    existing_query = sb.table("policies").select("id").eq("policy_number", policy_number)
    if norm_address:
         existing_query = existing_query.eq("property_address_norm", norm_address)
    else:
         existing_query = existing_query.is_("property_address_norm", "null")
         
    existing = existing_query.limit(1).execute()

    payload = {
        "client_id": client_id,
        "created_by_account_id": account_id,
        "policy_number": policy_number,
        "property_address_raw": property_address,
        "property_address_norm": norm_address,
        "carrier_name": "California FAIR Plan", # Hardcoding for FAIR Plan MVP
        "updated_at": now_iso
    }

    if existing.data:
        policy_id = existing.data[0]["id"]
        sb.table("policies").update(payload).eq("id", policy_id).execute()
        return policy_id

    # Insert
    result = sb.table("policies").insert(payload).execute()
    if not result.data:
        raise RuntimeError(f"Failed to insert policy {policy_number}")
    return result.data[0]["id"]


def _manage_is_current(sb, policy_id: str, new_term_id: str):
    """Ensure only the most recent term by expiration_date is flagged is_current=True."""
    # Fetch all terms for policy
    terms = sb.table("policy_terms").select("id, expiration_date").eq("policy_id", policy_id).execute()
    if not terms.data:
        return
        
    # Sort descending by expiration_date (nulls last)
    def _sort_key(t):
        if not t.get("expiration_date"):
            return "0000-00-00"
        return t["expiration_date"]
        
    sorted_terms = sorted(terms.data, key=_sort_key, reverse=True)
    current_term_id = sorted_terms[0]["id"]
    
    # Update current term
    sb.table("policy_terms").update({"is_current": True}).eq("id", current_term_id).execute()
    
    # Clear others
    other_ids = [t["id"] for t in sorted_terms if t["id"] != current_term_id]
    if other_ids:
        for chunk in [other_ids[i:i + 100] for i in range(0, len(other_ids), 100)]:
            sb.table("policy_terms").update({"is_current": False}).in_("id", chunk).execute()


def upsert_policy_term(policy_id: str, effective_date: str | None, expiration_date: str | None) -> str:
    """
    Upsert a policy_term by policy_id + dates.
    Sets is_current flags appropriately.
    """
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Query for exact term
    query = sb.table("policy_terms").select("id").eq("policy_id", policy_id)
    if effective_date:
        query = query.eq("effective_date", effective_date)
    else:
        query = query.is_("effective_date", "null")
        
    if expiration_date:
        query = query.eq("expiration_date", expiration_date)
    else:
        query = query.is_("expiration_date", "null")
        
    existing = query.limit(1).execute()

    payload = {
        "policy_id": policy_id,
        "effective_date": effective_date,
        "expiration_date": expiration_date,
        "updated_at": now_iso
    }

    if existing.data:
        term_id = existing.data[0]["id"]
        sb.table("policy_terms").update(payload).eq("id", term_id).execute()
    else:
        result = sb.table("policy_terms").insert(payload).execute()
        if not result.data:
            raise RuntimeError(f"Failed to insert policy_term for {policy_id}")
        term_id = result.data[0]["id"]

    # Fix is_current logic across all terms for this policy
    _manage_is_current(sb, policy_id, term_id)
    return term_id


def process_lifecycle(
    account_id: str,
    extracted_data: dict
) -> dict:
    """
    Processes the lifecycle inserts/updates from the parsed dictionary.
    Returns a mapping of the generated IDs.
    """
    insured_name = extracted_data.get("insured_name")
    if insured_name:
        insured_name = insured_name.strip().title()
    policy_number = extracted_data.get("policy_number")
    property_location = extracted_data.get("property_location")
    eff_date = extracted_data.get("policy_period_start")
    exp_date = extracted_data.get("policy_period_end")

    result_ids = {}

    # Must have at minimum a policy_number to do lifecycle
    if not policy_number:
        logger.warning("Missing policy_number — cannot run lifecycle upsert.")
        return result_ids

    # Use a fallback for missing insured name so we still create the policy
    if not insured_name:
        insured_name = "Unknown Insured"
        logger.warning("Missing insured_name, using fallback: '%s'", insured_name)

    # 1. Client
    try:
        client_id = upsert_client(account_id, insured_name)
        result_ids["client_id"] = client_id
        
        # 2. Policy
        policy_id = upsert_policy(client_id, account_id, policy_number, property_location)
        result_ids["policy_id"] = policy_id
        
        # 3. Term
        term_id = upsert_policy_term(policy_id, eff_date, exp_date)
        result_ids["policy_term_id"] = term_id
        
        logger.info("Successfully processed lifecycle for policy %s", policy_number)
        
    except Exception as e:
        logger.error("Error during lifecycle upsert: %s", e)
        raise e

    return result_ids
