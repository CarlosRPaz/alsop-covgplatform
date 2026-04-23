import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

# Check the stuck job
r = sb.table('ingestion_jobs').select('*').eq('document_id', 'b118b5ef-fe8e-4dff-a7b3-8ce5c62c5e5d').execute()
for j in r.data:
    print("=== Job ===")
    for k, v in j.items():
        if v is not None:
            print(f"  {k}: {v}")
