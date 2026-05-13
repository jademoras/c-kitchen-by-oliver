/**
 * cart.js — Cart state management with localStorage persistence.
 */

const CART_KEY = "ck_cart";

// ─── Read / Write ─────────────────────────────────────────────────────────────

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  // Dispatch custom event so any listener on the page can react
  window.dispatchEvent(new CustomEvent("cart-updated", { detail: cart }));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Adds an item to the cart or increments its quantity.
 * @param {{ id, name, price, imageUrl }} item
 */
export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  saveCart(cart);
}

export function removeFromCart(itemId) {
  saveCart(getCart().filter(c => c.id !== itemId));
}

export function updateQuantity(itemId, quantity) {
  const cart = getCart();
  const item = cart.find(c => c.id === itemId);
  if (!item) return;
  if (quantity <= 0) {
    removeFromCart(itemId);
    return;
  }
  item.quantity = quantity;
  saveCart(cart);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new CustomEvent("cart-updated", { detail: [] }));
}

// ─── Derived Values ───────────────────────────────────────────────────────────

export function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}
