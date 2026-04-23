import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv()

from src.supabase_client import get_supabase

def check_schema():
    sb = get_supabase()
    
    print("--- Policy Terms Schema ---")
    res = sb.table("policy_terms").select("*").limit(1).execute()
    if res.data:
        print(res.data[0].keys())
    else:
        print("No rows found")

if __name__ == "__main__":
    check_schema()
