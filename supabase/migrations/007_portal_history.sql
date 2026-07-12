-- ═══════════════════════════════════════════════════════
-- Caflat.CORE — Client-facing order/report history
-- Run this in: Supabase Dashboard → SQL Editor → Run
--
-- Adds a single RPC the portal (order.html) uses to show a client every
-- past record tied to their token, with a full itemized breakdown per
-- record — for both terms modes:
--   · sale portals:         their portal_orders (purchases)
--   · consignment portals:  their portal_orders (restock requests) AND
--                            portal_reports (sell-through reports)
--
-- Access model is identical to 004/006: SECURITY DEFINER keyed by the
-- unguessable token, no direct table access for anon.
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
      po.requested_date, NULL::text AS settlement, NULL::timestamptz AS reconciled_at
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
      NULL::date AS requested_date, pr.settlement, pr.reconciled_at
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
        'reconciledAt',     r.reconciled_at
      ) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM records ORDER BY created_at DESC LIMIT 100) r
    ), '[]'::jsonb)
  )
  WHERE EXISTS (SELECT 1 FROM portal);
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_history(text) TO anon;

-- Force PostgREST to pick up the (re)created function immediately.
NOTIFY pgrst, 'reload schema';
