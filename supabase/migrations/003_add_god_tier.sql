-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Add 'god' tier to licenses check constraint
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_tier_check
  CHECK (tier IN ('free', 'pro', 'cloud', 'enterprise', 'god'));
