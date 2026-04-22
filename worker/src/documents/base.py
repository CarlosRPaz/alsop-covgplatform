"""
Abstract base class for document processors.

Each document type (RCE, DIC, etc.) implements this interface to provide
type-specific extraction, matching, and writeback logic.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from ..supabase_client import get_supabase
from .ocr import extract_text_from_pdf_bytes, ExtractionResult
from .matcher import match_document_to_policy, MatchResult

logger = logging.getLogger("worker.documents.base")


class DocumentProcessor(ABC):
    """
    Base class for all document type processors.
    
    Subclasses must implement:
    - doc_type: str property returning the document type key
    - extract_fields(): LLM-powered field extraction
    - persist_extracted_data(): save to type-specific table (doc_data_rce, etc.)
    - writeback_to_policy(): safely promote data to policy records
    """

    def __init__(self, document_id: str, account_id: str):
        self.document_id = document_id
        self.account_id = account_id
        self.sb = get_supabase()
        self._log_prefix = f"doc={document_id}"

    @property
    @abstractmethod
    def doc_type(self) -> str:
        """Return the document type key (e.g., 'rce', 'dic_dec_page')."""
        ...

    @abstractmethod
    def extract_fields(self, raw_text: str) -> dict[str, Any]:
        """
        Extract structured fields from raw text using LLM.
        Must return a dict with at least 'owner_name' and 'address' for matching.
        """
        ...

    @abstractmethod
    def persist_extracted_data(self, extracted: dict[str, Any]) -> str:
        """
        Save extracted data to the type-specific table (doc_data_rce, etc.).
        Returns the row ID of the created record.
        """
        ...

    @abstractmethod
    def writeback_to_policy(
        self,
        extracted: dict[str, Any],
        policy_id: str,
        policy_term_id: str | None,
    ) -> list[dict]:
        """
        Safely promote extracted values to policy/enrichment records.
        
        Returns a list of writeback log entries describing what was written,
        skipped, or flagged as conflict.
        """
        ...

    # ── Orchestration (shared logic) ─────────────────────────────────────

    def update_document(self, updates: dict) -> None:
        """Update the platform_documents row."""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.sb.table("platform_documents").update(updates).eq("id", self.document_id).execute()

    def update_step(self, step: str) -> None:
        """Update processing_step for live UI progress."""
        self.update_document({"processing_step": step})

    def process(self, pdf_bytes: bytes) -> dict:
        """
        Full processing pipeline for this document.
        
        Steps:
        1. Extract text (pdfplumber + OCR fallback)
        2. Parse fields via LLM
        3. Match to policy (owner name + address)
        4. Persist extracted data
        5. Writeback to policy (if matched)
        6. Return summary
        
        Every step updates the document status for live UI tracking.
        Errors at any step are recorded and surfaced to the agent.
        """
        result = {
            "document_id": self.document_id,
            "doc_type": self.doc_type,
            "steps_completed": [],
            "match_result": None,
            "writeback_log": [],
            "errors": [],
        }

        try:
            # Step 1: Extract text
            self.update_step("extracting_text")
            self.update_document({"parse_status": "processing"})
            logger.info("%s step=extract_text", self._log_prefix)

            extraction: ExtractionResult = extract_text_from_pdf_bytes(pdf_bytes)
            raw_text = extraction["raw_text"]

            self.update_document({
                "raw_text": raw_text,
            })
            result["steps_completed"].append("extract_text")
            logger.info(
                "%s extracted %d chars via %s",
                self._log_prefix, extraction["raw_text_length"], extraction["method"],
            )

            # Step 2: Parse fields via LLM
            self.update_step("parsing_fields")
            logger.info("%s step=parse_fields", self._log_prefix)

            extracted = self.extract_fields(raw_text)
            if not extracted:
                raise RuntimeError("Field extraction returned empty result")

            # Store identity fields for matching
            owner_name = extracted.get("owner_name") or extracted.get("insured_name")
            address_raw = extracted.get("property_address") or extracted.get("address")
            
            # For DIC, the address parts may be separate
            if not address_raw and extracted.get("property_street"):
                parts = [
                    extracted.get("property_street", ""),
                    extracted.get("property_city", ""),
                ]
                state_zip = " ".join(filter(None, [
                    extracted.get("property_state", ""),
                    extracted.get("property_zip", ""),
                ]))
                if state_zip:
                    parts.append(state_zip)
                address_raw = ", ".join(filter(None, parts))

            from .matcher import normalize_address
            self.update_document({
                "extracted_owner_name": owner_name,
                "extracted_address": address_raw,
                "extracted_address_norm": normalize_address(address_raw),
            })
            result["steps_completed"].append("parse_fields")

            # Step 3: Match to policy
            self.update_step("matching_policy")
            logger.info("%s step=match_policy owner=%s addr=%s", self._log_prefix, owner_name, address_raw)

            match: MatchResult = match_document_to_policy(owner_name, address_raw, self.account_id)
            result["match_result"] = match

            self.update_document({
                "match_status": match["status"],
                "match_log": match["match_log"],
                "match_confidence": match["confidence"],
                "policy_id": match["policy_id"],
                "client_id": match["client_id"],
                "policy_term_id": match["policy_term_id"],
            })
            result["steps_completed"].append("match_policy")

            # Step 4: Persist extracted data to type-specific table
            self.update_step("saving_data")
            logger.info("%s step=persist_data", self._log_prefix)

            data_row_id = self.persist_extracted_data(extracted)
            result["steps_completed"].append("persist_data")
            logger.info("%s persisted data row %s", self._log_prefix, data_row_id)

            # Step 5: Writeback to policy (only if auto-matched)
            if match["status"] == "matched" and match["policy_id"]:
                self.update_step("writing_policy_data")
                logger.info("%s step=writeback policy=%s", self._log_prefix, match["policy_id"])

                writeback_log = self.writeback_to_policy(
                    extracted,
                    match["policy_id"],
                    match["policy_term_id"],
                )
                result["writeback_log"] = writeback_log

                # Determine writeback status from log
                has_conflicts = any(e.get("action") == "conflict" for e in writeback_log)
                wb_status = "conflict" if has_conflicts else "written"
                self.update_document({
                    "writeback_status": wb_status,
                    "writeback_log": writeback_log,
                })
                result["steps_completed"].append("writeback")
            else:
                self.update_document({"writeback_status": "skipped"})
                logger.info(
                    "%s writeback skipped (match_status=%s)",
                    self._log_prefix, match["status"],
                )

            # Step 6: Mark as complete
            parse_status = "parsed" if match["status"] == "matched" else "needs_review"
            self.update_step("complete")
            self.update_document({
                "parse_status": parse_status,
                "error_message": match.get("review_reason") if match["status"] != "matched" else None,
            })
            result["steps_completed"].append("complete")

            logger.info(
                "%s processing complete. match=%s confidence=%.2f",
                self._log_prefix, match["status"], match["confidence"],
            )

        except Exception as exc:
            error_msg = str(exc)[:2000]
            logger.error("%s processing failed: %s", self._log_prefix, error_msg)
            result["errors"].append(error_msg)
            self.update_document({
                "parse_status": "failed",
                "error_message": error_msg,
                "processing_step": "failed",
            })

        return result
