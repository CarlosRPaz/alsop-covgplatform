"""Test LLM extraction on existing dec pages to verify accuracy."""
import os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

# Import the LLM extractor directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.extract.llm_extract import extract_with_llm

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Grab dec pages that have raw_text
result = sb.table("dec_pages").select("id, raw_text, insured_name, policy_number").order("extracted_at", desc=True).limit(3).execute()

for i, d in enumerate(result.data or []):
    raw = d.get("raw_text", "") or ""
    if not raw:
        print(f"#{i+1}: No raw text, skipping")
        continue

    print(f"{'='*80}")
    print(f"DEC PAGE #{i+1}: {d['id']}")
    print(f"  REGEX extracted: insured={d.get('insured_name')}  policy={d.get('policy_number')}")
    print(f"  Raw text length: {len(raw)} chars")
    print(f"  Sending to LLM...")

    llm_result = extract_with_llm(raw)
    if llm_result:
        ed = llm_result["extracted_data"]
        print(f"  LLM RESULT:")
        print(f"    is_fair_plan:    {llm_result['is_fair_plan']}")
        print(f"    parse_status:    {llm_result['parse_status']}")
        print(f"    missing_fields:  {llm_result['missing_fields']}")
        print(f"    --- Extracted Fields ---")
        for k, v in sorted(ed.items()):
            if v is not None:
                print(f"    {k:<30} = {v}")
    else:
        print(f"  LLM extraction FAILED")
    print()
