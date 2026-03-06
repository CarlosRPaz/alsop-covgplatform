"""
LLM-powered declaration page field extraction using OpenAI GPT-4o-mini.

Sends trimmed raw text to GPT-4o-mini with a structured prompt,
receives JSON with all declaration fields. Falls back to regex parser
if the LLM call fails.

Cost: ~$0.01-0.03 per dec page (4o-mini pricing).
"""

import json
import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger("worker.extract.llm_extract")

# How many chars of raw text to send to the LLM.
# Dec page fields are always in the first few pages; the rest is boilerplate.
MAX_TEXT_CHARS = 6000

# Fields we ask the LLM to extract
EXTRACTION_SCHEMA = {
    "insured_name": "Primary named insured (person or company name)",
    "secondary_insured_name": "Co-insured or secondary named insured, if any",
    "mailing_address": "Mailing address of the insured",
    "property_location": "Address of the insured property (may differ from mailing address)",
    "policy_number": "Policy number (e.g. CFP 0101772837)",
    "policy_period_start": "Policy effective date in YYYY-MM-DD format",
    "policy_period_end": "Policy expiration date in YYYY-MM-DD format",
    "year_built": "Year the property was built (4-digit year)",
    "construction_type": "Construction type (e.g. Frame, Masonry, etc.)",
    "occupancy": "Occupancy type (e.g. Owner-occupied, Tenant, Vacant)",
    "number_of_units": "Number of units in the property",
    "deductible": "Deductible amount as a number (no $ sign, no commas)",
    "total_annual_premium": "Total annual premium as a number (no $ sign, no commas)",
    "carrier_name": "Insurance carrier/company name",
    "broker_name": "Insurance broker/agent name",
    "broker_address": "Broker/agent office address",
    "broker_phone_number": "Broker/agent phone number",
    "limit_dwelling": "Coverage A - Dwelling limit as a number",
    "limit_personal_property": "Coverage C - Personal Property limit as a number",
    "limit_other_structures": "Coverage B - Other Structures limit as a number",
    "limit_loss_of_use": "Coverage D - Loss of Use limit as a number",
    "limit_liability": "Coverage E - Liability limit as a number",
    "limit_medical": "Coverage F - Medical Payments limit as a number",
}

LIFECYCLE_FIELDS = ["insured_name", "policy_number"]

SYSTEM_PROMPT = """You are an expert insurance document parser. You extract structured data from declaration pages of insurance policies.

You will receive raw text extracted from a PDF declaration page. Extract the requested fields and return them as a JSON object.

Rules:
1. Return ONLY a valid JSON object, no markdown, no explanation.
2. Use null for any field you cannot find or are unsure about.
3. For dates, use YYYY-MM-DD format.
4. For dollar amounts, return just the number (no $ sign, no commas). Example: 250000 not $250,000.
5. For policy numbers, preserve the exact format from the document (e.g. "CFP 0101772837").
6. The insured name is typically a person's name (e.g. "JOHN SMITH") — do NOT extract legal text, exclusion language, or any other non-name text.
7. The property location is the physical address of the insured property, which may differ from the mailing address.
8. If you see "NAMED INSURED AND MAILING ADDRESS" or similar headers, the name directly below it is the insured name.
"""


def _build_user_prompt(raw_text: str) -> str:
    """Build the user prompt with trimmed text and field descriptions."""
    trimmed = raw_text[:MAX_TEXT_CHARS]

    fields_desc = "\n".join(f"  - {k}: {v}" for k, v in EXTRACTION_SCHEMA.items())

    return f"""Extract the following fields from this insurance declaration page text.
Return a JSON object with these keys (use null if not found):

{fields_desc}

---
DECLARATION PAGE TEXT:
{trimmed}
---

Return ONLY the JSON object."""


def extract_with_llm(raw_text: str) -> dict | None:
    """
    Extract declaration fields from raw text using OpenAI GPT-4o-mini.

    Returns a dict in the same format as fair_plan.parse_declaration():
    {
        "is_fair_plan": bool,
        "extracted_data": dict,
        "missing_fields": list[str],
        "parse_status": str  # "parsed" | "needs_review"
    }

    Returns None if the LLM call fails (caller should fall back to regex).
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — skipping LLM extraction")
        return None

    try:
        client = OpenAI(api_key=api_key)

        logger.info("Sending %d chars to GPT-4o-mini for extraction", min(len(raw_text), MAX_TEXT_CHARS))

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(raw_text)},
            ],
            temperature=0.0,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            logger.error("LLM returned empty content")
            return None

        extracted: dict[str, Any] = json.loads(content)

        # Normalize: convert empty strings to None
        for key in extracted:
            if extracted[key] == "" or extracted[key] == "null":
                extracted[key] = None

        # Determine if it's a FAIR Plan doc
        carrier = (extracted.get("carrier_name") or "").upper()
        is_fair_plan = "FAIR PLAN" in carrier or "CFP" in carrier or "CALIFORNIA FAIR" in carrier

        # Also check from the raw text
        if not is_fair_plan:
            upper_text = raw_text[:MAX_TEXT_CHARS].upper()
            is_fair_plan = "FAIR PLAN" in upper_text or "CALIFORNIA FAIR PLAN" in upper_text

        # Determine missing lifecycle fields
        missing = [f for f in LIFECYCLE_FIELDS if not extracted.get(f)]

        # Determine parse status
        parse_status = "parsed" if not missing else "needs_review"

        logger.info(
            "LLM extraction complete. is_fair_plan=%s, insured=%s, policy=%s, missing=%s",
            is_fair_plan,
            extracted.get("insured_name"),
            extracted.get("policy_number"),
            missing,
        )

        return {
            "is_fair_plan": is_fair_plan,
            "extracted_data": extracted,
            "missing_fields": missing,
            "parse_status": parse_status,
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        return None
    except Exception as e:
        logger.error("LLM extraction failed: %s", e)
        return None
