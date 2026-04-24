import os
import sys

# shim for paths
sys.path.append(os.path.abspath('worker/src'))

# emulate dotenv manually
with open('.env.local', 'r') as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ[k.strip()] = v.strip("'").strip('"')

from documents.matcher import match_document_to_policy

res = match_document_to_policy(
    extracted_owner_name="MARK S ADAMS",
    extracted_address="1280 Yukon Dr, Lake Arrowhead, CA 92352",
    account_id="b8e901c3-64a4-4a1d-9d68-0a8d42069133"
)

import json
print(json.dumps(res, default=str, indent=2))
