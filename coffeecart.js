/* ═══════════════════════════════════════════════════════
   COFFEECART.JS — Coffee Cart Mode
   Phase 1 + Phase 2: Complete implementation
   Feature-toggled via settings.coffeeCartModeEnabled.

   Phase 1: Order Channel System + Active Event Session
   Phase 2: Event Profitability + Package Builder + Lead Tracker

   Architecture:
   - Channels extend orderType with business context
   - Active Event Session tags all transactions during event
   - All analytics flow through analytics.js
   - No inline events, no duplicate state
═══════════════════════════════════════════════════════ */

/* ── Channel definitions ── */
const CART_CHANNELS = {
  'Dine In':     { label: 'Dine In',     group: 'pos'   },
  'Take Out':    { label: 'Take Out',    group: 'pos'   },
  'Delivery':    { label: 'Delivery',    group: 'pos'   },
  'Event':       { label: 'Event',       group: 'event' },
  'Corporate':   { label: 'Corporate',   group: 'b2b'   },
  'Wholesale':   { label: 'Wholesale',   group: 'b2b'   },
  'Partner Cafe':{ label: 'Partner Cafe',group: 'b2b'   },
};

/* ── Active Event Session ── */
function getActiveEvent() {
  return APP_STATE.activeEvent || null;
}

function startEventSession(event) {
  updateState('activeEvent', () => ({
    id:        event.id,
    name:      event.name,
    startedAt: new Date().toISOString(),
    location:  event.location || '',
    type:      event.type || 'Event'
  }));
  applyEventSessionBanner();
  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:  'EVENT_SESSION_STARTED',
      outcome: 'SUCCESS',
      note:    `Event session started: ${event.name}`
    });
  }
  showNotification(`Event session started: ${event.name}`, 'success');
}

function endEventSession() {
  const event = getActiveEvent();
  if (!event) return;
  updateState('activeEvent', () => null);
  applyEventSessionBanner();
  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:  'EVENT_SESSION_ENDED',
      outcome: 'SUCCESS',
      note:    `Event session ended: ${event.name}`
    });
  }
  showNotification(`Event session ended: ${event.name}`, 'success');
}

