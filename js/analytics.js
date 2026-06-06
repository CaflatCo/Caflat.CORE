
function getAnalyticsSales(){
  return Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
}

function getRevenue(){
  return getAnalyticsSales().reduce((s,sale)=>s + Number(sale.total ?? sale.totals?.total ?? 0),0);
}

function getOrderCount(){
  return getAnalyticsSales().length;
}

function getAverageTicket(){
  const orders=getOrderCount();
  return orders ? getRevenue()/orders : 0;
}

function getTopProducts(limit=5){
  const totals={};
  getAnalyticsSales().forEach(sale=>{
    (sale.items||[]).forEach(item=>{
      totals[item.name]=(totals[item.name]||0)+Number(item.quantity||0);
    });
  });

  return Object.entries(totals)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,limit)
    .map(([name,qty])=>({name,qty}));
}

function getLowStockItems(){
  return (APP_STATE.ingredients||[]).filter(
    i => Number(i.stock||0) <= Number(i.reorderLevel||0)
  );
}


/* ── Product cost calculation ── */
function calculateProductCost(recipe, ingredients) {
  // recipe: array of { ingredientId, quantity }
  // ingredients: full ingredient list (defaults to APP_STATE.ingredients)
  const ingList = Array.isArray(ingredients) ? ingredients : (APP_STATE.ingredients || []);
  if (!Array.isArray(recipe) || !recipe.length) return 0;

  return recipe.reduce((total, recipeItem) => {
    const ing = ingList.find(i => String(i.id) === String(recipeItem.ingredientId));
    if (!ing) return total;
    return total + Number(recipeItem.quantity || 0) * Number(ing.costPerUnit || 0);
  }, 0);
}

/* ── Live product cost preview from current form state ── */
function calculateProductCostFromForm() {
  const rows = document.querySelectorAll('.recipe-row');
  const ingredients = APP_STATE.ingredients || [];
  let total = 0;
  rows.forEach(row => {
    const ingredientId = row.querySelector('.recipe-ingredient')?.value;
    const quantity     = Number(row.querySelector('.recipe-qty')?.value || 0);
    if (!ingredientId || !quantity) return;
    const ing = ingredients.find(i => String(i.id) === String(ingredientId));
    if (!ing) return;
    total += quantity * Number(ing.costPerUnit || 0);
  });
  return total;
}

window.calculateProductCost         = calculateProductCost;
window.calculateProductCostFromForm = calculateProductCostFromForm;

window.getRevenue=getRevenue;
window.getOrderCount=getOrderCount;
window.getAverageTicket=getAverageTicket;
window.getTopProducts=getTopProducts;
window.getLowStockItems=getLowStockItems;
