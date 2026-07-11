-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Client Order Portals
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- Powers the shareable B2B order form (order.html?t=TOKEN):
--   · order_portals  — per-client published catalog + prices
--   · portal_orders  — inbox of orders submitted by clients
--
-- Access model:
--   · The cafe app reads/writes its own rows via the existing
--     x-tenant-id header pattern (public.tenant_id(), see 002).
--   · B2B clients (no tenant header) get NO direct table access.
--     They go through two SECURITY DEFINER functions that look
--     up by unguessable token and re-price everything server-side.
-- ═══════════════════════════════════════════════════════

-- ── ORDER_PORTALS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_portals (
  token            text        PRIMARY KEY,
  tenant_id        uuid        NOT NULL,
  client_id        text        NOT NULL,
  client_name      text        NOT NULL DEFAULT '',
  brand_name       text        NOT NULL DEFAULT '',
  currency         text        NOT NULL DEFAULT 'PHP',
  currency_symbol  text        NOT NULL DEFAULT '₱',
  -- [{ productId, name, category, price, multiple, priceTiers? }]
  -- priceTiers (optional, added in 005): [{ minQty, price }] — quantity
  -- price breaks, present only when this client has no negotiated
  -- custom/percent/amount override for that product.
  catalog          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ name, type: cash|qr|bank|invoice, qrImage?, bankName?, accountNumber? }]
  payment_methods  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  revoked          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id)          -- upsert key for republish
);

-- ── PORTAL_ORDERS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text        NOT NULL REFERENCES public.order_portals(token)
                                ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id         uuid        NOT NULL,
  client_id         text        NOT NULL,
  client_name       text        NOT NULL DEFAULT '',
  -- [{ productId, name, qty, unitPrice, total }] — priced server-side
  items             jsonb       NOT NULL,
  notes             text        NOT NULL DEFAULT '',
  requested_date    date,
  payment_method    text        NOT NULL DEFAULT '',
  payment_reference text        NOT NULL DEFAULT '',
  payment_split     text        NOT NULL DEFAULT 'full',   -- full | half (50% downpayment)
  payment_proof     text        NOT NULL DEFAULT '',       -- data-URL screenshot of the transfer
  subtotal          numeric     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'pending',  -- pending | imported
  created_at        timestamptz NOT NULL DEFAULT now(),
  imported_at       timestamptz
);

-- Upgrades for installs that ran an earlier version of this file
ALTER TABLE public.portal_orders
  ADD COLUMN IF NOT EXISTS payment_split text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS payment_proof text NOT NULL DEFAULT '';

