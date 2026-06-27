-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Initial Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- ── 1. LICENSES ──────────────────────────────────────
-- One row per café. You create rows here manually to
-- issue a license key to a new client.
CREATE TABLE IF NOT EXISTS public.licenses (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text        NOT NULL UNIQUE,          -- the key the café enters, e.g. CAFL-XXXX-XXXX
  tier             text        NOT NULL DEFAULT 'pro',   -- free | pro | cloud | enterprise
  client_name      text        NOT NULL,                 -- café name
  tenant_id        uuid        NOT NULL DEFAULT gen_random_uuid(), -- data isolation ID
  expires_at       timestamptz,                          -- null = lifetime
  activated        boolean     NOT NULL DEFAULT false,
  activated_at     timestamptz,
  activated_device text,                                 -- hashed device fingerprint
  revoked          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 2. SYNC_LOG ──────────────────────────────────────
-- One row per sync push from any device.
-- The app keeps the newest 20 rows per tenant (prunes older ones).
CREATE TABLE IF NOT EXISTS public.sync_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  device_id             text,
  sync_version          integer     DEFAULT 1,
  pushed_at             timestamptz NOT NULL DEFAULT now(),

  -- Append-only collections
  sales                 jsonb       DEFAULT '[]',
  "auditLog"            jsonb       DEFAULT '[]',
  "inventoryMovements"  jsonb       DEFAULT '[]',

  -- Last-write-wins collections
  products              jsonb       DEFAULT '[]',
  ingredients           jsonb       DEFAULT '[]',
  "finishedGoods"       jsonb       DEFAULT '[]',
  "supplyOrders"        jsonb       DEFAULT '[]',
  "supplierClients"     jsonb       DEFAULT '[]',
  "productionJobs"      jsonb       DEFAULT '[]',
  "productionTemplates" jsonb       DEFAULT '[]',
  events                jsonb       DEFAULT '[]',
  "eventPackages"       jsonb       DEFAULT '[]',
  leads                 jsonb       DEFAULT '[]',
  "recipeCatalog"       jsonb       DEFAULT '[]',
  "labDrafts"           jsonb       DEFAULT '[]',

  -- Config
  settings              jsonb       DEFAULT '{}',
  categories            jsonb       DEFAULT '[]',

  -- Counters
  "receiptCounter"      integer     DEFAULT 0,
  "supplyInvoiceCounter" integer    DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_log_tenant_pushed
  ON public.sync_log (tenant_id, pushed_at DESC);

-- ── 3. BACKUPS ───────────────────────────────────────
-- Full app-state snapshots. The app keeps the last 3 per tenant.
CREATE TABLE IF NOT EXISTS public.backups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  snapshot    jsonb       NOT NULL,   -- full APP_STATE dump
  app_version text,
  device_id   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backups_tenant_created
  ON public.backups (tenant_id, created_at DESC);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- The app uses the anon key (no per-user auth).
-- Policies allow anon access; tenant isolation is enforced
-- at the app level via tenant_id from the license.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.licenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups   ENABLE ROW LEVEL SECURITY;

-- Licenses: anon can look up and activate keys
DROP POLICY IF EXISTS "anon_select_licenses" ON public.licenses;
CREATE POLICY "anon_select_licenses" ON public.licenses
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_licenses" ON public.licenses;
CREATE POLICY "anon_update_licenses" ON public.licenses
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Sync log: anon can read/write/delete
DROP POLICY IF EXISTS "anon_all_sync_log" ON public.sync_log;
CREATE POLICY "anon_all_sync_log" ON public.sync_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Backups: anon can read/write/delete
DROP POLICY IF EXISTS "anon_all_backups" ON public.backups;
CREATE POLICY "anon_all_backups" ON public.backups
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- SAMPLE LICENSE (delete or replace before going live)
-- This gives you a CLOUD-tier key to test with.
-- ═══════════════════════════════════════════════════════

INSERT INTO public.licenses (code, tier, client_name, expires_at)
VALUES (
  'CAFL-TEST-0001',
  'cloud',
  'Caflat Test Cafe',
  now() + interval '1 year'
)
ON CONFLICT (code) DO NOTHING;
