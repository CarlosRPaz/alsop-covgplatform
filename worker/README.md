# Dec Page Ingestion Worker

Phase 1 background worker that processes uploaded declaration page PDFs.

**Pipeline:** Upload → `ingestion_jobs` queue → Worker claims → Download PDF → Extract text → Upsert `dec_pages` → Done

## Quick Start

```bash
cd worker

# 1. Create virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables
cp .env.example .env
# Edit .env with your Supabase URL + SERVICE ROLE KEY

# 4. Run the worker
python -m src.main
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (never commit!) |
| `WORKER_NAME` | No | Worker identity for `locked_by` (default: `worker-unknown`) |
| `POLL_INTERVAL` | No | Seconds between polls (default: `5`) |

## Testing Manually

Insert a test job after uploading a PDF through the app:

```sql
INSERT INTO public.ingestion_jobs (submission_id, account_id)
VALUES (
    '<submission-uuid>',  -- from dec_page_submissions.id
    '<account-uuid>'      -- from accounts.id
);
```

The worker will pick it up within `POLL_INTERVAL` seconds.

## Job Lifecycle

```
queued → processing → done
                   ↘ failed (after max_attempts retries)
```

- **Claim**: Atomic two-step (SELECT + guarded UPDATE) prevents double-claim
- **Retry**: On failure, requeued with 5-minute delay (up to `max_attempts`)
- **Idempotent**: `dec_pages` upsert by `submission_id` — safe to reprocess

## Project Structure

```
worker/
├── .env.example        # Env var template
├── requirements.txt    # Python dependencies
├── README.md           # This file
└── src/
    ├── __init__.py
    ├── main.py             # Poll loop + process_job
    ├── supabase_client.py  # Service role client singleton
    ├── jobs.py             # Claim/complete/fail job queue ops
    ├── extract/
    │   ├── __init__.py
    │   └── pdf_text.py     # pdfplumber text extraction
    └── db/
        ├── __init__.py
        └── dec_pages.py    # Upsert dec_pages row
```

## Phase 2 (Future)

- OCR fallback (Tesseract + OpenCV) for scanned PDFs
- FAIR Plan field parsing into individual `dec_pages` columns
- Client/policy/policy_term upserts
- `policy_flags` generation

## Deployment (Future)

For production, run as a systemd service on a droplet:

```ini
# /etc/systemd/system/gap-guard-worker.service
[Unit]
Description=Gap Guard Ingestion Worker
After=network.target

[Service]
User=worker
WorkingDirectory=/opt/gap-guard/worker
ExecStart=/opt/gap-guard/worker/.venv/bin/python -m src.main
Restart=always
RestartSec=10
EnvironmentFile=/opt/gap-guard/worker/.env

[Install]
WantedBy=multi-user.target
```
