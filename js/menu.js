/**
 * menu.js — Customer menu page: renders items, handles cart interactions.
 */

import { requireAuth, getUserProfile } from "./auth.js";
import { listenMenuItems, placeOrder } from "./db.js";
import { addToCart, getCart, getCartTotal, getCartCount, updateQuantity, removeFromCart, clearCart } from "./cart.js";
import { showToast, formatCurrency, setLoading } from "./utils.js";
import { notifyAdmin } from "./notify.js";

let currentUser   = null;
let userProfile   = null;
let unsubscribeMenu = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  currentUser = await requireAuth();
  userProfile = await getUserProfile(currentUser.uid);

  document.getElementById("user-name").textContent = userProfile?.name ?? "User";
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { logOut } = await import("./auth.js");
    logOut();
  });

  // Render cart badge and listen for updates
  updateCartBadge();
  window.addEventListener("cart-updated", updateCartBadge);

  // Category filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterItems(btn.dataset.category);
    });
  });

  // Cart panel toggle
  document.getElementById("cart-btn").addEventListener("click", openCartPanel);
  document.getElementById("cart-overlay").addEventListener("click", closeCartPanel);
  document.getElementById("close-cart-btn").addEventListener("click", closeCartPanel);

  // Checkout
  document.getElementById("checkout-btn").addEventListener("click", handleCheckout);

  // Real-time menu listener
  unsubscribeMenu = listenMenuItems(renderMenu);
}

// ─── Menu Rendering ───────────────────────────────────────────────────────────
let allItems = [];

function renderMenu(items) {
  allItems = items;
  const activeCategory = document.querySelector(".filter-btn.active")?.dataset.category ?? "All";
  filterItems(activeCategory);
}

function filterItems(category) {
  const grid   = document.getElementById("menu-grid");
  const noItem = document.getElementById("no-items");
  const items  = category === "All" ? allItems : allItems.filter(i => i.category === category);
  const available = items.filter(i => i.available !== false);

  if (available.length === 0) {
    grid.innerHTML   = "";
    noItem.style.display = "flex";
    return;
  }
  noItem.style.display = "none";
  grid.innerHTML = available.map(item => menuCardHTML(item)).join("");

  // Attach add-to-cart listeners
  grid.querySelectorAll(".add-to-cart-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const { id, name, price, imageUrl } = btn.dataset;
      addToCart({ id, name, price: parseFloat(price), imageUrl });
      showToast(`${name} added to cart!`, "success");
      
      const originalText = btn.textContent;
      btn.textContent = "Added! ✔";
      btn.classList.add("btn-success");
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove("btn-success");
      }, 1000);
    });
  });
}

function menuCardHTML(item) {
  const inCart = getCart().find(c => c.id === item.id);
  return `
    <div class="menu-card" id="card-${item.id}">
      <div class="menu-card-img-wrap">
        <img src="${item.imageUrl || '/assets/placeholder.svg'}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='/assets/placeholder.svg';" />
        <span class="menu-card-category">${item.category}</span>
      </div>
      <div class="menu-card-body">
        <h3 class="menu-card-title">${item.name}</h3>
        <p class="menu-card-desc">${item.description ?? ""}</p>
        <div class="menu-card-footer">
          <span class="menu-card-price">${formatCurrency(item.price)}</span>
          <button class="btn btn-primary add-to-cart-btn"
            data-id="${item.id}"
            data-name="${item.name}"
            data-price="${item.price}"
            data-image-url="${item.imageUrl || ''}">
            ${inCart ? "Add More" : "+ Add"}
          </button>
        </div>
      </div>
    </div>`;
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────
function openCartPanel() {
  renderCartPanel();
  document.getElementById("cart-panel").classList.add("open");
  document.getElementById("cart-overlay").classList.add("visible");
}

function closeCartPanel() {
  document.getElementById("cart-panel").classList.remove("open");
  document.getElementById("cart-overlay").classList.remove("visible");
}

function renderCartPanel() {
  const cart    = getCart();
  const list    = document.getElementById("cart-items-list");
  const total   = document.getElementById("cart-total-amount");
  const empty   = document.getElementById("cart-empty-msg");
  const actions = document.getElementById("cart-actions");

  total.textContent = formatCurrency(getCartTotal());

  if (cart.length === 0) {
    list.innerHTML        = "";
    empty.style.display   = "flex";
    actions.style.display = "none";
    return;
  }
  empty.style.display   = "none";
  actions.style.display = "block";

  list.innerHTML = cart.map(item => `
    <div class="cart-item" id="ci-${item.id}">
      <img src="${item.imageUrl || '/assets/placeholder.svg'}" alt="${item.name}" />
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">${formatCurrency(item.price)}</p>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
        <span>${item.quantity}</span>
        <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
      </div>
      <button class="cart-remove-btn" data-id="${item.id}">✕</button>
    </div>`).join("");

  list.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = cart.find(c => c.id === btn.dataset.id);
      updateQuantity(btn.dataset.id, (item?.quantity ?? 0) + parseInt(btn.dataset.delta));
      renderCartPanel();
    });
  });

  list.querySelectorAll(".cart-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      removeFromCart(btn.dataset.id);
      renderCartPanel();
    });
  });
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  const count = getCartCount();
  badge.textContent  = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
async function handleCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast("Your cart is empty!", "warning");
    return;
  }
  if (!userProfile) {
    showToast("Profile not loaded. Please refresh.", "error");
    return;
  }

  const notes = document.getElementById("order-notes")?.value ?? "";

  setLoading(true);
  try {
    const orderId = await placeOrder({
      userId:      currentUser.uid,
      userName:    userProfile.name,
      userPhone:   userProfile.phone,
      userAddress: userProfile.address,
      items:       cart.map(({ id, name, price, imageUrl, quantity }) => ({ itemId: id, name, price, imageUrl, quantity })),
      totalAmount: getCartTotal(),
      notes
    });
    clearCart();
    closeCartPanel();
    showToast("Order placed successfully! 🎉", "success", 4000);

    // Fire-and-forget email notification to admin
    notifyAdmin({
      orderId,
      userName:    userProfile.name,
      userPhone:   userProfile.phone,
      userAddress: userProfile.address,
      items:       cart,
      totalAmount: getCartTotal(),
      notes
    });

    setTimeout(() => window.location.href = "/orders.html", 1500);
  } catch (err) {
    showToast("Failed to place order: " + err.message, "error");
  } finally {
    setLoading(false);
  }
}

init();
