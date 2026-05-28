-- Migration: Add carrier_policy_number to policy_terms table
-- This column preserves the original carrier policy number (including suffixes like 01, 08) for each term.

ALTER TABLE policy_terms ADD COLUMN IF NOT EXISTS carrier_policy_number TEXT;

-- Backfill existing terms using source_policy_number if available
UPDATE policy_terms 
SET carrier_policy_number = source_policy_number 
WHERE carrier_policy_number IS NULL AND source_policy_number IS NOT NULL;
