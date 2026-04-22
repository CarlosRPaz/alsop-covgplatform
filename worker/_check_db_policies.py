import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

print("--- Searching for Wendy Paolini ---")
r = sb.table('policies').select('id, policy_number, property_address_raw, status').ilike('property_address_raw', '%LAPIS%').execute()
print("By Address (LAPIS):", r.data)

r2 = sb.table('clients').select('id, named_insured').ilike('named_insured', '%PAOLINI%').execute()
print("By Client Name (PAOLINI):", r2.data)

r2b = sb.table('clients').select('id, named_insured').ilike('named_insured', '%LAURA%').execute()
print("By Client Name (LAURA):", r2b.data)

print("\n--- Searching for Adrian Chavez ---")
r3 = sb.table('policies').select('id, policy_number, property_address_raw, status').ilike('property_address_raw', '%Sugarloaf%').execute()
print("By Address (Sugarloaf):", r3.data)

r4 = sb.table('clients').select('id, named_insured').ilike('named_insured', '%Chavez%').execute()
print("By Client Name (Chavez):", r4.data)
