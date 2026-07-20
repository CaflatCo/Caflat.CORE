-- ═══════════════════════════════════════════════════════
-- 011 — Remote Owner Dashboard
--   kpi_snapshots: one tiny row per tenant per day, upserted by the app
--   remote_tokens: revocable share tokens (stored hashed)
--   get_remote_dashboard(p_token): read-only RPC for remote.html
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Daily KPI snapshots (small on purpose: the remote page never needs the
-- full multi-MB backup, just the headline numbers)
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
  id             bigserial PRIMARY KEY,
  tenant_id      uuid        NOT NULL,
  day            date        NOT NULL,
  brand          text,
  revenue        numeric     NOT NULL DEFAULT 0,
  orders         integer     NOT NULL DEFAULT 0,
  items          integer     NOT NULL DEFAULT 0,
  avg_ticket     numeric     NOT NULL DEFAULT 0,
  low_stock      integer     NOT NULL DEFAULT 0,
  pending_orders integer     NOT NULL DEFAULT 0,
  top_product    text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, day)
);

CREATE INDEX IF NOT EXISTS kpi_snapshots_tenant_day
  ON public.kpi_snapshots (tenant_id, day DESC);

-- Share tokens for the read-only remote dashboard. Only the SHA-256 hex
-- of the token is stored; the plain token lives in the owner's link.
CREATE TABLE IF NOT EXISTS public.remote_tokens (
  id         bigserial   PRIMARY KEY,
  tenant_id  uuid        NOT NULL,
  token_hash text        NOT NULL UNIQUE,
  label      text,
  revoked    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS remote_tokens_tenant
  ON public.remote_tokens (tenant_id);

-- RLS: same model as the rest of the schema — anon access with app-level
-- tenant isolation (the app always filters by its own tenant_id).
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_kpi_snapshots" ON public.kpi_snapshots;
CREATE POLICY "anon_all_kpi_snapshots" ON public.kpi_snapshots
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_remote_tokens" ON public.remote_tokens;
CREATE POLICY "anon_all_remote_tokens" ON public.remote_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- Read-only entry point for remote.html. SECURITY DEFINER so the page
-- only ever holds a token, never a tenant id; a revoked token dies
-- instantly. Returns today's snapshot plus the last 7 days.
CREATE OR REPLACE FUNCTION public.get_remote_dashboard(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant uuid;
  v_today  jsonb;
  v_series jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant
  FROM remote_tokens
  WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    AND NOT revoked
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT to_jsonb(k) - 'id' - 'tenant_id' INTO v_today
  FROM kpi_snapshots k
  WHERE k.tenant_id = v_tenant
  ORDER BY k.day DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(row ORDER BY row->>'day'), '[]'::jsonb) INTO v_series
  FROM (
    SELECT to_jsonb(k) - 'id' - 'tenant_id' AS row
    FROM kpi_snapshots k
    WHERE k.tenant_id = v_tenant
      AND k.day >= (current_date - INTERVAL '6 days')
  ) s;

  RETURN jsonb_build_object('ok', true, 'today', v_today, 'series', v_series);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remote_dashboard(text) TO anon;
