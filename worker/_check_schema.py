import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

print("--- Policies Schema ---")
r = sb.table('policies').select('*').limit(1).execute()
if r.data:
    print(r.data[0].keys())

print("\n--- Clients Schema ---")
r2 = sb.table('clients').select('*').limit(1).execute()
if r2.data:
    print(r2.data[0].keys())
