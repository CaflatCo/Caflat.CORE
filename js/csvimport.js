/* ═══════════════════════════════════════════════════════
   CSVIMPORT.JS — Import products & ingredients from CSV
═══════════════════════════════════════════════════════ */

let _csvData = null;   // { headers: [], rows: [] }
let _csvType = 'products';
let _csvStep = 1;

const _CSV_PRODUCT_FIELDS = [
  { key: 'name',     label: 'Name *',   required: true  },
  { key: 'price',    label: 'Price',    required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'sku',      label: 'SKU / Code', required: false }
];

const _CSV_INGREDIENT_FIELDS = [
  { key: 'name',        label: 'Name *',        required: true  },
  { key: 'unit',        label: 'Unit',          required: false },
  { key: 'costPerUnit', label: 'Cost Per Unit',  required: false },
  { key: 'stock',       label: 'Stock Qty',      required: false }
];

// Known aliases for auto-matching CSV column names → Caflat fields
const _CSV_ALIASES = {
  name:        ['name','item','product','ingredient','title','description','desc','itemname','productname'],
  price:       ['price','cost','amount','rate','sellingprice','unitprice','saleprice','sell'],
  category:    ['category','cat','group','type','department','dept','class'],
  sku:         ['sku','code','itemcode','barcode','ref','id','productcode','upc'],
  unit:        ['unit','uom','measure','unitofmeasure','quantityunit','measureunit'],
  costPerUnit: ['costperunit','unitcost','purchasecost','ingredientcost','cost','price','rate'],
  stock:       ['stock','qty','quantity','onhand','inventory','balance','stockqty','currentstock']
};

function openCSVImportModal() {
  _csvData = null;
  _csvStep = 1;
  _csvType = 'products';

  const step1  = document.getElementById('csvStep1');
  const step2  = document.getElementById('csvStep2');
  const step3  = document.getElementById('csvStep3');
  const nextBtn = document.getElementById('csvNextBtn');
  const cancelBtn = document.getElementById('csvCancelBtn');
  const dropZone = document.getElementById('csvDropZone');

  if (step1)     { step1.style.display = ''; }
  if (step2)     { step2.style.display = 'none'; }
  if (step3)     { step3.style.display = 'none'; }
  if (nextBtn)   { nextBtn.textContent = 'Next'; nextBtn.style.display = ''; }
  if (cancelBtn) { cancelBtn.textContent = 'Cancel'; }

  // Reset file input
  const fileInput = document.getElementById('csvFileInput');
  if (fileInput) fileInput.value = '';

  // Reset type radio
  document.querySelectorAll('input[name="csvImportType"]').forEach(r => {
    r.checked = r.value === 'products';
  });

  // Reset drop zone appearance
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background  = 'var(--white)';
  }
  const dropMsg = document.getElementById('csvDropMsg');
  if (dropMsg) dropMsg.textContent = 'Drop your CSV file here, or tap to browse';

  openModal('csvImportModal');
}

/* ── CSV parsing ── */

function _parseCSVRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function _parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = _parseCSVRow(lines[0]);
  const rows = lines.slice(1)
    .map(l => _parseCSVRow(l))
    .filter(r => r.some(c => c !== ''));
  return { headers, rows };
}

/* ── File handling ── */

function csvImportHandleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showNotification('Please select a .csv file', 'error');
    return;
  }

  const dropMsg = document.getElementById('csvDropMsg');
  const dropZone = document.getElementById('csvDropZone');
  if (dropMsg)  dropMsg.textContent = file.name;
  if (dropZone) dropZone.style.borderColor = 'var(--black)';

  const reader = new FileReader();
  reader.onload = e => {
    const parsed = _parseCSV(e.target.result);
    if (!parsed || !parsed.headers.length) {
      showNotification('Could not read CSV — check the file format', 'error');
      if (dropMsg)  dropMsg.textContent = 'Drop your CSV file here, or tap to browse';
      if (dropZone) dropZone.style.borderColor = 'var(--border)';
      return;
    }
    _csvData = parsed;
  };
  reader.readAsText(file);
}

/* ── Step navigation ── */

function csvImportNext() {
  if (_csvStep === 1) {
    if (!_csvData) {
      showNotification('Please select a CSV file first', 'error');
      return;
    }
    _csvShowMappingStep();
  } else if (_csvStep === 2) {
    const nameSelect = document.getElementById('csvMap_name');
    if (!nameSelect || nameSelect.value === '') {
      showNotification('You must map the Name column', 'error');
      return;
    }
    _csvExecuteImport();
  }
}

/* ── Step 2: column mapping ── */

function _csvNorm(s) {
  return String(s).toLowerCase().replace(/[\s_\-\.\/]+/g, '');
}

