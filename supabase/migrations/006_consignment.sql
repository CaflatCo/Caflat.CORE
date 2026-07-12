-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Consignment terms for the client portal
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- Adds a per-client CONSIGNMENT mode to the shareable order portal.
-- In consignment, the cafe places stock WITH the client; the client
-- only owes for what actually sells. The portal becomes a "report what
-- sold" account instead of a buy-and-pay store:
--   · consignment_stock — per client/product on-hand balance (source of
--       truth for the portal's math). Seeded when the cafe marks a
--       consignment delivery DELIVERED; drawn down by sell-through reports.
--   · portal_reports    — inbox of sell-through reports the client submits
--       (counts what's left; server computes sold = on_hand − remaining
--       − damaged, and prices the sold units).
--   · order_portals gains terms_mode + settlement_modes (published per
--       client) so order.html knows which experience to render.
--
-- Access model is identical to 004: the cafe app reads/writes its own
-- rows via the x-tenant-id header (public.tenant_id()); B2B clients get
-- NO direct table access and go through SECURITY DEFINER functions keyed
-- by unguessable token that re-price everything server-side.
--
-- Fully backward-compatible: existing portals default to terms_mode
-- 'sale' and behave exactly as before.
-- ═══════════════════════════════════════════════════════

-- ── ORDER_PORTALS: per-client consignment settings ────────
ALTER TABLE public.order_portals
  ADD COLUMN IF NOT EXISTS terms_mode text NOT NULL DEFAULT 'sale',  -- sale | consignment
  -- { payNow: bool, invoiceAfter: bool } — which settlement paths the
  -- client may use when reporting sell-through. Only meaningful for
  -- terms_mode 'consignment'.
  ADD COLUMN IF NOT EXISTS settlement_modes jsonb NOT NULL
    DEFAULT '{"payNow": false, "invoiceAfter": true}'::jsonb;

-- ── CONSIGNMENT_STOCK: per client/product on-hand balance ──
-- Written by the cafe app (tenant header, RLS below). Read + drawn down
-- by the public RPCs via SECURITY DEFINER. unit_price is the consignment
-- price locked for this client/product (what they owe per sold unit).
CREATE TABLE IF NOT EXISTS public.consignment_stock (
  tenant_id    uuid        NOT NULL,
  client_id    text        NOT NULL,
  product_id   text        NOT NULL,
  product_name text        NOT NULL DEFAULT '',
  category     text        NOT NULL DEFAULT '',
  on_hand      numeric     NOT NULL DEFAULT 0,
  unit_price   numeric     NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, product_id)
);

CREATE INDEX IF NOT EXISTS consignment_stock_client
  ON public.consignment_stock (tenant_id, client_id);

-- ── PORTAL_REPORTS: sell-through reports submitted by clients ──
CREATE TABLE IF NOT EXISTS public.portal_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text        NOT NULL REFERENCES public.order_portals(token)
                                ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id         uuid        NOT NULL,
  client_id         text        NOT NULL,
  client_name       text        NOT NULL DEFAULT '',
  -- [{ productId, name, priorOnHand, remaining, sold, damaged, unitPrice, total }]
  -- priced server-side from consignment_stock.unit_price
  items             jsonb       NOT NULL,
  notes             text        NOT NULL DEFAULT '',
  settlement        text        NOT NULL DEFAULT 'invoice',  -- invoice | pay_now
  payment_method    text        NOT NULL DEFAULT '',
  payment_reference text        NOT NULL DEFAULT '',
  payment_proof     text        NOT NULL DEFAULT '',         -- data-URL screenshot
  subtotal          numeric     NOT NULL DEFAULT 0,          -- amount due (sold value)
  status            text        NOT NULL DEFAULT 'pending',  -- pending | reconciled
  created_at        timestamptz NOT NULL DEFAULT now(),
  reconciled_at     timestamptz
);