function applyEventSessionBanner() {
  const banner  = document.getElementById('eventSessionBanner');
  const event   = getActiveEvent();
  if (!banner) return;
  if (event) {
    banner.style.display = 'flex';
    const nameEl = document.getElementById('eventSessionName');
    const timeEl = document.getElementById('eventSessionTime');
    if (nameEl) nameEl.textContent = event.name;
    if (timeEl) {
      const started = new Date(event.startedAt);
      timeEl.textContent = `Since ${started.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    }
  } else {
    banner.style.display = 'none';
  }
}

/* ── Events CRUD ── */
function getEvents() {
  return Array.isArray(APP_STATE.events) ? APP_STATE.events : [];
}

function saveEvent() {
  const id       = getElementValue('eventId') || generateId();
  const name     = sanitizeText(getElementValue('eventName'));
  const location = sanitizeText(getElementValue('eventLocation'));
  const type     = getElementValue('eventType') || 'Event';
  const date     = getElementValue('eventDate');
  const notes    = sanitizeText(getElementValue('eventNotes'));

  if (!name) { showNotification('Event name is required', 'error'); return; }

  const events   = getEvents();
  const existing = events.find(e => String(e.id) === String(id));

  if (existing) {
    Object.assign(existing, { name, location, type, date, notes, updatedAt: new Date().toISOString() });
  } else {
    events.push({ id, name, location, type, date, notes,
      createdAt: new Date().toISOString(), status: 'UPCOMING' });
  }

  updateState('events', () => events);
  closeModal('eventModal');
  clearEventForm();
  renderEventsTable();
  showNotification('Event saved', 'success');
}

function deleteEvent(eventId) {
  if (!confirm('Delete this event?')) return;
  updateState('events', () => getEvents().filter(e => String(e.id) !== String(eventId)));
  renderEventsTable();
  showNotification('Event deleted', 'success');
}

function openEventModal(eventId = null) {
  clearEventForm();
  if (eventId) {
    const event = getEvents().find(e => String(e.id) === String(eventId));
    if (event) {
      setElementValue('eventId',       event.id);
      setElementValue('eventName',     event.name);
      setElementValue('eventLocation', event.location || '');
      setElementValue('eventType',     event.type     || 'Event');
      setElementValue('eventDate',     event.date     || '');
      setElementValue('eventNotes',    event.notes    || '');
    }
  }
  openModal('eventModal');
}

function clearEventForm() {
  ['eventId','eventName','eventLocation','eventDate','eventNotes']
    .forEach(id => setElementValue(id, ''));
}

function activateEvent(eventId) {
  const event = getEvents().find(e => String(e.id) === String(eventId));
  if (!event) return;
  if (getActiveEvent()) {
    if (!confirm(`End current session "${getActiveEvent().name}" and start "${event.name}"?`)) return;
  }
  startEventSession(event);
  renderEventsTable();
}

/* ── Events table ── */
function renderEventsTable() {
  const tbody = document.querySelector('#eventsTable tbody');
  if (!tbody) return;

  const events    = getEvents();
  const activeId  = getActiveEvent()?.id;

  tbody.innerHTML = '';

  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No events yet — create your first event</td></tr>`;
    return;
  }

  events.slice().reverse().forEach(event => {
    const isActive = String(event.id) === String(activeId);
    const row      = document.createElement('tr');
    if (isActive) row.style.background = '#f0fdf4';

    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(event.name)}
        ${isActive ? `<span style="display:inline-flex;align-items:center;gap:4px;
          margin-left:8px;padding:2px 8px;border-radius:999px;background:#dcfce7;
          color:#16a34a;font-size:9px;font-weight:800;letter-spacing:1px;">● ACTIVE</span>` : ''}
      </td>
      <td>${escapeHtml(event.type || 'Event')}</td>
      <td>${event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-PH',
        {month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
      <td>${escapeHtml(event.location || '—')}</td>
      <td>${_getEventRevenue(event.id) > 0
        ? `<span style="font-weight:700;">${formatCurrency(_getEventRevenue(event.id))}</span>`
        : '<span style="color:var(--gray-300);">—</span>'}</td>
      <td>
        <div class="table-actions">
          ${!isActive
            ? `<button class="btn btn-sm" data-action="activate-event" data-id="${event.id}">
                Start Session</button>`
            : `<button class="btn btn-sm btn-secondary" data-action="end-event-session">
                End Session</button>`}
          <button class="btn btn-sm btn-secondary" data-action="open-event-profitability" data-id="${event.id}">Profitability</button>
          <button class="btn btn-sm btn-secondary" data-action="edit-event" data-id="${event.id}">Edit</button>
          <button class="btn btn-sm btn-secondary" data-action="delete-event" data-id="${event.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ── Event revenue from sales ── */
function _getEventRevenue(eventId) {
  return (APP_STATE.sales || [])
    .filter(s => s.eventId === eventId && (s.status||'').toUpperCase() === 'COMPLETED')
    .reduce((sum, s) => sum + Number(s.totals?.total ?? s.total ?? 0), 0);
}

/* ── Channel analytics ── */
function getRevenueByChannel(fromDate, toDate) {
  const map = {};
  const sales = typeof getCompletedSales === 'function' ? getCompletedSales(fromDate, toDate) : [];
  sales.forEach(sale => {
    const ch = sale.channel || sale.orderType || 'Dine In';
    map[ch] = (map[ch] || 0) + Number(sale.totals?.total ?? sale.total ?? 0);
  });
  return map;
}

function getOrdersByChannel(fromDate, toDate) {
  const map = {};
  const sales = typeof getCompletedSales === 'function' ? getCompletedSales(fromDate, toDate) : [];
  sales.forEach(sale => {
    const ch = sale.channel || sale.orderType || 'Dine In';
    map[ch] = (map[ch] || 0) + 1;
  });
  return map;
}

/* ── Coffee Cart view render ── */
function renderChannelBreakdown() {
  const container = document.getElementById('channelBreakdownContainer');
  if (!container) return;

  const revenue  = getRevenueByChannel();
  const orders   = getOrdersByChannel();
  const channels = Object.keys({ ...revenue, ...orders });

  if (!channels.length) {
    container.innerHTML = `<div class="empty-state">No sales data yet</div>`;
    return;
  }

  const totalRev = Object.values(revenue).reduce((s, v) => s + v, 0);

  container.innerHTML = channels.map(ch => {
    const chRev = revenue[ch] || 0;
    const chOrd = orders[ch]  || 0;
    const pct   = totalRev > 0 ? ((chRev / totalRev) * 100).toFixed(1) : '0.0';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
        margin-bottom:8px;background:var(--white);">
        <div>
          <div style="font-weight:800;font-size:13px;">${escapeHtml(ch)}</div>
            <div style="font-size:11px;color:var(--gray-400);">${chOrd} orders</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:900;font-size:15px;font-variant-numeric:tabular-nums;">
            ${formatCurrency(chRev)}</div>
          <div style="font-size:11px;color:var(--gray-400);">${pct}% of total</div>
        </div>
      </div>`;
  }).join('');
}

/* ── POS channel selector (shown when Coffee Cart Mode is on) ── */
function renderChannelSelector() {
  const container = document.getElementById('channelSelectorContainer');
  if (!container) return;

  if (!APP_STATE.settings?.coffeeCartModeEnabled) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const current = APP_STATE.ui?.activeChannel || APP_STATE.ui?.orderType || 'Dine In';
  const activeEvent = getActiveEvent();

  // Available channels — include Event if session active
  const available = Object.keys(CART_CHANNELS).filter(ch => {
    if (ch === 'Event') return !!activeEvent;
    return true;
  });

  container.innerHTML = available.map(ch => `
    <button type="button"
      class="channel-btn${current === ch ? ' active' : ''}"
      data-action="set-channel" data-channel="${ch}">
      ${CART_CHANNELS[ch].label}
    </button>`).join('');
}

function setActiveChannel(channel) {
  updateState('ui', current => ({ ...current, activeChannel: channel, orderType: channel }));
  renderChannelSelector();
}

/* ── Nav + feature toggle ── */
function applyCoffeeCartModeToggle() {
  const enabled = APP_STATE.settings?.coffeeCartModeEnabled === true;
  const navBtn  = document.getElementById('navCoffeeCart');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  const channelSel = document.getElementById('channelSelectorContainer');
  if (channelSel) channelSel.style.display = enabled ? 'flex' : 'none';

  if (enabled) {
    renderChannelSelector();
  } else {
    // If currently on the coffeecart view, redirect to POS
    if (APP_STATE.ui?.currentView === 'coffeecart') {
      if (typeof switchPage === 'function') switchPage('pos');
    }
  }
}

/* ── Exports ── */
window.getActiveEvent           = getActiveEvent;
window.startEventSession        = startEventSession;
window.endEventSession          = endEventSession;
window.applyEventSessionBanner  = applyEventSessionBanner;
window.getEvents                = getEvents;
window.saveEvent                = saveEvent;
window.deleteEvent              = deleteEvent;
window.openEventModal           = openEventModal;
window.activateEvent            = activateEvent;
window.renderEventsTable        = renderEventsTable;
window.renderChannelBreakdown   = renderChannelBreakdown;
window.renderChannelSelector    = renderChannelSelector;
window.setActiveChannel         = setActiveChannel;
window.applyCoffeeCartModeToggle= applyCoffeeCartModeToggle;
window.getRevenueByChannel      = getRevenueByChannel;
window.getOrdersByChannel       = getOrdersByChannel;
window.CART_CHANNELS            = CART_CHANNELS;

/* ═══════════════════════════════════════════════════════
   PHASE 2A — EVENT PROFITABILITY
   Revenue pulled from tagged sales.
   Expenses manually logged per event.
   Profit = Revenue - Expenses - Ingredient Cost
═══════════════════════════════════════════════════════ */

function getEventExpenses(eventId) {
  const event = getEvents().find(e => String(e.id) === String(eventId));
  return Array.isArray(event?.expenses) ? event.expenses : [];
}

function addEventExpense(eventId, expense) {
  const events = getEvents();
  const event  = events.find(e => String(e.id) === String(eventId));
  if (!event) return;
  event.expenses = Array.isArray(event.expenses) ? event.expenses : [];
  event.expenses.push({
    id:        generateId(),
    label:     sanitizeText(expense.label),
    amount:    Number(expense.amount || 0),
    createdAt: new Date().toISOString()
  });
  updateState('events', () => events);
}

function deleteEventExpense(eventId, expenseId) {
  const events = getEvents();
  const event  = events.find(e => String(e.id) === String(eventId));
  if (!event) return;
  event.expenses = (event.expenses || []).filter(ex => String(ex.id) !== String(expenseId));
  updateState('events', () => events);
}

function getEventProfitability(eventId) {
  const revenue  = _getEventRevenue(eventId);
  const expenses = getEventExpenses(eventId).reduce((s, ex) => s + Number(ex.amount || 0), 0);

  // Ingredient cost from sales tagged to this event
  const sales = (APP_STATE.sales || []).filter(
    s => s.eventId === eventId && (s.status || '').toUpperCase() === 'COMPLETED'
  );
  let ingredientCost = 0;
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
      if (!product || !Array.isArray(product.recipe)) return;
      const batchYield = Math.max(1, Number(product.batchYield || 1));
      const recipeMode = String(product.recipeMode || 'unit');
      const units      = Number(item.quantity || 0) * Number(item.multiplier || 1);
      product.recipe.forEach(ri => {
        const ing = (APP_STATE.ingredients || []).find(i => String(i.id) === String(ri.ingredientId));
        if (!ing) return;
        const perUnit = recipeMode === 'batch'
          ? Number(ri.quantity || 0) / batchYield
          : Number(ri.quantity || 0);
        ingredientCost += perUnit * Number(ing.costPerUnit || 0) * units;
      });
    });
  });

  const totalCost = expenses + ingredientCost;
  const profit    = revenue - totalCost;
  const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;
  const orders    = sales.length;

  return { revenue, expenses, ingredientCost, totalCost, profit, margin, orders };
}

function openEventProfitabilityModal(eventId) {
  const event = getEvents().find(e => String(e.id) === String(eventId));
  if (!event) return;

  const p = getEventProfitability(eventId);

  const el = id => document.getElementById(id);
  if (el('profitEventName'))     el('profitEventName').textContent     = event.name;
  if (el('profitEventId'))       el('profitEventId').value             = eventId;
  if (el('profitRevenue'))       el('profitRevenue').textContent       = formatCurrency(p.revenue);
  if (el('profitIngredientCost'))el('profitIngredientCost').textContent= formatCurrency(p.ingredientCost);
  if (el('profitExpenses'))      el('profitExpenses').textContent      = formatCurrency(p.expenses);
  if (el('profitTotalCost'))     el('profitTotalCost').textContent     = formatCurrency(p.totalCost);
  if (el('profitNetProfit'))     el('profitNetProfit').textContent     = formatCurrency(p.profit);
  if (el('profitMargin'))        el('profitMargin').textContent        = p.margin.toFixed(1) + '%';
  if (el('profitOrders'))        el('profitOrders').textContent        = p.orders;

  // Colour profit
  if (el('profitNetProfit')) {
    el('profitNetProfit').style.color = p.profit >= 0 ? '#16a34a' : '#dc2626';
  }

  // Render expense list
  renderEventExpensesList(eventId);

  // Wire expense add button with current eventId
  const addExpBtn = document.querySelector('[data-action="add-event-expense"]');
  if (addExpBtn) addExpBtn.dataset.eventId = eventId;

  // Clear add-expense form
  setElementValue('expenseLabel',  '');
  setElementValue('expenseAmount', '');

  openModal('eventProfitabilityModal');
}

function renderEventExpensesList(eventId) {
  const container = document.getElementById('eventExpensesList');
  if (!container) return;
  const expenses = getEventExpenses(eventId);

  if (!expenses.length) {
    container.innerHTML = `<div class="cost-preview-empty">No expenses logged yet</div>`;
    return;
  }

  container.innerHTML = expenses.map(ex => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:12px;">
      <span style="font-weight:700;">${escapeHtml(ex.label)}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-weight:800;">${formatCurrency(ex.amount)}</span>
        <button class="btn btn-sm btn-secondary"
          data-action="delete-event-expense"
          data-event-id="${eventId}"
          data-expense-id="${ex.id}">✕</button>
      </div>
    </div>`).join('');
}

function addExpenseFromForm(eventId) {
  const label  = sanitizeText(getElementValue('expenseLabel'));
  const amount = Number(getElementValue('expenseAmount') || 0);
  if (!label)    { showNotification('Expense label required', 'error'); return; }
  if (!amount)   { showNotification('Amount required', 'error'); return; }
  addEventExpense(eventId, { label, amount });
  openEventProfitabilityModal(eventId); // Refresh modal
  showNotification('Expense added', 'success');
}

/* ═══════════════════════════════════════════════════════
   PHASE 2B — EVENT PACKAGE BUILDER
   Predefined packages for fast quotations.
   Each package has a name, price, and list of items.
═══════════════════════════════════════════════════════ */

function getEventPackages() {
  return Array.isArray(APP_STATE.eventPackages) ? APP_STATE.eventPackages : [];
}

function openPackageModal(packageId = null) {
  clearPackageForm();
  renderPackageItemsList([]);

  if (packageId) {
    const pkg = getEventPackages().find(p => String(p.id) === String(packageId));
    if (pkg) {
      setElementValue('packageId',          pkg.id);
      setElementValue('packageName',        pkg.name);
      setElementValue('packagePrice',       pkg.price);
      setElementValue('packageDescription', pkg.description || '');
      setElementValue('packageMinPax',      pkg.minPax     || '');
      setElementValue('packageMaxPax',      pkg.maxPax     || '');
      renderPackageItemsList(pkg.items || []);
    }
  }
  openModal('packageModal');
}

function clearPackageForm() {
  ['packageId','packageName','packagePrice','packageDescription','packageMinPax','packageMaxPax']
    .forEach(id => setElementValue(id, ''));
}

function renderPackageItemsList(items = []) {
  const container = document.getElementById('packageItemsBuilder');
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => addPackageItemRow(item));
}

function addPackageItemRow(item = null) {
  const container = document.getElementById('packageItemsBuilder');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'packaging-row';
  row.innerHTML = `
    <input type="text" class="pkg-item-name" placeholder="e.g. Espresso, Cappuccino, Signature Drink"
      value="${escapeHtml(item?.name || '')}"
      style="flex:2;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <input type="number" class="pkg-item-qty" placeholder="Qty" min="1"
      value="${item?.qty || 1}"
      style="width:70px;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <button type="button" class="btn btn-sm btn-secondary pkg-remove">✕</button>`;
  row.querySelector('.pkg-remove').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectPackageItems() {
  return Array.from(document.querySelectorAll('#packageItemsBuilder .packaging-row'))
    .map(row => ({
      name: sanitizeText(row.querySelector('.pkg-item-name')?.value || ''),
      qty:  Number(row.querySelector('.pkg-item-qty')?.value || 1)
    }))
    .filter(item => item.name);
}

function savePackage() {
  const id          = getElementValue('packageId') || generateId();
  const name        = sanitizeText(getElementValue('packageName'));
  const price       = Number(getElementValue('packagePrice') || 0);
  const description = sanitizeText(getElementValue('packageDescription'));
  const minPax      = Number(getElementValue('packageMinPax') || 0);
  const maxPax      = Number(getElementValue('packageMaxPax') || 0);
  const items       = collectPackageItems();

  if (!name)  { showNotification('Package name required', 'error'); return; }
  if (!price) { showNotification('Package price required', 'error'); return; }

  const packages = getEventPackages();
  const existing = packages.find(p => String(p.id) === String(id));

  if (existing) {
    Object.assign(existing, { name, price, description, minPax, maxPax, items,
      updatedAt: new Date().toISOString() });
  } else {
    packages.push({ id, name, price, description, minPax, maxPax, items,
      createdAt: new Date().toISOString() });
  }

  updateState('eventPackages', () => packages);
  closeModal('packageModal');
  renderPackagesTable();
  showNotification('Package saved', 'success');
}

function deletePackage(packageId) {
  if (!confirm('Delete this package?')) return;
  updateState('eventPackages', () =>
    getEventPackages().filter(p => String(p.id) !== String(packageId)));
  renderPackagesTable();
  showNotification('Package deleted', 'success');
}

function renderPackagesTable() {
  const tbody = document.querySelector('#packagesTable tbody');
  if (!tbody) return;
  const packages = getEventPackages();

  tbody.innerHTML = '';
  if (!packages.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No packages yet — build your first event package</td></tr>`;
    return;
  }

  packages.forEach(pkg => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(pkg.name)}</td>
      <td style="font-weight:900;font-variant-numeric:tabular-nums;">
        ${formatCurrency(pkg.price)}</td>
      <td style="font-size:11px;color:var(--gray-500);">
        ${pkg.minPax || pkg.maxPax
          ? `${pkg.minPax || '?'} – ${pkg.maxPax || '?'} pax`
          : '—'}</td>
      <td style="font-size:11px;max-width:180px;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;">
        ${(pkg.items || []).map(i => `${i.name} ×${i.qty}`).join(', ') || '—'}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm" data-action="edit-package" data-id="${pkg.id}">Edit</button>
          <button class="btn btn-sm btn-secondary" data-action="delete-package" data-id="${pkg.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════════════
   PHASE 2C — LEAD TRACKER
   Inquiries → Quoted → Booked → Completed / Lost
   Lightweight CRM for event-based operators.
═══════════════════════════════════════════════════════ */

const LEAD_STATUSES = ['INQUIRY', 'QUOTED', 'BOOKED', 'COMPLETED', 'LOST'];
const LEAD_STATUS_LABELS = {
  INQUIRY:   'Inquiry',
  QUOTED:    'Quoted',
  BOOKED:    'Booked',
  COMPLETED: 'Completed',
  LOST:      'Lost'
};
const LEAD_STATUS_STYLES = {
  INQUIRY:   'background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;',
  QUOTED:    'background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;',
  BOOKED:    'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;',
  COMPLETED: 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;',
  LOST:      'background:#f9fafb;color:#9ca3af;border:1px solid #e5e7eb;'
};

function getLeads() {
  return Array.isArray(APP_STATE.leads) ? APP_STATE.leads : [];
}

function openLeadModal(leadId = null) {
  clearLeadForm();
  if (leadId) {
    const lead = getLeads().find(l => String(l.id) === String(leadId));
    if (lead) {
      setElementValue('leadId',          lead.id);
      setElementValue('leadClientName',  lead.clientName);
      setElementValue('leadContact',     lead.contact     || '');
      setElementValue('leadEmail',       lead.email       || '');
      setElementValue('leadEventType',   lead.eventType   || 'Event');
      setElementValue('leadEventDate',   lead.eventDate   || '');
      setElementValue('leadPax',         lead.pax         || '');
      setElementValue('leadBudget',      lead.budget      || '');
      setElementValue('leadPackageRef',  lead.packageRef  || '');
      setElementValue('leadStatus',      lead.status      || 'INQUIRY');
      setElementValue('leadNotes',       lead.notes       || '');
    }
  } else {
    setElementValue('leadStatus', 'INQUIRY');
    setElementValue('leadEventDate', new Date().toISOString().slice(0,10));
  }
  // Populate package reference dropdown
  _populatePackageRefSelect();
  openModal('leadModal');
}

function _populatePackageRefSelect() {
  const select = document.getElementById('leadPackageRef');
  if (!select) return;
  const packages = getEventPackages();
  select.innerHTML = `<option value="">No package / TBD</option>` +
    packages.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatCurrency(p.price)}</option>`).join('');
}

function clearLeadForm() {
  ['leadId','leadClientName','leadContact','leadEmail','leadEventType',
   'leadEventDate','leadPax','leadBudget','leadPackageRef','leadStatus','leadNotes']
    .forEach(id => setElementValue(id, ''));
}

function saveLead() {
  const id          = getElementValue('leadId') || generateId();
  const clientName  = sanitizeText(getElementValue('leadClientName'));
  const contact     = sanitizeText(getElementValue('leadContact'));
  const email       = sanitizeText(getElementValue('leadEmail'));
  const eventType   = getElementValue('leadEventType') || 'Event';
  const eventDate   = getElementValue('leadEventDate');
  const pax         = Number(getElementValue('leadPax') || 0);
  const budget      = Number(getElementValue('leadBudget') || 0);
  const packageRef  = getElementValue('leadPackageRef') || '';
  const status      = getElementValue('leadStatus') || 'INQUIRY';
  const notes       = sanitizeText(getElementValue('leadNotes'));

  if (!clientName) { showNotification('Client name is required', 'error'); return; }

  const leads    = getLeads();
  const existing = leads.find(l => String(l.id) === String(id));
  const timestamp= new Date().toISOString();

  if (existing) {
    const prevStatus = existing.status;
    Object.assign(existing, { clientName, contact, email, eventType, eventDate,
      pax, budget, packageRef, status, notes, updatedAt: timestamp });
    if (prevStatus !== status) {
      existing.statusHistory = Array.isArray(existing.statusHistory)
        ? existing.statusHistory : [];
      existing.statusHistory.push({ status, changedAt: timestamp,
        changedFrom: prevStatus });
    }
  } else {
    leads.push({ id, clientName, contact, email, eventType, eventDate,
      pax, budget, packageRef, status, notes,
      statusHistory: [{ status, changedAt: timestamp }],
      createdAt: timestamp, updatedAt: timestamp
    });
  }

  updateState('leads', () => leads);
  closeModal('leadModal');
  renderLeadsTable();
  showNotification('Lead saved', 'success');
}

function deleteLead(leadId) {
  if (!confirm('Delete this lead?')) return;
  updateState('leads', () => getLeads().filter(l => String(l.id) !== String(leadId)));
  renderLeadsTable();
  showNotification('Lead deleted', 'success');
}

function renderLeadsTable() {
  const tbody = document.querySelector('#leadsTable tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('leadStatusFilter')?.value || '';
  let leads = getLeads();
  if (statusFilter) leads = leads.filter(l => l.status === statusFilter);
  leads = leads.slice().sort((a, b) =>
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  tbody.innerHTML = '';
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No leads yet</td></tr>`;
    return;
  }

  leads.forEach(lead => {
    const style   = LEAD_STATUS_STYLES[lead.status] || LEAD_STATUS_STYLES.INQUIRY;
    const label   = LEAD_STATUS_LABELS[lead.status] || lead.status;
    const pkg     = lead.packageRef
      ? getEventPackages().find(p => String(p.id) === String(lead.packageRef))
      : null;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(lead.clientName)}</td>
      <td style="font-size:11px;">
        ${lead.contact ? escapeHtml(lead.contact) : ''}
        ${lead.email   ? `<br><span style="color:var(--gray-400);">${escapeHtml(lead.email)}</span>` : ''}
      </td>
      <td>${escapeHtml(lead.eventType || '—')}</td>
      <td>${lead.eventDate
        ? new Date(lead.eventDate + 'T00:00:00').toLocaleDateString('en-PH',
            {month:'short',day:'numeric',year:'numeric'})
        : '—'}</td>
      <td style="font-size:11px;">
        ${lead.pax ? `${lead.pax} pax` : '—'}
        ${lead.budget ? `<br>${formatCurrency(lead.budget)}` : ''}
      </td>
      <td style="font-size:11px;color:var(--gray-500);">
        ${pkg ? escapeHtml(pkg.name) : '—'}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;padding:3px 9px;
          border-radius:999px;font-size:9px;font-weight:800;
          letter-spacing:1px;text-transform:uppercase;${style}">
          ${escapeHtml(label)}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm" data-action="edit-lead" data-id="${lead.id}">Edit</button>
          <button class="btn btn-sm btn-secondary" data-action="delete-lead" data-id="${lead.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ── Lead KPIs ── */
function getLeadKPIs() {
  const leads     = getLeads();
  const total     = leads.length;
  const booked    = leads.filter(l => l.status === 'BOOKED').length;
  const completed = leads.filter(l => l.status === 'COMPLETED').length;
  const lost      = leads.filter(l => l.status === 'LOST').length;
  const convRate  = total > 0 ? Math.round(((booked + completed) / total) * 100) : 0;
  const pipeline  = leads
    .filter(l => ['INQUIRY','QUOTED','BOOKED'].includes(l.status))
    .reduce((s, l) => s + Number(l.budget || 0), 0);
  return { total, booked, completed, lost, convRate, pipeline };
}

/* ── Full view render (Phase 2) ── */
function renderCoffeeCartView() {
  renderEventsTable();
  renderChannelBreakdown();
  renderPackagesTable();
  renderLeadsTable();
  applyEventSessionBanner();

  // Lead KPIs
  const kpi = getLeadKPIs();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('leadKpiTotal',    kpi.total);
  set('leadKpiBooked',   kpi.booked);
  set('leadKpiConv',     kpi.convRate + '%');
  set('leadKpiPipeline', formatCurrency(kpi.pipeline));
}

/* ── Phase 2 exports ── */
window.getEventProfitability        = getEventProfitability;
window.openEventProfitabilityModal  = openEventProfitabilityModal;
window.addExpenseFromForm           = addExpenseFromForm;
window.deleteEventExpense           = deleteEventExpense;
window.renderEventExpensesList      = renderEventExpensesList;
window.getEventPackages             = getEventPackages;
window.openPackageModal             = openPackageModal;
window.savePackage                  = savePackage;
window.deletePackage                = deletePackage;
window.addPackageItemRow            = addPackageItemRow;
window.renderPackagesTable          = renderPackagesTable;
window.getLeads                     = getLeads;
window.openLeadModal                = openLeadModal;
window.saveLead                     = saveLead;
window.deleteLead                   = deleteLead;
window.renderLeadsTable             = renderLeadsTable;
window.getLeadKPIs                  = getLeadKPIs;
window.renderCoffeeCartView         = renderCoffeeCartView;
window.LEAD_STATUSES                = LEAD_STATUSES;
window.LEAD_STATUS_LABELS           = LEAD_STATUS_LABELS;
