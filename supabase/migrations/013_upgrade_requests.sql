-- ═══════════════════════════════════════════════════════
-- 013 — Trial-to-Paid Upgrade Requests
--   upgrade_requests: one row per checkout submission from the app's
--     in-app upgrade flow (license modal / trial nudges). No payment
--     processing happens in Supabase — this is just an intake queue the
--     Caflat team reviews to issue a real license key back to the buyer.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id         bigserial   PRIMARY KEY,
  tenant_id  uuid,
  device_id  text        NOT NULL,
  brand      text        NOT NULL DEFAULT '',
  plan       text        NOT NULL,
  reference  text        NOT NULL DEFAULT '',
  contact    text        NOT NULL DEFAULT '',
  status     text        NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upgrade_requests_status ON public.upgrade_requests (status);

-- Insert-only from the app: anon can submit a request but never read,
-- update, or delete other tenants' rows — review happens from the
-- Supabase dashboard directly.
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_upgrade_requests" ON public.upgrade_requests;
CREATE POLICY "anon_insert_upgrade_requests" ON public.upgrade_requests
  FOR INSERT WITH CHECK (true);
