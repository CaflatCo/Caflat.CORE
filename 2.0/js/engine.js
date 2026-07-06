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

  /* ── Ingredients (Larder CRUD) ───────────────────────────────
     Mirrors ingredients.js's saveIngredient() core logic, minus the
     DOM form reads — takes a plain data object instead. */
  function saveIngredient(data) {
    if (!data.name) return { ok: false, error: 'Ingredient name is required' };
    const record = {
      id: data.id || generateId(), name: data.name, unit: data.unit || '',
      type: data.type || 'raw', stock: Number(data.stock || 0),
      reorderLevel: Number(data.reorderLevel || 0),
      packageQuantity: Number(data.packageQuantity || 0), packageCost: Number(data.packageCost || 0),
      costPerUnit: Number(data.packageQuantity) > 0 ? Number(data.packageCost || 0) / Number(data.packageQuantity) : 0,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    const ingredients = (typeof getIngredients === 'function' ? getIngredients() : APP_STATE.ingredients || []).slice();
    const idx = ingredients.findIndex(i => String(i.id) === String(record.id));
    if (idx >= 0) {
      const prev = ingredients[idx];
      if (typeof logInventoryAdjustment === 'function' && Number(prev.stock || 0) !== record.stock) {
        logInventoryAdjustment(record.id, Number(prev.stock || 0), record.stock, 'Manual stock edit', 'manual-adjustment');
      }
      ingredients[idx] = record;
    } else {
      if (record.stock > 0 && typeof logInventoryAdjustment === 'function') {
        logInventoryAdjustment(record.id, 0, record.stock, 'Initial stock', 'manual-adjustment');
      }
      ingredients.push(record);
    }
    if (typeof setIngredients === 'function') setIngredients(ingredients); else updateState('ingredients', () => ingredients);
    return { ok: true, ingredient: record };
  }

  /* ── Products (Catalog CRUD) ──────────────────────────────────
     Mirrors products.js's saveProduct() core logic (name/category
     required, FG opening-stock sync), minus DOM + free-tier-limit UI. */
  function saveProduct(data) {
    if (!data.name) return { ok: false, error: 'Product name is required' };
    if (!data.category) return { ok: false, error: 'Category is required' };
    const products = (typeof getProducts === 'function' ? getProducts() : APP_STATE.products || []).slice();
    const id = data.id || generateId();
    const existing = products.find(p => String(p.id) === String(id));
    const record = {
      id, name: data.name, category: data.category, price: Number(data.price || 0),
      cost: Number(data.cost || 0), stock: Number(data.stock || 0), reorderLevel: Number(data.reorderLevel || 0),
      recipe: Array.isArray(data.recipe) ? data.recipe : (existing?.recipe || []),
      recipeMode: data.recipeMode || existing?.recipeMode || 'unit', batchYield: Number(data.batchYield || existing?.batchYield || 1),
      variants: existing?.variants || [], packagingItems: existing?.packagingItems || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const idx = products.findIndex(p => String(p.id) === String(id));
    if (idx >= 0) products[idx] = record; else products.push(record);
    if (typeof setProducts === 'function') setProducts(products); else updateState('products', () => products);

    if (typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(record)) {
      const newStock = record.stock, prevStock = Number(existing?.stock || 0);
      if (!existing && newStock > 0 && typeof _setFGRecord === 'function') {
        _setFGRecord(record.id, record.name, newStock, 0, 'Opening stock — set on product creation', 'manual-entry');
      } else if (existing && newStock !== prevStock && typeof _setFGRecord === 'function') {
        _setFGRecord(record.id, record.name, newStock - prevStock, 0, 'Manual stock adjustment via Catalog', 'manual-entry');
      }
    }
    return { ok: true, product: record };
  }

  /* ── Treasury (accounts + transactions) ───────────────────────
     Mirrors treasury.js's saveTreasuryAccount()/saveTreasuryTransaction()
     core logic, minus the DOM form reads. */
  function saveTreasuryAccount(data) {
    if (!data.name) return { ok: false, error: 'Account name required' };
    if (!Array.isArray(APP_STATE.treasuryAccounts)) APP_STATE.treasuryAccounts = [];
    if (data.id) {
      const account = APP_STATE.treasuryAccounts.find(a => a.id === data.id);
      if (!account) return { ok: false, error: 'Account not found' };
      account.name = data.name; account.type = data.type === 'bank' ? 'bank' : 'cash';
      account.openingBalance = Number(data.openingBalance || 0);
    } else {
      APP_STATE.treasuryAccounts.push({
        id: generateId(), name: data.name, type: data.type === 'bank' ? 'bank' : 'cash',
        openingBalance: Number(data.openingBalance || 0), createdAt: new Date().toISOString(),
      });
    }
    persistState();
    return { ok: true };
  }

  function saveTreasuryTransaction(data) {
    if (!data.accountId) return { ok: false, error: 'Select an account' };
    if (!data.amount || data.amount <= 0) return { ok: false, error: 'Enter an amount greater than 0' };
    if (!data.reason) return { ok: false, error: 'Add a reason for this transaction' };
    if (!Array.isArray(APP_STATE.treasuryTransactions)) APP_STATE.treasuryTransactions = [];
    const existing = data.id ? APP_STATE.treasuryTransactions.find(t => t.id === data.id) : null;
    const txn = {
      id: existing?.id || generateId(), accountId: data.accountId,
      kind: data.kind === 'deduct' ? 'deduct' : 'add', amount: Number(data.amount),
      reason: data.reason, date: data.date || new Date().toISOString().slice(0, 10),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (existing) APP_STATE.treasuryTransactions[APP_STATE.treasuryTransactions.findIndex(t => t.id === data.id)] = txn;
    else APP_STATE.treasuryTransactions.push(txn);
    persistState();
    return { ok: true, txn };
  }

  /* ── Void / Refund a real sale ────────────────────────────────
     Enforces the same Admin-role + PIN rule as the classic app, then
     calls its exact void.js/refund.js functions — same stock
     restoration, same re-seal, same audit trail. */
  function voidSale(saleId, reason, pin) {
    if ((APP_STATE.currentUserRole || '').toUpperCase() !== 'ADMIN') return { ok: false, error: 'Void requires Admin access' };
    if (!reason) return { ok: false, error: 'Void reason is required' };
    if (typeof validateVoidPin === 'function' && !validateVoidPin(pin)) return { ok: false, error: 'Incorrect PIN' };
    if (typeof executeVoid !== 'function') return { ok: false, error: 'Void unavailable' };
    executeVoid(saleId, reason);
    return { ok: true };
  }

  async function refundSale(saleId, reason) {
    if ((APP_STATE.currentUserRole || '').toUpperCase() !== 'ADMIN') return { ok: false, error: 'Refund requires Admin access' };
    if (!reason) return { ok: false, error: 'Refund reason is required' };
    const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
    const sale = sales.find(s => String(s.id) === String(saleId));
    if (!sale) return { ok: false, error: 'Sale not found' };
    const status = (sale.status || '').toUpperCase();
    if (status === 'REFUNDED') return { ok: false, error: 'Sale already refunded' };
    if (status === 'VOIDED') return { ok: false, error: 'Voided sales cannot be refunded' };
    if (status === 'PENDING') return { ok: false, error: 'Cancel pending orders instead of refunding' };

    const timestamp = new Date().toISOString();
    sale.status = 'REFUNDED'; sale.paymentStatus = 'REFUNDED';
    sale.refund = { reason, refundedAt: timestamp, refundedBy: APP_STATE.currentUserRole || 'ADMIN' };
    sale.audit = sale.audit || {}; sale.audit.refundedAt = timestamp; sale.audit.refundedBy = APP_STATE.currentUserRole || 'ADMIN';
    if (typeof sealTransaction === 'function') await sealTransaction(sale);
    updateState('sales', () => sales);
    if (typeof _refundRestoreProductStock === 'function') _refundRestoreProductStock(sale);
    if (typeof _refundRestoreIngredientStock === 'function') _refundRestoreIngredientStock(sale);
    if (typeof pushAuditEntry === 'function') {
      pushAuditEntry({ action: 'REFUND_COMPLETED', saleId: sale.id, receiptNumber: sale.receiptNumber,
        total: sale.totals?.total ?? 0, reason, outcome: 'SUCCESS', stockRestored: true });
    }
    return { ok: true, sale };
  }

  return { charge, prep, createJob, advance, transfer, saveIngredient, saveProduct, saveTreasuryAccount, saveTreasuryTransaction, voidSale, refundSale };
})();
