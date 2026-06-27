-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Access Requests Table
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- ── ACCESS_REQUESTS ───────────────────────────────────
-- Populated by the caflatcore.com landing page form.
-- Review these rows to decide who gets a license key.
CREATE TABLE IF NOT EXISTS public.access_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_name    text        NOT NULL,
  contact_name text        NOT NULL,
  email        text        NOT NULL,
  phone        text,
  tier         text        NOT NULL DEFAULT 'cloud',
  message      text,
  status       text        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  notes        text                                      -- internal reviewer notes
);

CREATE INDEX IF NOT EXISTS access_requests_status
  ON public.access_requests (status, requested_at DESC);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anon can only INSERT (submit a request), not read others
DROP POLICY IF EXISTS "anon_insert_access_requests" ON public.access_requests;
CREATE POLICY "anon_insert_access_requests" ON public.access_requests
  FOR INSERT TO anon WITH CHECK (true);

-- You (the admin) read/update via service role key in Supabase dashboard
-- No additional policy needed for service role (bypasses RLS)
