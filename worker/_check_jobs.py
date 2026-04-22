import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from src.supabase_client import get_supabase
sb = get_supabase()

# Check if submission_id is still NOT NULL by trying to insert
try:
    r = sb.table('ingestion_jobs').insert({
        'document_id': '00000000-0000-0000-0000-000000000000',
        'account_id': '00000000-0000-0000-0000-000000000000',
        'status': 'queued',
        'attempts': 0,
        'max_attempts': 1,
    }).execute()
    print("submission_id IS nullable - insert worked:", r.data[0]['id'] if r.data else '?')
    # Clean up test row
    if r.data:
        sb.table('ingestion_jobs').delete().eq('id', r.data[0]['id']).execute()
        print("Cleaned up test row")
except Exception as e:
    if 'not-null' in str(e) and 'submission_id' in str(e):
        print("!!! submission_id is STILL NOT NULL - SQL fix has NOT been run!")
    else:
        print("Other error:", e)

# Check platform_documents
print("\n--- platform_documents ---")
r2 = sb.table('platform_documents').select('id,doc_type,file_name,parse_status,processing_step,match_status').order('created_at', desc=True).limit(5).execute()
for d in r2.data:
    print(d)

# Check ingestion_jobs with document_id
print("\n--- ingestion_jobs with document_id ---")
r3 = sb.table('ingestion_jobs').select('id,status,document_id,attempts').not_('document_id', 'is', 'null').order('created_at', desc=True).limit(5).execute()
for j in r3.data:
    print(j)
if not r3.data:
    print("(none)")