// Returns a mapping of { fieldKey → columnIndex } for all fields at once.
// Two-pass: exact alias match wins over substring, and each column can only
// be assigned to one field (first-claimed takes it).
function _csvAutoMatchAll(fields, headers) {
  const normed = headers.map(h => _csvNorm(h));
  const result = {};  // fieldKey → colIdx
  const claimed = new Set(); // colIdx already assigned

  // Pass 1: exact alias match
  fields.forEach(f => {
    const aliases = _CSV_ALIASES[f.key] || [];
    const idx = normed.findIndex((nh, i) => !claimed.has(i) && aliases.includes(nh));
    if (idx !== -1) { result[f.key] = idx; claimed.add(idx); }
  });

  // Pass 2: header contains alias as substring (one direction only)
  fields.forEach(f => {
    if (result[f.key] !== undefined) return;
    const aliases = _CSV_ALIASES[f.key] || [];
    const idx = normed.findIndex((nh, i) => {
      if (claimed.has(i)) return false;
      return aliases.some(a => nh.includes(a));
    });
    if (idx !== -1) { result[f.key] = idx; claimed.add(idx); }
  });

  return result;
}

function _csvShowMappingStep() {
  _csvStep = 2;

  const typeRadio = document.querySelector('input[name="csvImportType"]:checked');
  _csvType = typeRadio?.value || 'products';

  document.getElementById('csvStep1').style.display = 'none';
  document.getElementById('csvStep2').style.display = '';
  document.getElementById('csvNextBtn').textContent = 'Import';

  const fields  = _csvType === 'products' ? _CSV_PRODUCT_FIELDS : _CSV_INGREDIENT_FIELDS;
  const headers = _csvData.headers;
  const autoMap = _csvAutoMatchAll(fields, headers);

  const hint = _csvType === 'products'
    ? `Missing price → imported at ${getCurrencySymbol()}0, flagged for review. Missing category → "General".`
    : 'Missing cost → imported at 0. Missing unit → "pcs".';

  document.getElementById('csvMappingHint').textContent = hint;

  const container = document.getElementById('csvMappingTable');
  container.innerHTML = fields.map(f => {
    const autoIdx = autoMap[f.key] ?? -1;
    const opts = headers.map((h, i) =>
      `<option value="${i}"${i === autoIdx ? ' selected' : ''}>${h}</option>`
    ).join('');
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 0;border-bottom:1px solid var(--border);gap:16px;">
        <div style="font-size:12px;font-weight:800;min-width:120px;color:var(--black);">${f.label}</div>
        <select id="csvMap_${f.key}"
          style="flex:1;padding:7px 10px;border:1.5px solid var(--border);
            border-radius:8px;font-size:12px;font-family:var(--font-main);
            background:var(--white);color:var(--black);">
          <option value="">— skip —</option>
          ${opts}
        </select>
      </div>`;
  }).join('');
}

/* ── Step 3: execute import ── */

function _csvCell(row, colIdx) {
  if (colIdx < 0 || colIdx >= row.length) return '';
  return (row[colIdx] || '').trim();
}

// Strip currency symbols and thousands commas before parsing
// Handles: $12.50  ₱1,200.00  €9.99  1.200,50 (EU format → not handled, edge case)
function _csvParseNumber(s) {
  const cleaned = String(s || '').replace(/[₱$€£¥\s]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function _csvExecuteImport() {
  const mapping = {};
  const fields = _csvType === 'products' ? _CSV_PRODUCT_FIELDS : _CSV_INGREDIENT_FIELDS;
  fields.forEach(f => {
    const sel = document.getElementById(`csvMap_${f.key}`);
    mapping[f.key] = (sel && sel.value !== '') ? parseInt(sel.value, 10) : -1;
  });

  let imported = 0, skipped = 0, flagged = 0;
  const flaggedNames = [];

  if (_csvType === 'products') {
    const newProducts = [];

    _csvData.rows.forEach(row => {
      const name = sanitizeText(_csvCell(row, mapping.name));
      if (!name) { skipped++; return; }

      const priceRaw   = _csvCell(row, mapping.price);
      const priceNum   = priceRaw !== '' ? _csvParseNumber(priceRaw) : NaN;
      const needsPrice = priceRaw === '' || isNaN(priceNum);

      const product = {
        id:           generateId(),
        name,
        price:        needsPrice ? 0 : priceNum,
        category:     sanitizeText(_csvCell(row, mapping.category)) || 'General',
        sku:          sanitizeText(_csvCell(row, mapping.sku))       || '',
        stock:        0,
        reorderLevel: 0,
        variants:     [],
        recipe:       [],
        recipeMode:   'unit',
        batchYield:   1,
        createdAt:    new Date().toISOString()
      };
      if (needsPrice) product.needsPriceReview = true;

      newProducts.push(product);
      imported++;
      if (needsPrice) { flagged++; flaggedNames.push(name); }
    });

    APP_STATE.products = [...(APP_STATE.products || []), ...newProducts];

    // Auto-create any new categories
    const existingCats = new Set(getCategories().map(c => (typeof c === 'object' ? c.name : c)));
    const newCatNames  = [...new Set(
      newProducts.map(p => p.category).filter(c => c && c !== 'General' && !existingCats.has(c))
    )];
    newCatNames.forEach(catName => {
      APP_STATE.categories.push({ id: generateId(), name: catName, inventoryMode: 'direct' });
    });

  } else {
    // Ingredients
    _csvData.rows.forEach(row => {
      const name = sanitizeText(_csvCell(row, mapping.name));
      if (!name) { skipped++; return; }

      const costRaw  = _csvCell(row, mapping.costPerUnit);
      const costNum  = costRaw !== '' ? _csvParseNumber(costRaw) : 0;
      const stockRaw = _csvCell(row, mapping.stock);
      const stockNum = stockRaw !== '' ? _csvParseNumber(stockRaw) : 0;
      const needsCost = costRaw === '';

      APP_STATE.ingredients.push({
        id:              generateId(),
        name,
        unit:            sanitizeText(_csvCell(row, mapping.unit)) || 'pcs',
        costPerUnit:     isNaN(costNum)  ? 0 : costNum,
        stock:           isNaN(stockNum) ? 0 : stockNum,
        reorderLevel:    0,
        packageQuantity: 1,
        packageCost:     isNaN(costNum)  ? 0 : costNum,
        createdAt:       new Date().toISOString()
      });

      imported++;
      if (needsCost) { flagged++; flaggedNames.push(name); }
    });
  }

  persistState();
  if (typeof renderEverything === 'function') renderEverything();
  if (typeof renderCategoryOptions === 'function') renderCategoryOptions();

  _csvShowSummary(imported, skipped, flagged, flaggedNames);
}

function _csvShowSummary(imported, skipped, flagged, flaggedNames) {
  _csvStep = 3;

  document.getElementById('csvStep2').style.display = 'none';
  document.getElementById('csvNextBtn').style.display = 'none';

  const cancelBtn = document.getElementById('csvCancelBtn');
  if (cancelBtn) cancelBtn.textContent = 'Done';

  const typeLabel  = _csvType === 'products' ? 'products' : 'ingredients';
  const flagLabel  = _csvType === 'products' ? 'need price review' : 'missing cost — set to 0';

  const flagBlock = flagged > 0 ? `
    <div style="margin-top:16px;padding:12px 14px;background:#fffbeb;
      border:1.5px solid #fcd34d;border-radius:10px;text-align:left;">
      <div style="font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px;">
        ${flagged} item${flagged > 1 ? 's' : ''} ${flagLabel}:
      </div>
      ${flaggedNames.slice(0, 6).map(n =>
        `<div style="font-size:11px;color:#92400e;margin-top:2px;">· ${escapeHtml(n)}</div>`
      ).join('')}
      ${flaggedNames.length > 6
        ? `<div style="font-size:11px;color:#92400e;margin-top:2px;">· and ${flaggedNames.length - 6} more…</div>`
        : ''}
    </div>` : '';

  const step3 = document.getElementById('csvStep3');
  step3.style.display = '';
  step3.innerHTML = `
    <div style="text-align:center;padding:24px 0 8px;">
      <div style="font-size:36px;margin-bottom:12px;">✓</div>
      <div style="font-size:18px;font-weight:900;margin-bottom:8px;color:var(--black);">Import Complete</div>
      <div style="font-size:13px;color:var(--gray-500);line-height:1.6;">
        ${imported} ${typeLabel} imported
        ${skipped > 0   ? `&nbsp;·&nbsp; ${skipped} skipped (no name)` : ''}
        ${flagged > 0   ? `&nbsp;·&nbsp; ${flagged} ${flagLabel}` : ''}
      </div>
      ${flagBlock}
    </div>`;
}

/* ── Drag-and-drop wiring (called after DOM ready) ── */

function _initCSVDropZone() {
  const zone  = document.getElementById('csvDropZone');
  const input = document.getElementById('csvFileInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--black)';
    zone.style.background  = 'var(--gray-50)';
  });

  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = 'var(--border)';
    zone.style.background  = 'var(--white)';
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--border)';
    zone.style.background  = 'var(--white)';
    const file = e.dataTransfer?.files?.[0];
    if (file) csvImportHandleFile(file);
  });

  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) csvImportHandleFile(file);
    e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', _initCSVDropZone);

window.openCSVImportModal = openCSVImportModal;
window.csvImportHandleFile = csvImportHandleFile;
window.csvImportNext      = csvImportNext;
