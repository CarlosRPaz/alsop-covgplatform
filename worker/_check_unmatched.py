import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

print("--- Unmatched Documents ---")
r = sb.table('platform_documents').select('file_name, extracted_owner_name, extracted_address, match_log').eq('match_status', 'no_match').order('created_at', desc=True).limit(5).execute()

for d in r.data:
    print(f"\nFile: {d['file_name']}")
    print(f"Extracted Owner Name: {d['extracted_owner_name']}")
    print(f"Extracted Address: {d['extracted_address']}")
    print("Match Log:")
    if d['match_log']:
        for log in d['match_log']:
            print(f"  - Step: {log.get('step')}")
            print(f"    Result: {log.get('result')}")
    else:
        print("  None")
    print("-" * 40)
