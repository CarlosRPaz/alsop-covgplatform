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
    update_submission_step,
    MAX_ATTEMPTS,
)
from .extract.pdf_text import extract_text_from_bytes
from .extract.fair_plan import parse_declaration
from .extract.llm_extract import extract_with_llm
from .db.dec_pages import upsert_dec_page
from .db.lifecycle import process_lifecycle
from .db.flag_evaluator import evaluate_flags
from .db.flags import insert_activity_event
from .db.enrichment import enrich_property
from .db.api_enrichment import trigger_full_enrichment, trigger_flag_evaluation

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

    Pipeline stages (with live UI step tracking):
      1. Download PDF
      2. Extract text (pdfplumber/OCR)          → step: extracting_text
      3. Parse declaration fields (LLM/regex)    → step: parsing_fields
      4. Create lifecycle records (client/policy) → step: creating_records
      5. Full enrichment via API (ATTOM, vision) → step: enriching_property
      6. Flag evaluation via API                 → step: evaluating_flags
      7. Done                                    → step: complete

    Uses try/except/finally to guarantee the job NEVER stays in 'processing':
      - On success: job -> done, submission -> parsed
      - On failure: job -> queued (with backoff) or failed, submission updated
      - Finally: safety-net force_release_job if still processing
    """
    import time as _time

    job_id = job["id"]
    submission_id = job["submission_id"]
    account_id = job["account_id"]
    attempts = job.get("attempts", 1)
    max_attempts = job.get("max_attempts", MAX_ATTEMPTS)
    current_step = "init"
    job_completed = False  # Sentinel: True only after complete_job succeeds
    job_start = _time.monotonic()

    logger.info(">>> job_id=%s submission_id=%s attempts=%d/%d step=start",
                job_id, submission_id, attempts, max_attempts)

    try:
        # 1. Fetch submission
        current_step = "fetch_submission"
        step_start = _time.monotonic()
        logger.info("job_id=%s step=%s", job_id, current_step)
        submission = get_submission(submission_id)
        if not submission:
            raise RuntimeError(f"Submission {submission_id} not found")
        logger.info("job_id=%s step=%s elapsed=%.2fs", job_id, current_step, _time.monotonic() - step_start)

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
        step_start = _time.monotonic()
        logger.info("job_id=%s step=%s path=%s", job_id, current_step, storage_path)
        pdf_bytes = download_pdf(storage_path)
        logger.info("job_id=%s step=%s elapsed=%.2fs bytes=%d", job_id, current_step, _time.monotonic() - step_start, len(pdf_bytes))

        # 5. Extract text  ── UI step: extracting_text
        current_step = "extract_text"
        update_submission_step(submission_id, "extracting_text")
        logger.info("job_id=%s step=%s", job_id, current_step)
        extraction = extract_text_from_bytes(pdf_bytes)
        raw_text = extraction["raw_text"]

        extracted_json = {
            "method": extraction["method"],
            "raw_text_length": extraction["raw_text_length"],
            "pages": extraction["page_count"],
        }

        # 6. Parse declaration fields  ── UI step: parsing_fields
        current_step = "parse_declaration"
        update_submission_step(submission_id, "parsing_fields")
        logger.info("job_id=%s step=%s (trying LLM first)", job_id, current_step)

        parsed_result = extract_with_llm(raw_text)
        if parsed_result:
            extracted_json["parser"] = "llm_gpt4o_mini"
            logger.info("job_id=%s step=%s LLM extraction succeeded", job_id, current_step)
        else:
            logger.info("job_id=%s step=%s LLM unavailable, falling back to regex", job_id, current_step)
            parsed_result = parse_declaration(raw_text)
            if parsed_result["is_fair_plan"]:
                extracted_json["parser"] = "fairplan_regex_v1"

        fair_plan_data = parsed_result["extracted_data"]
        extracted_json["is_fair_plan"] = parsed_result["is_fair_plan"]

        # 7. Upsert dec_pages
        current_step = "upsert_dec_page"
        step_start = _time.monotonic()
        logger.info("job_id=%s step=%s", job_id, current_step)
        dec_page_id = upsert_dec_page(
            submission_id=submission_id,
            account_id=account_id,
            raw_text=raw_text,
            extracted_json=extracted_json,
            missing_fields=parsed_result["missing_fields"],
            parse_status=parsed_result["parse_status"],
            extracted_data=fair_plan_data,
        )
        logger.info("job_id=%s step=%s dec_page_id=%s elapsed=%.2fs", job_id, current_step, dec_page_id, _time.monotonic() - step_start)

        # 8. Process Policy Lifecycle  ── UI step: creating_records
        policy_id = None
        client_id = None
        policy_term_id = None

        if parsed_result["is_fair_plan"]:
            current_step = "process_lifecycle"
            update_submission_step(submission_id, "creating_records")
            logger.info("job_id=%s step=%s", job_id, current_step)
            res_ids = process_lifecycle(account_id, fair_plan_data, dec_page_id=dec_page_id)
            policy_id = res_ids.get("policy_id")
            client_id = res_ids.get("client_id")
            policy_term_id = res_ids.get("policy_term_id")

            # 8b. Link dec_pages row to policy/client/term
            if policy_id or client_id:
                current_step = "link_dec_page"
                logger.info("job_id=%s step=%s dec_page_id=%s policy_id=%s client_id=%s",
                            job_id, current_step, dec_page_id, policy_id, client_id)
                link_payload = {}
                if policy_id:
                    link_payload["policy_id"] = policy_id
                if client_id:
                    link_payload["client_id"] = client_id
                if policy_term_id:
                    link_payload["policy_term_id"] = policy_term_id
                
                sb = get_supabase()
                sb.table("dec_pages").update(link_payload).eq("id", dec_page_id).execute()
                logger.info("job_id=%s step=%s linked dec_pages to policy/client", job_id, current_step)

            # 9. Log document-processed activity event
            if policy_id:
                insert_activity_event(
                    event_type="dec.uploaded",
                    title="New Declaration Processed",
                    detail="A new declaration page was successfully parsed and applied.",
                    policy_id=policy_id,
                    client_id=client_id,
                    dec_page_id=dec_page_id,
                    actor_user_id=account_id,
                )

        # ─────────────────────────────────────────────────────────────
        # 10. FULL ENRICHMENT via API  ── UI step: enriching_property
        #
        # This replaces the old minimal enrichment (satellite + geocode
        # + fire risk only). Now calls the production Next.js API which
        # runs the COMPLETE pipeline: ATTOM, satellite, street view,
        # AI vision, fire risk, geocoding, AND auto-generates a report.
        # ─────────────────────────────────────────────────────────────
        if policy_id:
            current_step = "full_enrichment_api"
            update_submission_step(submission_id, "enriching_property")
            logger.info("job_id=%s step=%s policy_id=%s", job_id, current_step, policy_id)
            try:
                enrich_result = trigger_full_enrichment(policy_id)
                if not enrich_result.get("success"):
                    logger.warning(
                        "job_id=%s full enrichment returned non-success (non-fatal): %s",
                        job_id, enrich_result.get("error"),
                    )
            except Exception as enrich_exc:
                logger.warning(
                    "job_id=%s full enrichment failed (non-fatal): %s",
                    job_id, enrich_exc,
                )

            # 11. RE-EVALUATE FLAGS with enriched data  ── UI step: evaluating_flags
            current_step = "flag_evaluation_api"
            update_submission_step(submission_id, "evaluating_flags")
            logger.info("job_id=%s step=%s policy_id=%s", job_id, current_step, policy_id)
            try:
                flag_result = trigger_flag_evaluation(policy_id)
                if not flag_result.get("success"):
                    logger.warning(
                        "job_id=%s flag evaluation returned non-success (non-fatal): %s",
                        job_id, flag_result.get("error"),
                    )
            except Exception as flag_exc:
                logger.warning(
                    "job_id=%s flag evaluation API failed (non-fatal): %s",
                    job_id, flag_exc,
                )

        # 12. Mark job done  ── UI step: complete
        current_step = "complete_job"
        update_submission_step(submission_id, "complete")
        logger.info("job_id=%s step=%s", job_id, current_step)
        complete_job(job_id)
        job_completed = True  # MUST be set AFTER complete_job succeeds

        # 13. Mark submission parsed
        current_step = "update_submission_parsed"
        update_submission_status(submission_id, "parsed")

        elapsed = _time.monotonic() - job_start
        logger.info("<<< job_id=%s submission_id=%s step=finished status=done elapsed=%.2fs", job_id, submission_id, elapsed)

    except Exception as exc:
        error_msg = str(exc)
        error_detail = {
            "traceback": traceback.format_exc(),
            "job_id": job_id,
            "submission_id": submission_id,
            "step": current_step,
            "elapsed": round(_time.monotonic() - job_start, 2),
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

                # Log failed processing as activity event for admin visibility
                try:
                    insert_activity_event(
                        event_type="dec.processing_failed",
                        title="Declaration Processing Failed",
                        detail=f"Failed after {attempts} attempt(s) at step '{current_step}': {error_msg[:200]}",
                        dec_page_id=None,
                        actor_user_id=account_id,
                        meta={"step": current_step, "submission_id": submission_id},
                    )
                except Exception:
                    pass  # Non-fatal
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
        # Skip if we already confirmed the job completed successfully
        if not job_completed:
            force_release_job(job_id, submission_id, attempts, max_attempts)


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
