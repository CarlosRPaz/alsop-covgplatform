import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

# Check ingestion_jobs schema by trying to insert a test row
# First let's see what columns are required
doc_id = '80b5ffeb-b6b2-46e9-b29d-3328591ae4f7'
account_id = 'b2536e25-b885-4fec-9272-e2c37bbfea8b'  # from the existing data

try:
    r = sb.table('ingestion_jobs').insert({
        'document_id': doc_id,
        'account_id': account_id,
        'status': 'queued',
        'attempts': 0,
        'max_attempts': 5,
    }).execute()
    print("SUCCESS:", r.data)
except Exception as e:
    print("ERROR:", e)
