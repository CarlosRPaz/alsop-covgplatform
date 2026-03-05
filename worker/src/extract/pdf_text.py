"""
PDF text extraction using pdfplumber.
Phase 1: digital text only (no OCR).
"""

import io
import logging

import pdfplumber

logger = logging.getLogger("worker.extract.pdf_text")


def extract_text_from_bytes(pdf_bytes: bytes) -> dict:
    """
    Extract text from a PDF byte buffer using pdfplumber.

    Returns:
        {
            "raw_text": str,        -- concatenated text from all pages
            "page_count": int,
            "raw_text_length": int,
            "method": "pdfplumber",
        }
    """
    logger.info("Extracting text from PDF (%d bytes)", len(pdf_bytes))

    pages_text: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages_text.append(text)
            logger.debug("  Page %d/%d: %d chars", i + 1, page_count, len(text))

    raw_text = "\n\n".join(pages_text)
    result = {
        "raw_text": raw_text,
        "page_count": page_count,
        "raw_text_length": len(raw_text),
        "method": "pdfplumber",
    }

    logger.info("Extracted %d chars from %d pages", len(raw_text), page_count)
    return result
