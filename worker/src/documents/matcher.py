"""
Policy matching engine for RCE and DIC documents.

Matches documents to existing policies using Owner Name + Property Address.
Unlike dec pages (which use policy_number), these documents require fuzzy matching
with strict safety controls.

Matching hierarchy:
1. Exact normalized address + exact normalized name → AUTO-LINK
2. Exact normalized address + close name (>80%) → AUTO-LINK
3. Exact normalized address + no name match → NEEDS_REVIEW
4. Close address (>90%) + exact name → NEEDS_REVIEW
5. No address match → NO_MATCH
6. Multiple address matches → NEEDS_REVIEW
"""

import logging
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import TypedDict

from ..supabase_client import get_supabase

logger = logging.getLogger("worker.documents.matcher")


# ── Normalization ────────────────────────────────────────────────────────────

# Common street abbreviation expansions
STREET_ABBREVS = {
    "ST": "STREET", "ST.": "STREET",
    "AVE": "AVENUE", "AVE.": "AVENUE",
    "BLVD": "BOULEVARD", "BLVD.": "BOULEVARD",
    "DR": "DRIVE", "DR.": "DRIVE",
    "LN": "LANE", "LN.": "LANE",
    "CT": "COURT", "CT.": "COURT",
    "PL": "PLACE", "PL.": "PLACE",
    "RD": "ROAD", "RD.": "ROAD",
    "CIR": "CIRCLE", "CIR.": "CIRCLE",
    "HWY": "HIGHWAY", "HWY.": "HIGHWAY",
    "PKWY": "PARKWAY", "PKWY.": "PARKWAY",
    "WAY": "WAY",
}

# Name suffixes to strip for matching
NAME_SUFFIXES = {
    "LLC", "INC", "CORP", "CO", "LTD",
    "TRUST", "REVOCABLE", "IRREVOCABLE", "FAMILY",
    "JR", "SR", "II", "III", "IV",
    "ESTATE", "ESTATES",
}


def normalize_address(raw: str | None) -> str | None:
    """
    Normalize a property address for matching.
    
    Steps:
    - Uppercase
    - Remove punctuation (commas, periods, hashes)
    - Strip unit/apt/ste designators and their numbers
    - Expand common abbreviations
    - Collapse whitespace
    """
    if not raw or not raw.strip():
        return None

    s = raw.upper().strip()

    # Remove common punctuation
    s = s.replace(",", "").replace(".", "").replace("#", "").replace("'", "")

    # Strip unit/apt/ste and following number
    s = re.sub(r"\b(UNIT|APT|STE|SUITE|APARTMENT|BLDG|BUILDING)\s*\w*", "", s)

    # Expand abbreviations
    words = s.split()
    expanded = []
    for w in words:
        expanded.append(STREET_ABBREVS.get(w, w))
    s = " ".join(expanded)

    # Collapse whitespace
    s = " ".join(s.split())

    return s if s else None


def normalize_name(raw: str | None) -> str | None:
    """
    Normalize an owner/insured name for matching.
    
    Steps:
    - Uppercase
    - Remove punctuation
    - Strip legal/name suffixes (LLC, TRUST, JR, etc.)
    - Collapse whitespace
    """
    if not raw or not raw.strip():
        return None

    s = raw.upper().strip()

    # Remove punctuation
    s = re.sub(r"[.,\-'\"()]", " ", s)

    # Strip known suffixes
    words = s.split()
    filtered = [w for w in words if w not in NAME_SUFFIXES]
    s = " ".join(filtered)

    # Collapse whitespace
    s = " ".join(s.split())

    return s if s else None


