import os
import sys

# Load env file manually
env_file = '../.env.local'
if os.path.exists(env_file):
    with open(env_file, 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip("'").strip('"')

# Provide a shim for get_supabase
sys.path.append(os.path.abspath('src'))

from documents.matcher import match_document_to_policy

res = match_document_to_policy(
    extracted_owner_name="MARK S ADAMS",
    extracted_address="1280 Yukon Dr, Lake Arrowhead, CA 92352",
    account_id="b8e901c3-64a4-4a1d-9d68-0a8d42069133"
)

print(f"Status: {res['status']}")
print(f"Policy ID: {res['policy_id']}")
print(f"Confidence: {res['confidence']}")
print(f"Review Reason: {res['review_reason']}")
print(f"Log: {res['match_log'][-1]}")
