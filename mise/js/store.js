/* ═══════════════════════════════════════════════════════════════
   MISE — STORE  ·  tiny reactive state
═══════════════════════════════════════════════════════════════ */
const STORE = (() => {
  const state = {
    view: 'command',
    theme: localStorage.getItem('mise-theme') ||
           (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    cart: [],                     // {id, name, price, qty, emoji}
    asOfHour: DATA.today.getHours(),
    completedToday: 0,
    revenueToday: 0,
  };
  const subs = new Set();
  function set(patch) { Object.assign(state, patch); subs.forEach(fn => fn(state)); }
  function sub(fn) { subs.add(fn); return () => subs.delete(fn); }

  // cart helpers
  function addToCart(p) {
    const line = state.cart.find(l => l.id === p.id);
    if (line) line.qty++;
    else state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji });
    set({ cart: state.cart });
  }
  function decCart(id) {
    const line = state.cart.find(l => l.id === id);
    if (!line) return;
    line.qty--; if (line.qty <= 0) state.cart = state.cart.filter(l => l.id !== id);
    set({ cart: state.cart });
  }
  function clearCart() { set({ cart: [] }); }
  function cartTotal() { return state.cart.reduce((s, l) => s + l.price * l.qty, 0); }
  function cartCount() { return state.cart.reduce((s, l) => s + l.qty, 0); }

  function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
  function toggleTheme() {
    const t = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mise-theme', t); set({ theme: t }); applyTheme();
  }

  return { state, set, sub, addToCart, decCart, clearCart, cartTotal, cartCount, applyTheme, toggleTheme };
})();
