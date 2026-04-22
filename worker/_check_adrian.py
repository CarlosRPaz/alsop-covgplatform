import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

print("\n--- Adrian Chavez Policies ---")
r = sb.table('policies').select('id, policy_number, property_address_raw, status').eq('client_id', 'd5153834-899f-4bbe-b6a6-0db3c46f86f2').execute()
print(r.data)
