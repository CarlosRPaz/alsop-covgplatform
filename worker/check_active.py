from src.supabase_client import get_supabase
from datetime import datetime, timezone
sb = get_supabase()

now = datetime.now(timezone.utc).isoformat()

# Reset all queued jobs to run_after=now so worker picks them up immediately
r = sb.table('ingestion_jobs').select('id,status,run_after').eq('status','queued').execute()
count = 0
for row in r.data:
    sb.table('ingestion_jobs').update({
        'run_after': now,
        'updated_at': now,
    }).eq('id', row['id']).execute()
    count += 1
    print('Reset run_after for job ' + row['id'][:16])

print('Reset ' + str(count) + ' jobs to run_after=now')
