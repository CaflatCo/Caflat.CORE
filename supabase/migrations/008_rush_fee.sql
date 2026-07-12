-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Rush order fee
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- A per-client, per-portal setting: requesting delivery within a short
-- window (default 24h) adds a fee (default 5%) to the order total. Applies
-- wherever a delivery date is picked — the standard sale-mode checkout
-- (optional #reqDate) and the consignment Restock request (required
-- #restockDate) both call submit_portal_order, so this one RPC change
-- covers both surfaces.
--
-- Like every other price-affecting field, the fee is always recomputed
-- server-side from the portal's published config and the submitted date —
-- never trusted from the client, matching the existing re-pricing pattern
-- for catalog items.
--
-- Fully backward-compatible: existing portals default to rush_fee enabled
-- at 24h/5%, matching what a fresh client publish would produce; a cafe
-- that wants it off just unchecks it in the Client Portal modal.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.order_portals
  ADD COLUMN IF NOT EXISTS rush_fee jsonb NOT NULL
    DEFAULT '{"enabled": true, "thresholdHrs": 24, "percent": 5}'::jsonb;

ALTER TABLE public.portal_orders
  ADD COLUMN IF NOT EXISTS rush_fee numeric NOT NULL DEFAULT 0;

-- ── get_order_portal: expose rush_fee so order.html can show a notice
-- before the client even picks a date (a client-side estimate only — the
-- actual charged amount is always recomputed server-side on submit). ──
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
    'rush_fee',         op.rush_fee,
    'updated_at',       op.updated_at
  )
  FROM public.order_portals op
  WHERE op.token = p_token AND NOT op.revoked;
$$;

-- ── submit_portal_order: recompute the rush fee server-side ──
-- Same signature as before — no DROP FUNCTION needed, arg types unchanged.
-- p_requested_date::timestamptz casts a date-only value to midnight UTC;
-- that's the agreed reference point (no per-tenant timezone concept exists
-- today), and the client-side estimate uses the same reference so the
-- notice never contradicts what's actually charged.
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
  v_portal      public.order_portals%ROWTYPE;
  v_line        jsonb;
  v_cat         jsonb;
  v_qty         numeric;
  v_price       numeric;
  v_mult        numeric;
  v_items       jsonb := '[]'::jsonb;
  v_subtotal    numeric := 0;
  v_count       int := 0;
  v_id          uuid;
  v_rush_fee    numeric := 0;
  v_hours_until numeric;
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

  -- Rush fee: a delivery request within the configured threshold of "now"
  -- adds percent% to the subtotal, applied before the split-payment bounds
  -- check below (which must validate against the fee-inclusive total).
  IF p_requested_date IS NOT NULL
     AND COALESCE((v_portal.rush_fee->>'enabled')::boolean, true) THEN
    v_hours_until := EXTRACT(EPOCH FROM (p_requested_date::timestamptz - now())) / 3600;
    IF v_hours_until <= COALESCE((v_portal.rush_fee->>'thresholdHrs')::numeric, 24) THEN
      v_rush_fee := ROUND(v_subtotal * COALESCE((v_portal.rush_fee->>'percent')::numeric, 5) / 100, 2);
    END IF;
  END IF;
  v_subtotal := v_subtotal + v_rush_fee;

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
     payment_method, payment_reference, payment_split, payment_proof, subtotal, rush_fee,
     payment_method_2, payment_amount_2, payment_reference_2)
  VALUES
    (v_portal.token, v_portal.tenant_id, v_portal.client_id, v_portal.client_name,
     v_items, LEFT(COALESCE(p_notes, ''), 2000), p_requested_date,
     LEFT(COALESCE(p_payment_method, ''), 120),
     LEFT(COALESCE(p_payment_reference, ''), 200),
     p_payment_split, COALESCE(p_payment_proof, ''), v_subtotal, v_rush_fee,
     LEFT(COALESCE(p_payment_method_2, ''), 120),
     CASE WHEN COALESCE(p_payment_method_2, '') <> '' THEN ROUND(p_payment_amount_2, 2) ELSE 0 END,
     LEFT(COALESCE(p_payment_reference_2, ''), 200))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',        v_id,
    'reference', UPPER(LEFT(REPLACE(v_id::text, '-', ''), 8)),
    'subtotal',  v_subtotal,
    'rush_fee',  v_rush_fee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_portal_order(text, jsonb, text, date, text, text, text, text, text, numeric, text) TO anon;

-- Force PostgREST to pick up the (re)created functions immediately.
NOTIFY pgrst, 'reload schema';
