"""Dump raw text and extracted fields from dec_pages."""
import os, sys
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

result = sb.table("dec_pages").select("id, submission_id, raw_text, insured_name, policy_number, property_location, policy_period_start, policy_period_end, parse_status, extracted_json, missing_fields").order("extracted_at", desc=True).limit(5).execute()

for i, d in enumerate(result.data or []):
    print(f"{'='*80}")
    print(f"DEC PAGE #{i+1}: {d['id']}")
    print(f"  parse_status:  {d.get('parse_status')}")
    print(f"  insured_name:  {d.get('insured_name')}")
    print(f"  policy_number: {d.get('policy_number')}")
    print(f"  property_loc:  {d.get('property_location')}")
    print(f"  period_start:  {d.get('policy_period_start')}")
    print(f"  period_end:    {d.get('policy_period_end')}")
    print(f"  missing:       {d.get('missing_fields')}")
    print(f"  extracted_json: {d.get('extracted_json')}")
    raw = d.get('raw_text', '') or ''
    print(f"\n  RAW TEXT ({len(raw)} chars):")
    print(f"  {'-'*70}")
    for line in raw[:3000].split('\n'):
        print(f"  | {line}")
    if len(raw) > 3000:
        print(f"  | ... ({len(raw) - 3000} more chars)")
    print()
