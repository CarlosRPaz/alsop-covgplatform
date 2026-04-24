import sys, os
sys.path.insert(0, '.')
os.environ.setdefault('SUPABASE_URL', 'https://qbihizqbtimwvhxkneeb.supabase.co')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', open('../.env.local').read().split('SUPABASE_SERVICE_ROLE_KEY=')[1].split('\n')[0].strip())

from src.documents.matcher import normalize_name, _similarity, _fetch_all
from src.supabase_client import get_supabase

sb = get_supabase()
clients = _fetch_all(sb.table('clients').select('id, named_insured'))
print(f'Total clients fetched: {len(clients)}')

target = normalize_name('MARK S ADAMS')
print(f'Normalized search name: "{target}"')

matches = []
for c in clients:
    c_name = normalize_name(c.get('named_insured'))
    if c_name:
        sim = _similarity(target, c_name)
        if sim >= 0.60:
            matches.append((c['id'], c['named_insured'], c_name, sim))

matches.sort(key=lambda x: x[3], reverse=True)
print(f'Name matches (>=0.60): {len(matches)}')
for m in matches[:10]:
    print(f'  {m[1]:30s} -> norm="{m[2]}" sim={m[3]:.3f} id={m[0]}')

# Also check: is MARK ADAMS in the list?
for c in clients:
    if c.get('named_insured') and 'MARK ADAMS' in c.get('named_insured', '').upper():
        nm = normalize_name(c['named_insured'])
        sim = _similarity(target, nm) if nm else 0
        print(f'\nDirect check: "{c["named_insured"]}" -> norm="{nm}" sim={sim:.3f} id={c["id"]}')