CREATE INDEX IF NOT EXISTS portal_reports_inbox
  ON public.portal_reports (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS portal_reports_token_created
  ON public.portal_reports (token, created_at);

ALTER TABLE public.consignment_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_reports    ENABLE ROW LEVEL SECURITY;

-- ── RLS: cafe app only (tenant header) — clients get nothing ──
DROP POLICY IF EXISTS "tenant_own_consignment_stock" ON public.consignment_stock;
CREATE POLICY "tenant_own_consignment_stock" ON public.consignment_stock
  FOR ALL TO anon
  USING      (tenant_id = public.tenant_id())
  WITH CHECK (tenant_id = public.tenant_id());

DROP POLICY IF EXISTS "tenant_own_portal_reports" ON public.portal_reports;
CREATE POLICY "tenant_own_portal_reports" ON public.portal_reports
  FOR ALL TO anon
  USING      (tenant_id = public.tenant_id())
  WITH CHECK (tenant_id = public.tenant_id());

-- ── RPC: extend get_order_portal to expose terms + settlement modes ──
-- Additive: sale portals gain two extra fields, behavior unchanged.
CREATE OR REPLACE FUNCTION public.get_order_portal(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'client_name',      op.client_name,
    'brand_name',       op.brand_name,
    'currency',         op.currency,
    'currency_symbol',  op.currency_symbol,
    'catalog',          op.catalog,
    'payment_methods',  op.payment_methods,
    'terms_mode',       op.terms_mode,
    'settlement_modes', op.settlement_modes,
    'updated_at',       op.updated_at
  )
  FROM public.order_portals op
  WHERE op.token = p_token AND NOT op.revoked;
$$;

-- ── RPC: fetch consignment on-hand for a token (public, order.html) ──
-- Returns the client's current on-hand lines so the portal can render the
-- "On Hand" and "Report Sales" tabs. Never returns tenant_id; empty for
-- revoked or non-consignment portals.
CREATE OR REPLACE FUNCTION public.get_consignment_portal(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'on_hand', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'productId',  cs.product_id,
        'name',       cs.product_name,
        'category',   cs.category,
        'onHand',     cs.on_hand,
        'unitPrice',  cs.unit_price
      ) ORDER BY cs.product_name)
      FROM public.consignment_stock cs
      WHERE cs.tenant_id = op.tenant_id
        AND cs.client_id = op.client_id
        AND cs.on_hand > 0
    ), '[]'::jsonb)
  )
  FROM public.order_portals op
  WHERE op.token = p_token AND NOT op.revoked
    AND op.terms_mode = 'consignment';
$$;

