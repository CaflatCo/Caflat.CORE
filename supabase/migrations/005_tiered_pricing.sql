-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Volume (quantity-tiered) pricing for Supply
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- Adds optional server-side support for quantity price breaks
-- (e.g. 20+ units of a product drops the unit price). Products may
-- carry a `priceTiers: [{minQty, price}]` array; when a client isn't
-- on a negotiated custom/percent/amount rate for that product, the
-- published order_portals.catalog entry now carries that same
-- `priceTiers` array through unchanged. This migration teaches
-- submit_portal_order to resolve the correct tier from the
-- submitted qty, so the client's own browser is never trusted to
-- report a unit price (same trust model as the original catalog
-- price re-pricing from 004).
--
--   catalog entries now optionally look like:
--     { productId, name, category, price, multiple, priceTiers? }
--     priceTiers: [{ minQty, price }, ...]
-- ═══════════════════════════════════════════════════════

-- ── RPC: submit an order (public, for order.html) ──
-- Same signature as 004 — only the body's pricing step changes.
DROP FUNCTION IF EXISTS public.submit_portal_order(text, jsonb, text, date, text, text, text, text, text, numeric, text);

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
  v_portal       public.order_portals%ROWTYPE;
  v_line         jsonb;
  v_cat          jsonb;
  v_qty          numeric;
  v_price        numeric;
  v_tiered_price numeric;
  v_mult         numeric;
  v_items        jsonb := '[]'::jsonb;
  v_subtotal     numeric := 0;
  v_count        int := 0;
  v_id           uuid;
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

    -- Base/flat price, then override with the highest volume-pricing tier
    -- the submitted qty qualifies for, if the catalog entry carries any
    -- (a client on a negotiated custom/percent/amount rate never has
    -- priceTiers in their catalog entry — see supply.js _publishClientPortal).
    v_price := ROUND((v_cat->>'price')::numeric, 2);
    v_tiered_price := NULL;
    IF v_cat ? 'priceTiers' AND jsonb_typeof(v_cat->'priceTiers') = 'array' THEN
      SELECT ROUND((t->>'price')::numeric, 2) INTO v_tiered_price
      FROM jsonb_array_elements(v_cat->'priceTiers') t
      WHERE (t->>'minQty')::numeric <= v_qty
      ORDER BY (t->>'minQty')::numeric DESC
      LIMIT 1;
    END IF;
    IF v_tiered_price IS NOT NULL THEN
      v_price := v_tiered_price;
    END IF;

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

-- Signature is unchanged from 004, but re-grant + reload schema anyway
-- since the function body changed.
GRANT EXECUTE ON FUNCTION public.submit_portal_order(text, jsonb, text, date, text, text, text, text, text, numeric, text) TO anon;

NOTIFY pgrst, 'reload schema';
