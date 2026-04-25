import sys, os
sys.path.insert(0, '.')
os.environ.setdefault('SUPABASE_URL', 'https://qbihizqbtimwvhxkneeb.supabase.co')
try:
    os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', open('../.env.local').read().split('SUPABASE_SERVICE_ROLE_KEY=')[1].split('\n')[0].strip())
except Exception:
    pass

from src.supabase_client import get_supabase
sb = get_supabase()

print("--- dec_page_submissions ---")
res = sb.table('dec_page_submissions').select('id, status, processing_step, error_message, last_name').order('created_at', desc=True).limit(5).execute()
for r in res.data:
    print(r)

print("\n--- ingestion_jobs ---")
res2 = sb.table('ingestion_jobs').select('id, status, run_after, submission_id, document_id').order('created_at', desc=True).limit(5).execute()
for r in res2.data:
    print(r)

print("\n--- platform_documents ---")
res3 = sb.table('platform_documents').select('id, parse_status, processing_step').order('created_at', desc=True).limit(5).execute()
for r in res3.data:
    print(r)
