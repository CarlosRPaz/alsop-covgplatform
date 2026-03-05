"""
FAIR Plan Declaration Parser.
Extracts basic fields from raw PDF text:
- insured_name
- policy_number
- property_location
- policy_period_start
- policy_period_end
"""

import logging
import re
from datetime import datetime

logger = logging.getLogger("worker.extract.fair_plan")

REQUIRED_FIELDS = [
    "insured_name",
    "policy_number",
    "property_location",
    "policy_period_start",
    "policy_period_end",
]

# Simple scoring to detect if it's a FAIR Plan doc
FAIR_PLAN_KEYWORDS = [
    "DWELLING INSURANCE POLICY DECLARATIONS",
    "POLICY PERIOD",
    "POLICY NUMBER",
    "CALIFORNIA FAIR PLAN",
]


def _clean_text(text: str) -> str:
    """Normalize whitespace and newlines."""
    # Replace multiple spaces with one
    text = re.sub(r'[ \t]+', ' ', text)
    # Ensure consistent newlines
    text = text.replace('\r\n', '\n')
    return text.strip()


def _parse_date(date_str: str) -> str | None:
    """Attempt to parse mm/dd/yyyy or similar into ISO date."""
    if not date_str:
        return None
    try:
        # 12/03/2024
        dt = datetime.strptime(date_str.strip(), "%m/%d/%Y")
        return dt.date().isoformat()
    except ValueError:
        try:
            # 12-03-2024
            dt = datetime.strptime(date_str.strip(), "%m-%d-%Y")
            return dt.date().isoformat()
        except ValueError:
            return None


def detect_fair_plan(raw_text: str) -> bool:
    """Score text to determine if it's a FAIR Plan declaration."""
    if not raw_text:
        return False
    
    score = sum(1 for kw in FAIR_PLAN_KEYWORDS if kw.lower() in raw_text.lower())
    # Require at least 2 keywords to match confidently
    return score >= 2


def parse_declaration(raw_text: str) -> dict:
    """
    Parse a FAIR Plan declaration page's text using RegEx.
    
    Returns standard extracted dictionary:
    {
        "is_fair_plan": bool,
        "extracted_data": dict,
        "missing_fields": list[str],
        "parse_status": str ("parsed" | "needs_review")
    }
    """
    if not detect_fair_plan(raw_text):
        logger.info("Text does not appear to be a FAIR Plan declaration.")
        return {
            "is_fair_plan": False,
            "extracted_data": {},
            "missing_fields": REQUIRED_FIELDS,
            "parse_status": "needs_review",
        }

    cleaned = _clean_text(raw_text)
    
    extracted = {
        "insured_name": None,
        "policy_number": None,
        "property_location": None,
        "policy_period_start": None,
        "policy_period_end": None,
    }

    # Policy Number
    # Often formatted as: "POLICY NUMBER: CFP 1234567" or "POLICY NUMBER CFP 1234567"
    policy_num_match = re.search(r'POLICY\s+NUMBER[:\s]+([A-Z0-9\s\-]+?)(?=\n|$|\s{2,})', cleaned, re.IGNORECASE)
    if policy_num_match:
        # Cleanup: sometimes it catches extra stuff if not cleanly delimited
        pnum = policy_num_match.group(1).strip()
        # Take only the first two tokens like "CFP 1234567" or just the number
        tokens = pnum.split()
        if len(tokens) >= 2 and tokens[0].upper() == "CFP":
            extracted["policy_number"] = f"{tokens[0]} {tokens[1]}"
        elif len(tokens) >= 1:
            extracted["policy_number"] = tokens[0]

    # Policy Period
    # "POLICY PERIOD: 12/03/2024 to 12/03/2025"
    # Matches: "12/03/2024" and "12/03/2025" or similar
    period_match = re.search(r'POLICY\s+PERIOD.*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}).*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})', cleaned, re.IGNORECASE)
    if period_match:
        extracted["policy_period_start"] = _parse_date(period_match.group(1))
        extracted["policy_period_end"] = _parse_date(period_match.group(2))

    # Insured Name & Property Location
    # Typically structured as blocks:
    # NAMED INSURED AND MAILING ADDRESS
    # JOHN DOE
    # 123 MAIN ST
    # CITY, CA 90000
    #
    # PROPERTY SUBJECT TO THIS INSURANCE
    # 456 OAK AVE
    # ANOTHER CITY, CA 90001
    
    # Try grabbing block for Insured
    insured_match = re.search(r'NAMED INSURED.*?MAILING ADDRESS[:\r\n]+(.*?)(?:\n\n|\r\n\r\n|POLICY|PROPERTY)', cleaned, re.IGNORECASE | re.DOTALL)
    if insured_match:
        lines = [line.strip() for line in insured_match.group(1).split('\n') if line.strip()]
        if lines:
            extracted["insured_name"] = lines[0] # Usually the first line after the header is the name

    # Try grabbing block for Property
    property_match = re.search(r'PROPERTY SUBJECT.*?INSURANCE[:\r\n]+(.*?)(?:\n\n|\r\n\r\n|COVERAGES)', cleaned, re.IGNORECASE | re.DOTALL)
    if property_match:
        lines = [line.strip() for line in property_match.group(1).split('\n') if line.strip()]
        if lines:
            # Combine lines for property address to keep it simple, or just use the first few
            # e.g. "456 OAK AVE, ANOTHER CITY, CA 90001"
            extracted["property_location"] = ", ".join(lines[:2]).strip()

    # Determine missing fields and status
    missing = [f for f in REQUIRED_FIELDS if not extracted.get(f)]
    
    # If we missed any required fields, it needs review
    status = "needs_review" if missing else "parsed"

    logger.info("Parsed FAIR Plan fields. Missing: %s, Status: %s", missing, status)

    return {
        "is_fair_plan": True,
        "extracted_data": extracted,
        "missing_fields": missing,
        "parse_status": status,
    }
