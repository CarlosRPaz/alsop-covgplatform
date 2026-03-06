"""
LLM-powered declaration page field extraction using OpenAI GPT-4o-mini.

Sends trimmed raw text to GPT-4o-mini with a structured prompt based on
the CFP extraction ruleset. Returns JSON with all declaration fields.
Falls back to regex parser if the LLM call fails.

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
MAX_TEXT_CHARS = 8000

# Fields critical for the pipeline lifecycle (client + policy creation)
LIFECYCLE_FIELDS = ["insured_name", "policy_number"]

SYSTEM_PROMPT = """You are an expert system designed to extract structured data from a California FAIR Plan (CFP) insurance declaration page.

You will receive raw OCR or extracted PDF text.
Extract ONLY information explicitly found in the text.
If a value is missing, ambiguous, unreadable, or not explicitly shown, return null.

DO NOT infer, guess, approximate, calculate, summarize, or fabricate.

Return ONLY valid JSON.
No comments, no markdown, no explanations.

============================================
FIELDS TO EXTRACT
============================================

{
    "insured_name": "",
    "secondary_insured_name": "",
    "mailing_address": "",
    "property_location": "",
    "policy_number": "",
    "date_issued": "",
    "policy_period_start": "",
    "policy_period_end": "",
    "year_built": "",
    "occupancy": "",
    "number_of_units": "",
    "construction_type": "",
    "deductible": "",
    "limit_dwelling": "",
    "limit_other_structures": "",
    "limit_personal_property": "",
    "limit_fair_rental_value": "",
    "limit_ordinance_or_law": "",
    "limit_debris_removal": "",
    "limit_extended_dwelling_coverage": "",
    "limit_dwelling_replacement_cost": "",
    "limit_inflation_guard": "",
    "limit_personal_property_replacement_cost": "",
    "limit_fences": "",
    "limit_permitted_incidental_occupancy": "",
    "limit_plants_shrubs_trees": "",
    "limit_outdoor_radio_tv_equipment": "",
    "limit_awnings": "",
    "limit_signs": "",
    "limit_actual_cash_value_coverage": "",
    "limit_replacement_cost_coverage": "",
    "limit_building_code_upgrade_coverage": "",
    "cb_fire_lightning_smoke_damage": false,
    "cb_extended_coverages": false,
    "cb_vandalism_malicious_mischief": false,
    "total_annual_premium": "",
    "broker_name": "",
    "broker_address": "",
    "broker_phone_number": "",
    "mortgagee_1_name": "",
    "mortgagee_1_address": "",
    "mortgagee_1_code": "",
    "mortgagee_2_name": "",
    "mortgagee_2_address": "",
    "mortgagee_2_code": ""
}

============================================
EXTRACTION RULES
============================================

1. INSURED NAMES
   - Extract exactly as printed.
   - If a secondary spouse/partner name appears on a separate line, extract as secondary_insured_name.

2. MAILING ADDRESS
   - Extract exactly the address associated with the insured's mailing information.

3. PROPERTY LOCATION
   - Must match label: "PROPERTY LOCATION"
   - Return formatting exactly as printed.

4. POLICY NUMBER
   - CFP policy numbers often appear split (e.g. "CFP", middle digits, last 2 digits).
   - Combine the full policy number exactly as printed.

5. POLICY PERIOD & DATE ISSUED
   - Extract exact dates in YYYY-MM-DD format. Do NOT infer.

6. STRUCTURAL INFORMATION
   - year_built: must be explicit 4-digit year.
   - occupancy: return exactly the text that appears.
   - construction_type: return exactly how CFP prints it.
   - number_of_units: numeric or text exactly as printed.
     - Must match label: "# OF UNITS"

7. COVERAGES, LIMITS, PERILS AND PREMIUMS
   - Extract the dollar amount or string EXACTLY as printed.
     Example: "$250,000", "Included", "N/A", "$0", "Not Covered".
   - If no limit exists, return null.
   - Coverage fields with specific label matching:
     - limit_actual_cash_value_coverage must match label: "ACTUAL CASH VALUE COVERAGE"
     - limit_replacement_cost_coverage must match label: "REPLACEMENT COST COVERAGE"
     - limit_building_code_upgrade_coverage must match label: "BUILDING CODE UPGRADE COVERAGE"

8. CHECKBOXES
   - Determine true/false from actual checkmarks.
     Acceptable indicators: X, checkmark symbols, filled boxes.
   - false if unchecked or unclear.

9. MORTGAGEES
   - Extract up to two: name, address, code.
   - If only one exists, leave second mortgagee fields null.

10. GENERAL RULES
    - Preserve exact formatting of: dates, addresses, dollar amounts, policy numbers, coverage descriptions.
    - Never infer missing values.
    - Return null for anything not explicitly shown."""


def _build_user_prompt(raw_text: str) -> str:
    """Build the user prompt with trimmed text."""
    trimmed = raw_text[:MAX_TEXT_CHARS]
    return f"""NOW PARSE THE TEXT BELOW AND RETURN ONLY VALID JSON:

============================================
{trimmed}
============================================"""


def extract_with_llm(raw_text: str) -> dict | None:
    """
    Extract declaration fields from raw text using OpenAI GPT-4o-mini.

    Returns a dict:
    {{
        "is_fair_plan": bool,
        "extracted_data": dict,
        "missing_fields": list[str],
        "parse_status": str  # "parsed" | "needs_review"
    }}

    Returns None if the LLM call fails (caller should fall back to regex).
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set -- skipping LLM extraction")
        return None

    try:
        client = OpenAI(api_key=api_key)

        logger.info(
            "Sending %d chars to GPT-4o-mini for extraction",
            min(len(raw_text), MAX_TEXT_CHARS),
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(raw_text)},
            ],
            temperature=0.0,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            logger.error("LLM returned empty content")
            return None

        extracted: dict[str, Any] = json.loads(content)

        # Normalize: convert empty strings to None (keep booleans as-is)
        for key in extracted:
            if isinstance(extracted[key], str) and (
                extracted[key] == "" or extracted[key].lower() == "null"
            ):
                extracted[key] = None

        # Determine if it's a FAIR Plan doc from the text
        upper_text = raw_text[:MAX_TEXT_CHARS].upper()
        is_fair_plan = (
            "FAIR PLAN" in upper_text
            or "CALIFORNIA FAIR PLAN" in upper_text
            or "CFP" in (extracted.get("policy_number") or "").upper()
        )

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
