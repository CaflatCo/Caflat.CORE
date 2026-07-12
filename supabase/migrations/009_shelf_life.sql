-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Consignment shelf-life gate
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- Cafes selling perishables on consignment (e.g. cookies with a 7-day
-- shelf life) need reporting to wait until stock has actually had time to
-- sell — reporting on day 1 makes no sense. Each product carries an
-- optional shelf_life_days on the cafe side; consignment_stock tracks a
-- single last_delivered_at per client/product (no per-lot/FIFO tracking —
-- consignment_stock is already a single running balance, so a top-up
-- delivery resets the whole balance's countdown to the newest delivery
-- date; accepted simplification). Reporting is hard-blocked per product
-- until last_delivered_at + shelf_life_days has elapsed.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.consignment_stock
  ADD COLUMN IF NOT EXISTS shelf_life_days   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz;

-- ── get_consignment_portal: expose a computed reportableAt per on-hand
-- line, so order.html doesn't need to re-derive the gate from two fields —
-- shelf_life_days = 0 (never configured) or no delivery yet both mean
-- "reportable now" (reportableAt = NULL). ──
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
        'productId',    cs.product_id,
        'name',         cs.product_name,
        'category',     cs.category,
        'onHand',       cs.on_hand,
        'unitPrice',    cs.unit_price,
        'reportableAt', CASE
          WHEN cs.shelf_life_days > 0 AND cs.last_delivered_at IS NOT NULL
          THEN cs.last_delivered_at + (cs.shelf_life_days || ' days')::interval
          ELSE NULL
        END
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

-- ── submit_sell_through: per-line defense-in-depth guard. The client
-- already hard-blocks editing a gated row, but a tampered payload must
-- not be able to report a still-gated product early — CONTINUE (silently
-- skip, matching the existing "unknown product" pattern just above) so
-- other reportable lines in the same submission still process normally. ──
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

    -- Shelf-life gate: skip a line still within its shelf life as of now.
    CONTINUE WHEN v_stock.shelf_life_days > 0 AND v_stock.last_delivered_at IS NOT NULL
      AND now() < v_stock.last_delivered_at + (v_stock.shelf_life_days || ' days')::interval;

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

GRANT EXECUTE ON FUNCTION public.get_consignment_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_sell_through(text, jsonb, text, text, text, text, text) TO anon;

-- Force PostgREST to pick up the (re)created functions immediately.
NOTIFY pgrst, 'reload schema';
