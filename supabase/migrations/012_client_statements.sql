-- ═══════════════════════════════════════════════════════
-- 012 — Shareable Client Statements
--   client_statements: one row per (tenant, client), payload snapshot
--     refreshed each time the owner shares/re-shares from the app
--   get_client_statement(p_token): read-only RPC for statement.html
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- The statement itself (aging buckets, unpaid invoice list, optional
-- payment info) is computed client-side from the owner's local supply
-- orders — there is no server-side orders table to query — and pushed
-- here as a jsonb snapshot whenever "Share Statement" is clicked.
-- client_key is the app's local client id (stable per tenant, not
-- globally unique, so it is scoped by tenant_id in the unique index).
CREATE TABLE IF NOT EXISTS public.client_statements (
  id         bigserial   PRIMARY KEY,
  tenant_id  uuid        NOT NULL,
  client_key text        NOT NULL,
  token_hash text        NOT NULL UNIQUE,
  payload    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  revoked    boolean     NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_key)
);

CREATE INDEX IF NOT EXISTS client_statements_tenant
  ON public.client_statements (tenant_id);

-- RLS: same anon-all-with-app-level-isolation model as the rest of the
-- schema (migrations 004/011) — the app always scopes writes by its own
-- tenant_id, and reads only ever happen through the SECURITY DEFINER RPC.
ALTER TABLE public.client_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_client_statements" ON public.client_statements;
CREATE POLICY "anon_all_client_statements" ON public.client_statements
  FOR ALL USING (true) WITH CHECK (true);

-- Keep updated_at current on every upsert (the app POSTs with
-- on_conflict=tenant_id,client_key + Prefer: resolution=merge-duplicates).
CREATE OR REPLACE FUNCTION public._client_statements_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_statements_touch ON public.client_statements;
CREATE TRIGGER client_statements_touch
  BEFORE UPDATE ON public.client_statements
  FOR EACH ROW EXECUTE FUNCTION public._client_statements_touch();

-- Read-only entry point for statement.html. SECURITY DEFINER so the page
-- only ever holds a token, never a tenant id or client id; a revoked
-- token dies instantly.
CREATE OR REPLACE FUNCTION public.get_client_statement(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row client_statements;
BEGIN
  SELECT * INTO v_row
  FROM client_statements
  WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    AND NOT revoked
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  RETURN jsonb_build_object('ok', true, 'statement', v_row.payload, 'updated_at', v_row.updated_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_statement(text) TO anon;