-- ── RPC: submit a sell-through report (public, order.html) ──
-- Client sends {productId, remaining, damaged} per line (counts what's left).
-- Server computes sold = on_hand − remaining − damaged, prices sold units
-- from consignment_stock.unit_price (a tampered page can't alter prices),
-- sets on_hand := remaining, and files a pending report for the cafe to
-- reconcile. Damaged units leave on-hand as a write-off, not billed.
CREATE OR REPLACE FUNCTION public.submit_sell_through(
  p_token             text,
  p_lines             jsonb,               -- [{ productId, remaining, damaged }]
  p_notes             text    DEFAULT '',
  p_settlement        text    DEFAULT 'invoice',   -- invoice | pay_now
  p_payment_method    text    DEFAULT '',
  p_payment_reference text    DEFAULT '',
  p_payment_proof     text    DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal    public.order_portals%ROWTYPE;
  v_line      jsonb;
  v_stock     public.consignment_stock%ROWTYPE;
  v_remaining numeric;
  v_damaged   numeric;
  v_sold      numeric;
  v_price     numeric;
  v_items     jsonb := '[]'::jsonb;
  v_subtotal  numeric := 0;
  v_count     int := 0;
  v_id        uuid;
BEGIN
  SELECT * INTO v_portal
    FROM public.order_portals
    WHERE token = p_token AND NOT revoked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order link is no longer active';
  END IF;
  IF v_portal.terms_mode <> 'consignment' THEN
    RAISE EXCEPTION 'This link is not a consignment account';
  END IF;

  -- Serialize concurrent submissions for this token (see 004 for rationale).
  PERFORM pg_advisory_xact_lock(hashtext(p_token));

  -- Rate limits per link.
  IF (SELECT count(*) FROM public.portal_reports
      WHERE token = p_token AND created_at > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'Please wait a few minutes before sending another report';
  END IF;
  IF (SELECT count(*) FROM public.portal_reports
      WHERE token = p_token AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Daily report limit reached — contact your supplier directly';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Report has no items';
  END IF;
  IF jsonb_array_length(p_lines) > 200 THEN
    RAISE EXCEPTION 'Too many report lines';
  END IF;

  IF p_settlement NOT IN ('invoice', 'pay_now') THEN
    RAISE EXCEPTION 'Invalid settlement option';
  END IF;

  -- pay_now requires the cafe to have enabled it and a valid published method.
  IF p_settlement = 'pay_now' THEN
    IF NOT COALESCE((v_portal.settlement_modes->>'payNow')::boolean, false) THEN
      RAISE EXCEPTION 'Pay-now is not enabled for this account';
    END IF;
    IF COALESCE(p_payment_method, '') <> '' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_portal.payment_methods) pm
      WHERE pm->>'name' = p_payment_method
    ) THEN
      RAISE EXCEPTION 'Unknown payment method';
    END IF;
    IF COALESCE(p_payment_proof, '') <> '' THEN
      IF p_payment_proof !~ '^data:image/' THEN
        RAISE EXCEPTION 'Payment proof must be an image';
      END IF;
      IF length(p_payment_proof) > 2000000 THEN
        RAISE EXCEPTION 'Payment screenshot is too large — please attach a smaller image';
      END IF;
    END IF;
  ELSE
    IF NOT COALESCE((v_portal.settlement_modes->>'invoiceAfter')::boolean, true) THEN
      RAISE EXCEPTION 'Invoice-later is not enabled for this account';
    END IF;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_stock
      FROM public.consignment_stock
      WHERE tenant_id = v_portal.tenant_id
        AND client_id = v_portal.client_id
        AND product_id = v_line->>'productId';
    -- Can't report on stock the client was never given.
    CONTINUE WHEN NOT FOUND;

    v_remaining := LEAST(GREATEST(COALESCE((v_line->>'remaining')::numeric, 0), 0), v_stock.on_hand);
    v_damaged   := LEAST(GREATEST(COALESCE((v_line->>'damaged')::numeric, 0), 0),
                         v_stock.on_hand - v_remaining);
    v_sold      := v_stock.on_hand - v_remaining - v_damaged;
    IF v_sold < 0 THEN v_sold := 0; END IF;

    v_price := ROUND(v_stock.unit_price, 2);

    v_items := v_items || jsonb_build_object(
      'productId',   v_stock.product_id,
      'name',        v_stock.product_name,
      'priorOnHand', v_stock.on_hand,
      'remaining',   v_remaining,
      'sold',        v_sold,
      'damaged',     v_damaged,
      'unitPrice',   v_price,
      'total',       ROUND(v_price * v_sold, 2)
    );
    v_subtotal := v_subtotal + ROUND(v_price * v_sold, 2);
    v_count := v_count + 1;

    -- Physical count is truth: the remaining count becomes the new on-hand.
    UPDATE public.consignment_stock
      SET on_hand = v_remaining, updated_at = now()
      WHERE tenant_id = v_stock.tenant_id
        AND client_id = v_stock.client_id
        AND product_id = v_stock.product_id;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Report has no matching products';
  END IF;

  INSERT INTO public.portal_reports
    (token, tenant_id, client_id, client_name, items, notes, settlement,
     payment_method, payment_reference, payment_proof, subtotal)
  VALUES
    (v_portal.token, v_portal.tenant_id, v_portal.client_id, v_portal.client_name,
     v_items, LEFT(COALESCE(p_notes, ''), 2000), p_settlement,
     LEFT(COALESCE(p_payment_method, ''), 120),
     LEFT(COALESCE(p_payment_reference, ''), 200),
     COALESCE(p_payment_proof, ''), v_subtotal)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',        v_id,
    'reference', UPPER(LEFT(REPLACE(v_id::text, '-', ''), 8)),
    'subtotal',  v_subtotal
  );
END;
$$;

-- Only these entry points are exposed to the public form
GRANT EXECUTE ON FUNCTION public.get_order_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_consignment_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_sell_through(text, jsonb, text, text, text, text, text) TO anon;

-- Force PostgREST to pick up the (re)created functions immediately.
NOTIFY pgrst, 'reload schema';
