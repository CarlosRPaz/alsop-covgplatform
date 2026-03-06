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
    force_release_job,
    get_submission,
    requeue_stale_jobs,
    update_submission_status,
    MAX_ATTEMPTS,
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
    Full lifecycle for one ingestion job.

    Uses try/except/finally to guarantee the job NEVER stays in 'processing':
      - On success: job -> done, submission -> parsed
      - On failure: job -> queued (with backoff) or failed, submission updated
      - Finally: safety-net force_release_job if still processing
    """
    job_id = job["id"]
    submission_id = job["submission_id"]
    account_id = job["account_id"]
    attempts = job.get("attempts", 1)
    max_attempts = job.get("max_attempts", MAX_ATTEMPTS)
    current_step = "init"

    logger.info(">>> job_id=%s submission_id=%s attempts=%d/%d step=start",
                job_id, submission_id, attempts, max_attempts)

    try:
        # 1. Fetch submission
        current_step = "fetch_submission"
        logger.info("job_id=%s step=%s", job_id, current_step)
        submission = get_submission(submission_id)
        if not submission:
            raise RuntimeError(f"Submission {submission_id} not found")

        # 2. Set submission -> processing
        current_step = "set_submission_processing"
        logger.info("job_id=%s step=%s", job_id, current_step)
        update_submission_status(submission_id, "processing")

        # 3. Determine storage path
        current_step = "resolve_storage_path"
        storage_path = submission.get("storage_path") or submission.get("file_path")
        if not storage_path:
            raise RuntimeError(f"No storage_path or file_path on submission {submission_id}")

        # 4. Download PDF
        current_step = "download_pdf"
        logger.info("job_id=%s step=%s path=%s", job_id, current_step, storage_path)
        pdf_bytes = download_pdf(storage_path)

        # 5. Extract text
        current_step = "extract_text"
        logger.info("job_id=%s step=%s", job_id, current_step)
        extraction = extract_text_from_bytes(pdf_bytes)
        raw_text = extraction["raw_text"]

        extracted_json = {
            "method": extraction["method"],
            "raw_text_length": extraction["raw_text_length"],
            "pages": extraction["page_count"],
        }

        # 6. Parse FAIR Plan declaration fields
        current_step = "parse_declaration"
        logger.info("job_id=%s step=%s", job_id, current_step)
        parsed_result = parse_declaration(raw_text)
        fair_plan_data = parsed_result["extracted_data"]

        extracted_json["is_fair_plan"] = parsed_result["is_fair_plan"]
        if parsed_result["is_fair_plan"]:
            extracted_json["parser"] = "fairplan_v1"

        # 7. Upsert dec_pages
        current_step = "upsert_dec_page"
        logger.info("job_id=%s step=%s", job_id, current_step)
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
        logger.info("job_id=%s step=%s dec_page_id=%s", job_id, current_step, dec_page_id)

        # 8. Process Policy Lifecycle (Client, Policy, Policy Term)
        if parsed_result["is_fair_plan"]:
            current_step = "process_lifecycle"
            logger.info("job_id=%s step=%s", job_id, current_step)
            res_ids = process_lifecycle(account_id, fair_plan_data)
            policy_id = res_ids.get("policy_id")
            if policy_id:
                # 9. Generate and resolve flags
                current_step = "generate_flags"
                logger.info("job_id=%s step=%s policy_id=%s", job_id, current_step, policy_id)
                generate_and_resolve_flags(
                    policy_id=policy_id,
                    dec_page_id=dec_page_id,
                    missing_fields=parsed_result["missing_fields"],
                )

        # 10. Mark job done
        current_step = "complete_job"
        logger.info("job_id=%s step=%s", job_id, current_step)
        complete_job(job_id)

        # 11. Mark submission parsed
        current_step = "update_submission_parsed"
        update_submission_status(submission_id, "parsed")

        logger.info("<<< job_id=%s submission_id=%s step=finished status=done", job_id, submission_id)

    except Exception as exc:
        error_msg = str(exc)
        error_detail = {
            "traceback": traceback.format_exc(),
            "job_id": job_id,
            "submission_id": submission_id,
            "step": current_step,
        }
        logger.error("job_id=%s step=%s error=%s", job_id, current_step, error_msg)

        try:
            # Fail the job (requeue with backoff, or permanent fail)
            fail_job(job_id, error_msg, error_detail, attempts, max_attempts)

            # Only mark submission as 'failed' if permanently failed
            if attempts >= max_attempts:
                update_submission_status(
                    submission_id, "failed",
                    error_message=error_msg,
                    error_detail=error_detail,
                )
            else:
                # Retryable — set submission back to 'queued' so UI shows retry pending
                update_submission_status(submission_id, "queued")

        except Exception as inner_exc:
            logger.critical(
                "job_id=%s step=error_handling FAILED to write error state: %s",
                job_id, inner_exc,
            )

    finally:
        # Safety-net: guarantee the job is NOT left in 'processing'
        force_release_job(job_id, attempts, max_attempts)


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

    # Requeue any stale processing jobs on startup
    try:
        requeued = requeue_stale_jobs()
        logger.info("Requeued %d stale processing jobs on startup", requeued)
    except Exception as exc:
        logger.error("Failed to requeue stale jobs on startup: %s", exc)

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