-- Optional second payment method — a client can split the (full) order
-- total across two methods, e.g. part GCash + part cash. Empty method_2
-- means no split; the primary payment_method/payment_reference above
-- always describe the first (or only) method.
ALTER TABLE public.portal_orders
  ADD COLUMN IF NOT EXISTS payment_method_2    text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_amount_2    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference_2 text    NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS portal_orders_inbox
  ON public.portal_orders (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS portal_orders_token_created
  ON public.portal_orders (token, created_at);

ALTER TABLE public.order_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_orders ENABLE ROW LEVEL SECURITY;

-- ── RLS: cafe app only (tenant header) — clients get nothing ──
DROP POLICY IF EXISTS "tenant_own_order_portals" ON public.order_portals;
CREATE POLICY "tenant_own_order_portals" ON public.order_portals
  FOR ALL TO anon
  USING      (tenant_id = public.tenant_id())
  WITH CHECK (tenant_id = public.tenant_id());

DROP POLICY IF EXISTS "tenant_own_portal_orders" ON public.portal_orders;
CREATE POLICY "tenant_own_portal_orders" ON public.portal_orders
  FOR ALL TO anon
  USING      (tenant_id = public.tenant_id())
  WITH CHECK (tenant_id = public.tenant_id());

-- ── RPC: fetch a portal by token (public, for order.html) ──
-- SECURITY DEFINER bypasses RLS; the token is the credential.
-- Never returns tenant_id, and returns nothing for revoked links.
CREATE OR REPLACE FUNCTION public.get_order_portal(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'client_name',     op.client_name,
    'brand_name',      op.brand_name,
    'currency',        op.currency,
    'currency_symbol', op.currency_symbol,
    'catalog',         op.catalog,
    'payment_methods', op.payment_methods,
    'updated_at',      op.updated_at
  )
  FROM public.order_portals op
  WHERE op.token = p_token AND NOT op.revoked;
$$;

-- ── RPC: submit an order (public, for order.html) ──
-- Client sends only {productId, qty} lines. Every line is re-priced
-- from the published catalog so a tampered page cannot alter prices.
-- Drop every previous signature so re-running doesn't leave an overload behind.
DROP FUNCTION IF EXISTS public.submit_portal_order(text, jsonb, text, date, text, text);
DROP FUNCTION IF EXISTS public.submit_portal_order(text, jsonb, text, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_portal_order(
  p_token                text,
  p_items                jsonb,               -- [{ productId, qty }]
  p_notes                text    DEFAULT '',
  p_requested_date       date    DEFAULT NULL,
  p_payment_method       text    DEFAULT '',
  p_payment_reference    text    DEFAULT '',
  p_payment_split        text    DEFAULT 'full',   -- full | half
  p_payment_proof        text    DEFAULT '',        -- data-URL image
  p_payment_method_2     text    DEFAULT '',        -- optional second method (split payment)
  p_payment_amount_2     numeric DEFAULT 0,         -- amount paid via the second method
  p_payment_reference_2  text    DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal   public.order_portals%ROWTYPE;
  v_line     jsonb;
  v_cat      jsonb;
  v_qty      numeric;
  v_price    numeric;
  v_mult     numeric;
  v_items    jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_count    int := 0;
  v_id       uuid;
BEGIN
  SELECT * INTO v_portal
    FROM public.order_portals
    WHERE token = p_token AND NOT revoked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order link is no longer active';
  END IF;

  -- Serialize concurrent submissions for this token so the rate-limit
  -- check-then-insert below can't be raced by parallel requests. Held
  -- for the transaction; released automatically on commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext(p_token));

  -- Rate limits per link: a leaked/forwarded link can't flood the inbox.
  IF (SELECT count(*) FROM public.portal_orders
      WHERE token = p_token AND created_at > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'Please wait a few minutes before sending another order';
  END IF;
  IF (SELECT count(*) FROM public.portal_orders
      WHERE token = p_token AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Daily order limit reached — contact your supplier directly';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order has no items';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'Too many order lines';
  END IF;

  -- Validate payment method against what the cafe published
  IF COALESCE(p_payment_method, '') <> '' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_portal.payment_methods) pm
    WHERE pm->>'name' = p_payment_method
  ) THEN
    RAISE EXCEPTION 'Unknown payment method';
  END IF;

  IF p_payment_split NOT IN ('full', 'half') THEN
    RAISE EXCEPTION 'Invalid settlement option';
  END IF;

  -- Optional split payment: a second method must be a different, published
  -- method. Its amount is bounds-checked once the order total is known below.
  IF COALESCE(p_payment_method_2, '') <> '' THEN
    IF p_payment_method_2 = p_payment_method THEN
      RAISE EXCEPTION 'Choose two different payment methods to split payment';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_portal.payment_methods) pm
      WHERE pm->>'name' = p_payment_method_2
    ) THEN
      RAISE EXCEPTION 'Unknown second payment method';
    END IF;
  END IF;

  -- Proof screenshot: must be an inline image and reasonably sized (~1.5 MB)
  IF COALESCE(p_payment_proof, '') <> '' THEN
    IF p_payment_proof !~ '^data:image/' THEN
      RAISE EXCEPTION 'Payment proof must be an image';
    END IF;
    IF length(p_payment_proof) > 2000000 THEN
      RAISE EXCEPTION 'Payment screenshot is too large — please attach a smaller image';
    END IF;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := LEAST(GREATEST(COALESCE((v_line->>'qty')::numeric, 0), 0), 9999);
    CONTINUE WHEN v_qty <= 0;

    SELECT c INTO v_cat
      FROM jsonb_array_elements(v_portal.catalog) c
      WHERE c->>'productId' = v_line->>'productId'
      LIMIT 1;
    IF v_cat IS NULL THEN
      RAISE EXCEPTION 'Unknown product in order';
    END IF;

    -- Enforce sold-in-multiples when the cafe configured one for this product
    v_mult := GREATEST(COALESCE((v_cat->>'multiple')::numeric, 1), 1);
    IF v_mult > 1 AND (v_qty::numeric % v_mult) <> 0 THEN
      RAISE EXCEPTION '% is sold in multiples of %', v_cat->>'name', v_mult::int;
    END IF;

    v_price := ROUND((v_cat->>'price')::numeric, 2);
    v_items := v_items || jsonb_build_object(
      'productId', v_cat->>'productId',
      'name',      v_cat->>'name',
      'qty',       v_qty,
      'unitPrice', v_price,
      'total',     ROUND(v_price * v_qty, 2)
    );
    v_subtotal := v_subtotal + ROUND(v_price * v_qty, 2);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Order has no items';
  END IF;

  IF COALESCE(p_payment_method_2, '') <> '' THEN
    IF p_payment_amount_2 IS NULL OR p_payment_amount_2 <= 0 THEN
      RAISE EXCEPTION 'Enter how much will be paid via the second method';
    END IF;
    IF p_payment_amount_2 >= v_subtotal THEN
      RAISE EXCEPTION 'The second payment amount must be less than the order total';
    END IF;
  END IF;

  INSERT INTO public.portal_orders
    (token, tenant_id, client_id, client_name, items, notes, requested_date,
     payment_method, payment_reference, payment_split, payment_proof, subtotal,
     payment_method_2, payment_amount_2, payment_reference_2)
  VALUES
    (v_portal.token, v_portal.tenant_id, v_portal.client_id, v_portal.client_name,
     v_items, LEFT(COALESCE(p_notes, ''), 2000), p_requested_date,
     LEFT(COALESCE(p_payment_method, ''), 120),
     LEFT(COALESCE(p_payment_reference, ''), 200),
     p_payment_split, COALESCE(p_payment_proof, ''), v_subtotal,
     LEFT(COALESCE(p_payment_method_2, ''), 120),
     CASE WHEN COALESCE(p_payment_method_2, '') <> '' THEN ROUND(p_payment_amount_2, 2) ELSE 0 END,
     LEFT(COALESCE(p_payment_reference_2, ''), 200))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',        v_id,
    'reference', UPPER(LEFT(REPLACE(v_id::text, '-', ''), 8)),
    'subtotal',  v_subtotal
  );
END;
$$;

-- Only these two entry points are exposed to the public form
GRANT EXECUTE ON FUNCTION public.get_order_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_portal_order(text, jsonb, text, date, text, text, text, text, text, numeric, text) TO anon;

-- Force PostgREST to pick up the (re)created functions immediately —
-- without this, "Could not find the function ... in the schema cache"
-- can persist for a while after a DDL change even though the function
-- exists and is correctly granted.
NOTIFY pgrst, 'reload schema';
