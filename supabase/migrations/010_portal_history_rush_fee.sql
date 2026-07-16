-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Surface rush_fee in client order history
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- 007_portal_history.sql predates 008_rush_fee.sql's portal_orders.rush_fee
-- column, so get_portal_history couldn't reference it yet at the time 007
-- was written. This is a small addendum, applied after 008 so the column
-- already exists — CREATE OR REPLACE keeps it to a single function, no
-- signature change.
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_portal_history(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH portal AS (
    SELECT * FROM public.order_portals WHERE token = p_token AND NOT revoked
  ),
  records AS (
    -- Sale purchases (terms_mode = 'sale') and consignment restock
    -- requests (terms_mode = 'consignment') both live in portal_orders —
    -- the type label is what tells the client which one they're looking at.
    SELECT
      po.id, po.created_at,
      CASE WHEN portal.terms_mode = 'consignment' THEN 'restock' ELSE 'order' END AS type,
      po.items, po.subtotal, po.status, po.notes,
      po.payment_method, po.payment_reference, po.payment_split,
      po.payment_method_2, po.payment_amount_2, po.payment_reference_2,
      po.requested_date, NULL::text AS settlement, NULL::timestamptz AS reconciled_at,
      po.rush_fee
    FROM public.portal_orders po, portal
    WHERE po.token = p_token

    UNION ALL

    SELECT
      pr.id, pr.created_at,
      'report' AS type,
      pr.items, pr.subtotal, pr.status, pr.notes,
      pr.payment_method, pr.payment_reference, NULL::text AS payment_split,
      NULL::text AS payment_method_2, NULL::numeric AS payment_amount_2,
      NULL::text AS payment_reference_2,
      NULL::date AS requested_date, pr.settlement, pr.reconciled_at,
      0::numeric AS rush_fee   -- sell-through reports never carry a rush fee
    FROM public.portal_reports pr, portal
    WHERE pr.token = p_token AND portal.terms_mode = 'consignment'
  )
  SELECT jsonb_build_object(
    'terms_mode', (SELECT terms_mode FROM portal),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',               r.id,
        'type',             r.type,
        'createdAt',        r.created_at,
        'items',            r.items,
        'subtotal',         r.subtotal,
        'status',           r.status,
        'notes',            r.notes,
        'paymentMethod',    r.payment_method,
        'paymentReference', r.payment_reference,
        'paymentSplit',     r.payment_split,
        'paymentMethod2',   r.payment_method_2,
        'paymentAmount2',   r.payment_amount_2,
        'requestedDate',    r.requested_date,
        'settlement',       r.settlement,
        'reconciledAt',     r.reconciled_at,
        'rushFee',          r.rush_fee
      ) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM records ORDER BY created_at DESC LIMIT 100) r
    ), '[]'::jsonb)
  )
  WHERE EXISTS (SELECT 1 FROM portal);
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_history(text) TO anon;

-- Force PostgREST to pick up the (re)created function immediately.
NOTIFY pgrst, 'reload schema';
