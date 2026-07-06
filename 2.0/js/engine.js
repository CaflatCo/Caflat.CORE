/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — ENGINE
   The write path. Every function here mutates the REAL APP_STATE
   (same localStorage as the classic app) by calling the classic
   app's own business-logic functions — never a parallel/simulated
   version. This is what makes "Charge" and "Prep" real.
═══════════════════════════════════════════════════════════════ */
const ENGINE = (() => {

  /* ── Charge a real sale ──────────────────────────────────────
     cart: [{ id, productId, variantId, multiplier, name, price,
              quantity, recipe, recipeMode, batchYield }]
     Mirrors js/sales.js completeSale(), minus the DOM reads (no
     checkout modal in 2.0 yet) — same validation, same seal, same
     FG-vs-direct stock routing, same audit trail. */
  async function charge(cart, { paymentMethod = 'cash', customerName = 'Walk-in Customer' } = {}) {
    if (!cart.length) return { ok: false, error: 'Cart is empty' };

    // Keep the shared cart state in sync so calculateCartSubtotal/Discount/Tax
    // (called inside buildTransactionSnapshot) reflect what we're charging.
    if (typeof updateState === 'function') updateState('cart', () => cart);

    // Stock validation — same rule as the classic POS: FG-aware via getEffectiveStock.
    for (const product of (typeof getProducts === 'function' ? getProducts() : [])) {
      const requiredUnits = cart.reduce((sum, line) => {
        if (String(line.productId) !== String(product.id)) return sum;
        return sum + Number(line.quantity || 0) * Number(line.multiplier || 1);
      }, 0);
      if (!requiredUnits) continue;
      const availableUnits = typeof getEffectiveStock === 'function' ? getEffectiveStock(product) : Number(product.stock || 0);
      if (requiredUnits > availableUnits) return { ok: false, error: `${product.name}: only ${availableUnits} left` };
    }

    const total = cart.reduce((s, l) => s + Number(l.price || 0) * Number(l.quantity || 0), 0);
    const transaction = buildTransactionSnapshot({
      status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod,
      tendered: total, change: 0, referenceNumber: '', customerName, orderNotes: '',
      cartOverride: cart,
    });

    if (typeof sealTransaction === 'function') await sealTransaction(transaction);

    pushSale(transaction);
    deductProductStockForCart(cart);

    const fgCart = cart.filter(line => {
      const prod = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
      return typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(prod);
    });
    const directCart = cart.filter(line => {
      const prod = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
      return !(typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(prod));
    });
    if (directCart.length) deductInventoryForCart(directCart);
    if (fgCart.length && typeof deductFGForCart === 'function') deductFGForCart(fgCart);

    if (typeof pushAuditEntry === 'function') {
      pushAuditEntry({
        action: 'SALE_COMPLETED', saleId: transaction.id, receiptNumber: transaction.receiptNumber,
        total: transaction.totals?.total ?? 0, outcome: 'SUCCESS',
        note: `Sale (2.0) · ${paymentMethod} · ${typeof formatCurrency === 'function' ? formatCurrency(transaction.totals?.total ?? 0) : transaction.totals?.total}`,
      });
    }

    return { ok: true, transaction };
  }

  /* ── Run a Foresight prep recommendation ─────────────────────
     Mirrors production.js's job-completion writes: deducts the
     recipe's ingredients for the quantity made, then credits the
     product's real stock (finished-goods ledger for FG-mode
     categories, product.stock directly for direct mode) — exactly
     what finishing a real production job would do. */
  function prep(productId, qty, productName) {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(productId));
    if (!product || !(qty > 0)) return { ok: false };

    const job = { name: 'Foresight' };
    const line = { productId: product.id, productName: product.name, targetQty: qty, actualYield: qty };
    if (typeof _deductLineIngredients === 'function') _deductLineIngredients(job, line);

    const isFG = typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product);
    if (isFG && typeof creditFinishedGoods === 'function') {
      creditFinishedGoods(product.id, product.name, qty, 'Foresight prep');
    } else {
      const prevStock = Number(product.stock || 0);
      const newStock = prevStock + qty;
      const updated = (APP_STATE.products || []).map(p => String(p.id) === String(product.id) ? { ...p, stock: newStock } : p);
      if (typeof setProducts === 'function') setProducts(updated); else updateState('products', () => updated);
      const movements = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
      movements.push({
        id: generateId(), type: 'production-add', productId: product.id, productName: product.name,
        quantityAdded: qty, quantityUsed: 0, reason: 'Foresight prep',
        previousStock: prevStock, newStock,
        createdAt: new Date().toISOString(), createdBy: APP_STATE.currentUserRole || 'STAFF',
      });
      updateState('inventoryMovements', () => movements);
    }

    if (typeof pushAuditEntry === 'function') {
      pushAuditEntry({
        action: 'PREP_COMPLETED', productId: product.id, productName: product.name, qty, outcome: 'SUCCESS',
        note: `Foresight prep: ${product.name} × ${qty}`,
      });
    }

    return { ok: true };
  }

  /* ── Production: create a real job ───────────────────────────
     Matches production.js's _blankJob() schema exactly (openable/
     editable in the classic app) and replicates saveProductionJob()'s
     immediate ingredient-deduction-for-non-FG-lines behavior, via the
     same _deductLineIngredients() used there. */
  function createJob({ name, products, fundingType = 'RETAIL', clientName = '', notes = '', scheduledDate } = {}) {
    if (!Array.isArray(products) || !products.length) return { ok: false, error: 'Add at least one product' };
    const lines = products.map(p => {
      const product = (APP_STATE.products || []).find(x => String(x.id) === String(p.productId));
      return {
        id: generateId(), productId: p.productId, productName: product?.name || 'Product',
        targetQty: Number(p.targetQty || 0), batchSize: Number(product?.batchYield || 1),
        status: 'PLANNED', actualYield: null, wasteLog: [], efficiency: null,
      };
    }).filter(l => l.targetQty > 0);
    if (!lines.length) return { ok: false, error: 'Set a quantity greater than zero' };

    const job = {
      id: generateId(), name: name || lines.map(l => l.productName).join(', '),
      fundingType, scheduledDate: scheduledDate || new Date().toISOString().slice(0, 10),
      clientName, totalValue: 0, downPayment: 0, fullPayment: 0, balance: 0, paymentStatus: 'UNPAID',
      eventId: null, notes, products: lines, laborAssignments: [], status: 'PLANNED',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    lines.forEach(line => {
      const product = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
      const isFG = typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product);
      if (isFG) return; // FG lines deduct ingredients at DONE, not at creation
      if (typeof _deductLineIngredients === 'function') _deductLineIngredients(job, line);
      line.ingredientsDeducted = true;
    });

    const jobs = (typeof getProductionJobs === 'function' ? getProductionJobs() : APP_STATE.productionJobs || []);
    jobs.push(job);
    updateState('productionJobs', () => jobs);

    if (typeof pushAuditEntry === 'function') {
      pushAuditEntry({ action: 'PRODUCTION_JOB_CREATED', jobId: job.id, outcome: 'SUCCESS', note: `Production job created (2.0): ${job.name}` });
    }
    return { ok: true, job };
  }

  /* Advance a line to the next real status — the exact same state
     machine the classic Production board uses (ingredient deduction
     fallback, FG-transfer flagging, cancellation restore, job-status
     rollup). */
  function advance(jobId, lineId, newStatus) {
    if (typeof setProductLineStatus !== 'function') return { ok: false };
    setProductLineStatus(jobId, lineId, newStatus);
    return { ok: true };
  }

  function transfer(jobId, lineId) {
    if (typeof transferLineToPos !== 'function') return { ok: false };
    transferLineToPos(jobId, lineId);
    return { ok: true };
  }

  return { charge, prep, createJob, advance, transfer };
})();
