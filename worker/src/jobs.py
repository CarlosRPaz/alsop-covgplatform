"""
Job queue operations for ingestion_jobs table.
Implements atomic claim, complete, and fail logic.
"""

import logging
import os
from datetime import datetime, timezone

from .supabase_client import get_supabase

logger = logging.getLogger("worker.jobs")

WORKER_NAME = os.environ.get("WORKER_NAME", "worker-unknown")


def claim_next_job() -> dict | None:
    """
    Atomically claim the next eligible job from ingestion_jobs.

    Eligible: status='queued' AND run_after <= now().
    Claim: set status='processing', locked_at=now(), locked_by, increment attempts.

    Uses a two-step approach:
      1) Select the oldest eligible job.
      2) Attempt an UPDATE with a WHERE guard to prevent double-claim.

    Returns the claimed job dict, or None if no jobs available.
    """
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step 1: Find the next eligible job
    result = (
        sb.table("ingestion_jobs")
        .select("*")
        .eq("status", "queued")
        .lte("run_after", now_iso)
        .order("run_after", desc=False)
        .limit(1)
        .execute()
    )

    if not result.data:
        return None

    candidate = result.data[0]
    job_id = candidate["id"]
    current_attempts = candidate.get("attempts", 0)

    # Step 2: Atomic claim — only succeeds if still 'queued'
    claim_result = (
        sb.table("ingestion_jobs")
        .update(
            {
                "status": "processing",
                "locked_at": now_iso,
                "locked_by": WORKER_NAME,
                "attempts": current_attempts + 1,
                "updated_at": now_iso,
            }
        )
        .eq("id", job_id)
        .eq("status", "queued")  # Guard: another worker may have claimed it
        .execute()
    )

    if not claim_result.data:
        logger.debug("Job %s was claimed by another worker, skipping", job_id)
        return None

    claimed = claim_result.data[0]
    logger.info("Claimed job %s (submission=%s, attempt=%d)",
                claimed["id"], claimed["submission_id"], claimed["attempts"])
    return claimed


def complete_job(job_id: str) -> None:
    """Mark a job as done."""
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    sb.table("ingestion_jobs").update(
        {"status": "done", "updated_at": now_iso}
    ).eq("id", job_id).execute()
    logger.info("Job %s marked as done", job_id)


def fail_job(job_id: str, error_msg: str, error_detail: dict | None = None,
             attempts: int = 0, max_attempts: int = 5) -> None:
    """
    Handle job failure.
    - If attempts < max_attempts: requeue with 5-min delay.
    - Otherwise: mark as failed permanently.
    """
    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    if attempts < max_attempts:
        # Requeue with backoff
        from datetime import timedelta
        run_after = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        sb.table("ingestion_jobs").update(
            {
                "status": "queued",
                "locked_at": None,
                "locked_by": None,
                "last_error": error_msg,
                "last_error_detail": error_detail or {},
                "run_after": run_after,
                "updated_at": now_iso,
            }
        ).eq("id", job_id).execute()
        logger.warning("Job %s requeued (attempt %d/%d): %s",
                        job_id, attempts, max_attempts, error_msg)
    else:
        sb.table("ingestion_jobs").update(
            {
                "status": "failed",
                "last_error": error_msg,
                "last_error_detail": error_detail or {},
                "updated_at": now_iso,
            }
        ).eq("id", job_id).execute()
        logger.error("Job %s permanently failed after %d attempts: %s",
                      job_id, attempts, error_msg)


def update_submission_status(submission_id: str, status: str,
                             error_message: str | None = None,
                             error_detail: dict | None = None) -> None:
    """Update the dec_page_submissions status."""
    sb = get_supabase()
    payload: dict = {"status": status}
    if error_message is not None:
        payload["error_message"] = error_message
    if error_detail is not None:
        payload["error_detail"] = error_detail
    sb.table("dec_page_submissions").update(payload).eq("id", submission_id).execute()
    logger.info("Submission %s status -> %s", submission_id, status)


def get_submission(submission_id: str) -> dict | None:
    """Fetch a dec_page_submissions row by ID."""
    sb = get_supabase()
    result = (
        sb.table("dec_page_submissions")
        .select("*")
        .eq("id", submission_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
