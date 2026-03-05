"""
Ingestion Worker — Main Entry Point

Polls ingestion_jobs for queued work, downloads PDFs from Supabase Storage,
extracts text with pdfplumber, and upserts into dec_pages.

Usage:
    cd worker
    python -m src.main
"""

import logging
import os
import sys
import time
import traceback

from dotenv import load_dotenv

# Load .env before any other imports that need env vars
load_dotenv()

from .supabase_client import get_supabase
from .jobs import (
    claim_next_job,
    complete_job,
    fail_job,
    get_submission,
    update_submission_status,
)
from .extract.pdf_text import extract_text_from_bytes
from .extract.fair_plan import parse_declaration
from .db.dec_pages import upsert_dec_page
from .db.lifecycle import process_lifecycle
from .db.flags import generate_and_resolve_flags

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker.main")

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))


# ---------------------------------------------------------------------------
# PDF Download
# ---------------------------------------------------------------------------

def download_pdf(storage_path: str) -> bytes:
    """Download a PDF from Supabase Storage bucket 'cfp-raw-decpage'."""
    sb = get_supabase()
    logger.info("Downloading PDF from storage: %s", storage_path)

    response = sb.storage.from_("cfp-raw-decpage").download(storage_path)

    if not response:
        raise RuntimeError(f"Empty response downloading {storage_path}")

    logger.info("Downloaded %d bytes", len(response))
    return response


# ---------------------------------------------------------------------------
# Process One Job
# ---------------------------------------------------------------------------

def process_job(job: dict) -> None:
    """
    Full lifecycle for one ingestion job:
      1. Look up submission
      2. Set submission -> processing
      3. Download PDF
      4. Extract text
      5. Upsert dec_pages
      6. Mark job done + submission parsed
    """
    job_id = job["id"]
    submission_id = job["submission_id"]
    account_id = job["account_id"]
    attempts = job.get("attempts", 1)
    max_attempts = job.get("max_attempts", 5)

    logger.info("=== Processing job %s (submission=%s) ===", job_id, submission_id)

    try:
        # 1. Fetch submission
        submission = get_submission(submission_id)
        if not submission:
            raise RuntimeError(f"Submission {submission_id} not found")

        # 2. Set submission -> processing
        update_submission_status(submission_id, "processing")

        # 3. Determine storage path
        storage_path = submission.get("storage_path") or submission.get("file_path")
        if not storage_path:
            raise RuntimeError(f"No storage_path or file_path on submission {submission_id}")

        # 4. Download PDF
        pdf_bytes = download_pdf(storage_path)

        # 5. Extract text
        extraction = extract_text_from_bytes(pdf_bytes)
        raw_text = extraction["raw_text"]

        extracted_json = {
            "method": extraction["method"],
            "raw_text_length": extraction["raw_text_length"],
            "pages": extraction["page_count"],
        }
        
        # 6. Parse FAIR Plan declaration fields
        parsed_result = parse_declaration(raw_text)
        fair_plan_data = parsed_result["extracted_data"]
        
        extracted_json["is_fair_plan"] = parsed_result["is_fair_plan"]
        if parsed_result["is_fair_plan"]:
            extracted_json["parser"] = "fairplan_v1"

        # 7. Upsert dec_pages
        dec_page_id = upsert_dec_page(
            submission_id=submission_id,
            account_id=account_id,
            raw_text=raw_text,
            extracted_json=extracted_json,
            missing_fields=parsed_result["missing_fields"],
            parse_status=parsed_result["parse_status"],
            insured_name=fair_plan_data.get("insured_name"),
            policy_number=fair_plan_data.get("policy_number"),
            property_location=fair_plan_data.get("property_location"),
            policy_period_start=fair_plan_data.get("policy_period_start"),
            policy_period_end=fair_plan_data.get("policy_period_end"),
        )
        logger.info("Dec page upserted: %s", dec_page_id)
        
        # 8. Process Policy Lifecycle (Client, Policy, Policy Term)
        if parsed_result["is_fair_plan"]:
            res_ids = process_lifecycle(account_id, fair_plan_data)
            policy_id = res_ids.get("policy_id")
            if policy_id:
                # 9. Generate and resolve flags
                generate_and_resolve_flags(
                    policy_id=policy_id, 
                    dec_page_id=dec_page_id, 
                    missing_fields=parsed_result["missing_fields"]
                )

        # 10. Mark job done
        complete_job(job_id)

        # 11. Mark submission parsed
        update_submission_status(submission_id, "parsed")

        logger.info("=== Job %s completed successfully ===", job_id)

    except Exception as exc:
        error_msg = str(exc)
        error_detail = {
            "traceback": traceback.format_exc(),
            "job_id": job_id,
            "submission_id": submission_id,
        }
        logger.error("Job %s failed: %s", job_id, error_msg)

        # Fail the job (requeue or permanent fail)
        fail_job(job_id, error_msg, error_detail, attempts, max_attempts)

        # Update submission status
        update_submission_status(
            submission_id, "failed",
            error_message=error_msg,
            error_detail=error_detail,
        )


# ---------------------------------------------------------------------------
# Poll Loop
# ---------------------------------------------------------------------------

def run() -> None:
    """Main poll loop. Runs until interrupted."""
    worker_name = os.environ.get("WORKER_NAME", "worker-unknown")
    logger.info("Starting ingestion worker: %s", worker_name)
    logger.info("Poll interval: %ds", POLL_INTERVAL)

    # Verify connection on startup
    try:
        sb = get_supabase()
        # Quick health check — read one row from ingestion_jobs
        sb.table("ingestion_jobs").select("id").limit(1).execute()
        logger.info("Supabase connection OK")
    except Exception as exc:
        logger.error("Failed to connect to Supabase: %s", exc)
        sys.exit(1)

    while True:
        try:
            job = claim_next_job()
            if job:
                process_job(job)
            else:
                logger.debug("No jobs available, sleeping %ds", POLL_INTERVAL)
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            logger.info("Shutting down gracefully")
            break
        except Exception as exc:
            logger.error("Unexpected error in poll loop: %s", exc)
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