def _similarity(a: str, b: str) -> float:
    """Compute normalized similarity ratio (0.0-1.0) between two strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


# ── Match Result Types ───────────────────────────────────────────────────────

class MatchCandidate(TypedDict):
    policy_id: str
    client_id: str | None
    named_insured: str | None
    property_address_norm: str | None
    address_similarity: float
    name_similarity: float


class MatchLogEntry(TypedDict):
    step: str
    candidates_found: int
    result: str
    reason: str
    details: dict
    timestamp: str


class MatchResult(TypedDict):
    status: str   # "matched" | "needs_review" | "no_match"
    policy_id: str | None
    client_id: str | None
    policy_term_id: str | None
    confidence: float
    match_log: list[MatchLogEntry]
    review_reason: str | None
    action_items: list[str]


# ── Main Matching Function ───────────────────────────────────────────────────

def match_document_to_policy(
    extracted_owner_name: str | None,
    extracted_address: str | None,
    account_id: str,
) -> MatchResult:
    """
    Attempt to match a document to an existing policy using owner name + address.
    
    Returns a MatchResult with:
    - status: "matched" (safe to auto-link), "needs_review" (agent must decide),
              or "no_match" (no candidates found)
    - policy_id / client_id / policy_term_id: populated if matched
    - confidence: 0.0 - 1.0
    - match_log: detailed audit trail of every decision step
    - review_reason: human-readable explanation if needs_review
    - action_items: list of suggested actions for the agent
    """
    match_log: list[MatchLogEntry] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    
    def log_step(step: str, result: str, reason: str, details: dict | None = None):
        entry: MatchLogEntry = {
            "step": step,
            "candidates_found": 0,
            "result": result,
            "reason": reason,
            "details": details or {},
            "timestamp": now_iso,
        }
        match_log.append(entry)
        logger.info("Match step=%s result=%s reason=%s", step, result, reason)

    # Normalize inputs
    norm_address = normalize_address(extracted_address)
    norm_name = normalize_name(extracted_owner_name)

    if not norm_address:
        log_step("validate_inputs", "no_match", "No address extracted from document")
        return MatchResult(
            status="no_match",
            policy_id=None, client_id=None, policy_term_id=None,
            confidence=0.0,
            match_log=match_log,
            review_reason="No property address could be extracted from this document.",
            action_items=[
                "Manually search for the correct policy and link this document.",
                "Verify the uploaded document is readable and contains an address.",
            ],
        )

    if not norm_name:
        log_step("validate_inputs", "warning", "No owner name extracted — matching on address only")

    # Query policies by normalized address
    sb = get_supabase()
    
    try:
        result = (
            sb.table("policies")
            .select("id, client_id, policy_number, property_address_norm, property_address_raw")
            .eq("property_address_norm", norm_address)
            .execute()
        )
        exact_candidates = result.data or []
    except Exception as e:
        log_step("query_policies_exact", "error", f"Database query failed: {e}")
        return MatchResult(
            status="needs_review",
            policy_id=None, client_id=None, policy_term_id=None,
            confidence=0.0,
            match_log=match_log,
            review_reason=f"Database error during matching: {e}",
            action_items=["Retry the match or manually link this document to a policy."],
        )

    log_step(
        "query_address_exact",
        "found" if exact_candidates else "empty",
        f"Found {len(exact_candidates)} exact address match(es) for: {norm_address}",
        {"candidates": len(exact_candidates), "query_address": norm_address},
    )

    if not exact_candidates:
        # Try fuzzy address match — query all policies for this account and score
        try:
            all_policies = (
                sb.table("policies")
                .select("id, client_id, policy_number, property_address_norm, property_address_raw")
                .not_.is_("property_address_norm", "null")
                .execute()
            )
            fuzzy_candidates = []
            for p in (all_policies.data or []):
                sim = _similarity(norm_address, p.get("property_address_norm", ""))
                if sim >= 0.85:
                    fuzzy_candidates.append({**p, "_addr_sim": sim})
            
            fuzzy_candidates.sort(key=lambda x: x["_addr_sim"], reverse=True)
        except Exception as e:
            logger.error("Fuzzy address query failed: %s", e)
            fuzzy_candidates = []

        if fuzzy_candidates:
            log_step(
                "query_address_fuzzy",
                "needs_review",
                f"No exact address match, but found {len(fuzzy_candidates)} close match(es)",
                {
                    "top_candidate": fuzzy_candidates[0].get("property_address_norm"),
                    "top_similarity": round(fuzzy_candidates[0]["_addr_sim"], 3),
                },
            )
            return MatchResult(
                status="needs_review",
                policy_id=fuzzy_candidates[0]["id"],
                client_id=fuzzy_candidates[0].get("client_id"),
                policy_term_id=None,
                confidence=round(fuzzy_candidates[0]["_addr_sim"] * 0.5, 2),
                match_log=match_log,
                review_reason=(
                    f"Address is close but not exact. "
                    f"Document: '{extracted_address}' → "
                    f"Closest policy: '{fuzzy_candidates[0].get('property_address_raw')}' "
                    f"({round(fuzzy_candidates[0]['_addr_sim'] * 100)}% match)"
                ),
                action_items=[
                    f"Review: Is this the correct policy? (Policy #{fuzzy_candidates[0].get('policy_number', 'unknown')})",
                    "Search for the correct policy and link manually if this is wrong.",
                    "Create a new client/policy if this property doesn't exist in the system yet.",
                ],
            )

        log_step("query_address_fuzzy", "no_match", "No close address matches found either")
        return MatchResult(
            status="no_match",
            policy_id=None, client_id=None, policy_term_id=None,
            confidence=0.0,
            match_log=match_log,
            review_reason=(
                f"No policy found with address matching '{extracted_address}'. "
                f"This property may not be in the system yet."
            ),
            action_items=[
                "Search for the correct policy by name or address and link this document.",
                "If this is a new property, consider creating a new client/policy record.",
            ],
        )

    # We have exact address match(es). Now check owner name.
    if len(exact_candidates) > 1:
        # Multiple policies at the same address — need name to disambiguate
        if not norm_name:
            log_step(
                "multiple_address_no_name",
                "needs_review",
                f"Multiple policies ({len(exact_candidates)}) at this address, and no owner name to disambiguate",
            )
            return MatchResult(
                status="needs_review",
                policy_id=None, client_id=None, policy_term_id=None,
                confidence=0.3,
                match_log=match_log,
                review_reason=(
                    f"Found {len(exact_candidates)} policies at '{extracted_address}' "
                    f"but could not extract an owner name to determine which one."
                ),
                action_items=[
                    f"Choose from {len(exact_candidates)} policies at this address.",
                    "Review the document to identify the correct policy holder.",
                ],
            )

    # Score name similarity for each candidate
    scored: list[MatchCandidate] = []
    for cand in exact_candidates:
        client_id = cand.get("client_id")
        named_insured = None

        # Fetch the client's named_insured for name comparison
        if client_id:
            try:
                client_result = (
                    sb.table("clients")
                    .select("named_insured")
                    .eq("id", client_id)
                    .limit(1)
                    .execute()
                )
                if client_result.data:
                    named_insured = client_result.data[0].get("named_insured")
            except Exception as e:
                logger.warning("Failed to fetch client %s: %s", client_id, e)

        name_sim = 0.0
        if norm_name and named_insured:
            norm_existing = normalize_name(named_insured)
            if norm_existing:
                name_sim = _similarity(norm_name, norm_existing)

        scored.append(MatchCandidate(
            policy_id=cand["id"],
            client_id=client_id,
            named_insured=named_insured,
            property_address_norm=cand.get("property_address_norm"),
            address_similarity=1.0,
            name_similarity=round(name_sim, 3),
        ))

    # Sort by name similarity descending
    scored.sort(key=lambda x: x["name_similarity"], reverse=True)
    best = scored[0]

    log_step(
        "name_scoring",
        "scored",
        f"Best name match: {best['name_similarity']:.1%} "
        f"('{norm_name}' vs '{best.get('named_insured')}')",
        {
            "extracted_name": extracted_owner_name,
            "normalized_name": norm_name,
            "best_insured": best.get("named_insured"),
            "best_similarity": best["name_similarity"],
            "candidates_scored": len(scored),
        },
    )

    # Resolve current term for the matched policy
    policy_term_id = None
    if best["policy_id"]:
        try:
            term_result = (
                sb.table("policy_terms")
                .select("id")
                .eq("policy_id", best["policy_id"])
                .eq("is_current", True)
                .limit(1)
                .execute()
            )
            if term_result.data:
                policy_term_id = term_result.data[0]["id"]
        except Exception as e:
            logger.warning("Failed to fetch current term: %s", e)

    # Decision
    if not norm_name:
        # Only one address match, no name to compare
        if len(exact_candidates) == 1:
            log_step("decision", "matched", "Single address match, no name to compare — auto-linking")
            return MatchResult(
                status="matched",
                policy_id=best["policy_id"],
                client_id=best["client_id"],
                policy_term_id=policy_term_id,
                confidence=0.7,
                match_log=match_log,
                review_reason=None,
                action_items=[],
            )

    if best["name_similarity"] >= 0.80:
        # Good match
        log_step(
            "decision", "matched",
            f"Address exact + name {best['name_similarity']:.0%} match → auto-linked",
        )
        return MatchResult(
            status="matched",
            policy_id=best["policy_id"],
            client_id=best["client_id"],
            policy_term_id=policy_term_id,
            confidence=round((1.0 + best["name_similarity"]) / 2, 2),
            match_log=match_log,
            review_reason=None,
            action_items=[],
        )

    if best["name_similarity"] >= 0.50:
        # Partial name match — needs review
        log_step(
            "decision", "needs_review",
            f"Address exact but name only {best['name_similarity']:.0%} match",
        )
        return MatchResult(
            status="needs_review",
            policy_id=best["policy_id"],
            client_id=best["client_id"],
            policy_term_id=policy_term_id,
            confidence=round(best["name_similarity"] * 0.6, 2),
            match_log=match_log,
            review_reason=(
                f"Address matched exactly, but the owner name doesn't fully match. "
                f"Document: '{extracted_owner_name}' — "
                f"Policy: '{best.get('named_insured')}' "
                f"({best['name_similarity']:.0%} similar)"
            ),
            action_items=[
                "Confirm this is the correct policy (name may differ due to formatting or legal entity).",
                "If wrong, search for the correct policy and link manually.",
            ],
        )

    # Address matches but name is very different
    log_step(
        "decision", "needs_review",
        f"Address exact but name mismatch ({best['name_similarity']:.0%})",
    )
    return MatchResult(
        status="needs_review",
        policy_id=best["policy_id"],
        client_id=best["client_id"],
        policy_term_id=policy_term_id,
        confidence=0.3,
        match_log=match_log,
        review_reason=(
            f"Address matched but the owner name is significantly different. "
            f"Document: '{extracted_owner_name}' — "
            f"Policy: '{best.get('named_insured')}'. "
            f"This may be a different owner at the same address."
        ),
        action_items=[
            "Verify if this is a new owner or a name formatting difference.",
            "If wrong policy, search for the correct one and link manually.",
            "If new owner, you may need to update the client record.",
        ],
    )
