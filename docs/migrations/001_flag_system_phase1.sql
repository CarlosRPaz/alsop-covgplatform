-- ============================================================================
-- Flag System Phase 1 — Safe Migration
-- Run in order. Each block is idempotent (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================================

-- ============================================================================
-- 1. CREATE flag_definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.flag_definitions (
    code            text        PRIMARY KEY,
    label           text        NOT NULL,
    description     text        NULL,
    category        text        NOT NULL,
    default_severity text       NOT NULL DEFAULT 'info',
    entity_scope    text        NOT NULL DEFAULT 'policy',
    auto_resolve    boolean     NOT NULL DEFAULT false,
    is_manual_allowed boolean   NOT NULL DEFAULT false,
    is_active       boolean     NOT NULL DEFAULT true,
    default_action_path text    NULL,
    rule_version    text        NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.flag_definitions
    IS 'Registry of all known flag types. Worker evaluator + UI reference this.';

-- ============================================================================
-- 2. UPGRADE policy_flags — add new columns safely
-- ============================================================================

-- 2a. Status column (replaces resolved_at-based detection)
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- 2b. updated_at (worker already writes to this, but column may be missing)
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2c. Dismissal tracking
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS dismissed_at timestamptz NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS dismissed_by_account_id uuid NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS dismiss_reason text NULL;

-- 2d. Category + flag_key + action_path
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS category text NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS flag_key text NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS action_path text NULL;

-- 2e. Assignment
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS assigned_account_id uuid NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS assigned_office text NULL;

-- 2f. Occurrence tracking
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS times_seen integer NOT NULL DEFAULT 1;

-- 2g. Multi-entity scope
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS client_id uuid NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS policy_term_id uuid NULL;
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS submission_id uuid NULL;
-- dec_page_id — we already have source_dec_page_id; add a proper dec_page_id too
ALTER TABLE public.policy_flags
    ADD COLUMN IF NOT EXISTS dec_page_id uuid NULL;

-- ============================================================================
-- 3. MIGRATE existing data to new status model
-- ============================================================================

-- Existing resolved flags → status = 'resolved'
UPDATE public.policy_flags
    SET status = 'resolved'
    WHERE resolved_at IS NOT NULL
      AND status = 'open';

-- Backfill first_seen_at from created_at for existing rows
UPDATE public.policy_flags
    SET first_seen_at = created_at
    WHERE first_seen_at IS NULL;

-- Backfill last_seen_at from updated_at or created_at
UPDATE public.policy_flags
    SET last_seen_at = COALESCE(updated_at, created_at)
    WHERE last_seen_at IS NULL;

-- Copy source_dec_page_id → dec_page_id for existing rows
UPDATE public.policy_flags
    SET dec_page_id = source_dec_page_id
    WHERE dec_page_id IS NULL
      AND source_dec_page_id IS NOT NULL;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Partial unique: one open flag per flag_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_flags_unique_open_key
    ON public.policy_flags (flag_key)
    WHERE status = 'open' AND flag_key IS NOT NULL;

-- Fast filter for policy page
CREATE INDEX IF NOT EXISTS idx_policy_flags_policy_status
    ON public.policy_flags (policy_id, status);

-- Fast filter for client page
CREATE INDEX IF NOT EXISTS idx_policy_flags_client_status
    ON public.policy_flags (client_id, status)
    WHERE client_id IS NOT NULL;

-- Dashboard work queue sort
CREATE INDEX IF NOT EXISTS idx_policy_flags_queue
    ON public.policy_flags (status, severity, created_at DESC);

-- ============================================================================
-- 5. CREATE flag_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.flag_events (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id           uuid        NOT NULL REFERENCES public.policy_flags(id) ON DELETE CASCADE,
    event_type        text        NOT NULL,
    actor_account_id  uuid        NULL,
    note              text        NULL,
    details           jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.flag_events
    IS 'Immutable audit trail for flag lifecycle events.';

CREATE INDEX IF NOT EXISTS idx_flag_events_flag_id
    ON public.flag_events (flag_id, created_at DESC);

-- ============================================================================
-- 6. SEED flag_definitions with initial rules
-- ============================================================================
INSERT INTO public.flag_definitions (code, label, description, category, default_severity, entity_scope, auto_resolve, is_manual_allowed) VALUES
    -- Data Quality — Specific missing-field flags (replacing generic MISSING_FIELDS)
    ('MISSING_DWELLING_LIMIT',       'Missing Dwelling Limit',       'Policy term is missing the dwelling coverage limit.',           'data_quality', 'warning',  'policy', true,  false),
    ('MISSING_PREMIUM',              'Missing Annual Premium',       'Policy term has no annual premium recorded.',                   'data_quality', 'warning',  'policy', true,  false),
    ('MISSING_DEDUCTIBLE',           'Missing Deductible',           'Policy term is missing the deductible amount.',                 'data_quality', 'info',     'policy', true,  false),
    ('MISSING_EFFECTIVE_DATE',       'Missing Effective Date',       'Policy term has no effective date.',                            'data_quality', 'warning',  'policy', true,  false),
    ('MISSING_EXPIRATION_DATE',      'Missing Expiration Date',      'Policy term has no expiration date.',                           'data_quality', 'warning',  'policy', true,  false),
    ('MISSING_CARRIER',              'Missing Carrier Name',         'Policy has no carrier name recorded.',                          'data_quality', 'info',     'policy', true,  false),
    ('MISSING_POLICY_NUMBER',        'Missing Policy Number',        'Policy has no policy number.',                                  'data_quality', 'warning',  'policy', true,  false),
    ('MISSING_NAMED_INSURED',        'Missing Named Insured',        'Client has no named insured value.',                            'data_quality', 'warning',  'client', true,  false),
    ('MISSING_EMAIL',                'Missing Client Email',         'Client has no email on file.',                                  'data_quality', 'info',     'client', true,  false),
    ('MISSING_PROPERTY_ADDRESS',     'Missing Property Address',     'Policy has no property address.',                               'data_quality', 'info',     'policy', true,  false),

    -- Renewal
    ('RENEWAL_UPCOMING',             'Renewal Upcoming',             'Policy term expires within 21 days.',                           'renewal',      'warning',  'policy', true,  false),

    -- Coverage Gap
    ('COVERAGE_GAP_OTHER_STRUCTURES','Missing Other Structures',     'Policy term has no other structures coverage.',                 'coverage_gap', 'info',     'policy', true,  false),
    ('COVERAGE_GAP_PERSONAL_PROPERTY','Missing Personal Property',   'Policy term has no personal property coverage.',                'coverage_gap', 'info',     'policy', true,  false),

    -- DIC
    ('DIC_NOT_ON_FILE',              'DIC Not on File',              'Policy term indicates no DIC coverage exists.',                 'dic',          'warning',  'policy', false, false),

    -- Duplicate
    ('POSSIBLE_DUPLICATE_CLIENT',    'Possible Duplicate Client',    'Another client with a similar name exists.',                    'duplicate',    'info',     'client', false, false),

    -- Workflow
    ('PENDING_REVIEW',               'Policy Pending Review',        'Policy status is pending_review and needs attention.',          'workflow',     'info',     'policy', true,  false),

    -- Manual
    ('MANUAL_FLAG',                  'Manual Flag',                  'Staff-created flag for any purpose.',                           'manual',       'info',     'policy', false, true),
    ('MANUAL_CLIENT_FLAG',           'Manual Client Flag',           'Staff-created flag on a client.',                               'manual',       'info',     'client', false, true),

    -- Parser
    ('PARSER_EXTRACTION_FAILURE',    'Extraction Failure',           'Document parser could not extract one or more fields.',         'parser',       'warning',  'policy', true,  false)

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 7. MOVE existing NEW_DOCUMENT flags → activity_events, then clean up
-- ============================================================================
-- This is a data migration. NEW_DOCUMENT should become activity events.
-- Run this AFTER verifying the migration is correct.

-- Step 7a: Insert into activity_events
INSERT INTO public.activity_events (
    actor_user_id,
    event_type,
    title,
    detail,
    policy_id,
    dec_page_id,
    meta,
    created_at
)
SELECT
    f.created_by_account_id,
    'dec.uploaded',
    f.title,
    f.message,
    f.policy_id,
    f.source_dec_page_id,
    COALESCE(f.details, '{}'::jsonb),
    f.created_at
FROM public.policy_flags f
WHERE f.code = 'NEW_DOCUMENT';

-- Step 7b: Delete the migrated rows
DELETE FROM public.policy_flags WHERE code = 'NEW_DOCUMENT';

-- ============================================================================
-- DONE — verification queries
-- ============================================================================
-- SELECT count(*) FROM public.flag_definitions;
-- SELECT count(*), status FROM public.policy_flags GROUP BY status;
-- SELECT count(*) FROM public.flag_events;
