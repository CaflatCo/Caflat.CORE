-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Tenant-scoped RLS for backups & sync_log
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- The app sends x-tenant-id as a custom request header.
-- PostgREST exposes all request headers via
-- current_setting('request.headers', true) as JSON.
-- These policies enforce that each tenant can only
-- read/write their own rows at the database level.
-- ═══════════════════════════════════════════════════════

-- ── Helper: extract tenant_id from request header ────
-- Returns NULL if the header is absent (blocks access).
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-tenant-id',
    ''
  )::uuid;
$$;

-- ── BACKUPS — tenant-isolated ─────────────────────────
DROP POLICY IF EXISTS "anon_all_backups"      ON public.backups;
DROP POLICY IF EXISTS "tenant_own_backups"    ON public.backups;

CREATE POLICY "tenant_own_backups" ON public.backups
  FOR ALL TO anon
  USING     (tenant_id = auth.tenant_id())
  WITH CHECK(tenant_id = auth.tenant_id());

-- ── SYNC_LOG — tenant-isolated ────────────────────────
DROP POLICY IF EXISTS "anon_all_sync_log"     ON public.sync_log;
DROP POLICY IF EXISTS "tenant_own_sync_log"   ON public.sync_log;

CREATE POLICY "tenant_own_sync_log" ON public.sync_log
  FOR ALL TO anon
  USING     (tenant_id = auth.tenant_id())
  WITH CHECK(tenant_id = auth.tenant_id());

-- ── LICENSES — unchanged (anon reads any, updates own) ─
-- No change needed — license lookup is by code, not tenant.
