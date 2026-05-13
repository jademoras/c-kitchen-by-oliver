/**
 * admin-orders.js — Real-time order management for admin dashboard.
 */

import { requireAdmin } from "./auth.js";
import { listenAllOrders, updateOrderStatus } from "./db.js";
import { showToast, formatCurrency, formatDate, statusBadge, sendNotification } from "./utils.js";

const STATUSES = ["Pending", "Accepted", "Rejected", "Preparing", "Delivered"];
let prevCount  = null; // track new orders

async function init() {
  const { profile } = await requireAdmin();
  document.getElementById("admin-name").textContent = profile.name ?? "Admin";

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { logOut } = await import("./auth.js");
    logOut();
  });

  const container  = document.getElementById("orders-container");
  const emptyMsg   = document.getElementById("orders-empty");
  const skeleton   = document.getElementById("orders-skeleton");
  const countBadge = document.getElementById("orders-count");

  // Status filter tabs
  let activeFilter = "All";
  document.querySelectorAll(".status-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".status-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.status;
      renderOrders(cachedOrders, activeFilter);
    });
  });

  let cachedOrders = [];

  listenAllOrders((orders) => {
    skeleton.style.display = "none";
    cachedOrders = orders;

    // Notify admin of new incoming orders
    if (prevCount !== null && orders.filter(o => o.status === "Pending").length > prevCount) {
      showToast("🔔 New order received!", "info", 5000);
      sendNotification("New Order! 🍽", "A new order is waiting for your action.");
    }
    prevCount = orders.filter(o => o.status === "Pending").length;

    countBadge.textContent = orders.length;
    renderOrders(orders, activeFilter);
  });
}

let cachedOrders = [];

function renderOrders(orders, filter) {
  cachedOrders = orders;
  const container = document.getElementById("orders-container");
  const emptyMsg  = document.getElementById("orders-empty");

  const filtered = filter === "All" ? orders : orders.filter(o => o.status === filter);

  if (filtered.length === 0) {
    container.innerHTML    = "";
    emptyMsg.style.display = "flex";
    return;
  }
  emptyMsg.style.display = "none";
  container.innerHTML    = filtered.map(order => adminOrderCardHTML(order)).join("");

  // Quick action buttons
  container.querySelectorAll(".quick-action-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { orderId, status } = btn.dataset;
      btn.disabled = true;
      try {
        await updateOrderStatus(orderId, status);
        showToast(`Order marked as ${status}`, "success");
      } catch (err) {
        showToast("Update failed: " + err.message, "error");
        btn.disabled = false;
      }
    });
  });

  // Status dropdown selects
  container.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", async () => {
      const orderId = sel.dataset.orderId;
      sel.disabled  = true;
      try {
        await updateOrderStatus(orderId, sel.value);
        showToast(`Status updated to ${sel.value}`, "success");
      } catch (err) {
        showToast("Update failed: " + err.message, "error");
        sel.disabled = false;
      }
    });
  });
}

function adminOrderCardHTML(order) {
  const items = order.items.map(i =>
    `<div class="admin-order-item">
      <img src="${i.imageUrl || '/assets/placeholder.svg'}" alt="${i.name}" />
      <span>${i.name} × ${i.quantity}</span>
      <span>${formatCurrency(i.price * i.quantity)}</span>
    </div>`
  ).join("");

  const quickBtns = order.status === "Pending"
    ? `<button class="btn btn-success quick-action-btn" data-order-id="${order.id}" data-status="Accepted">✔ Accept</button>
       <button class="btn btn-danger quick-action-btn" data-order-id="${order.id}" data-status="Rejected">✕ Reject</button>`
    : "";

  const selectOptions = STATUSES.map(s =>
    `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
  ).join("");

  return `
    <div class="admin-order-card status-${order.status.toLowerCase()}">
      <div class="admin-order-header">
        <div class="admin-order-meta">
          <span class="order-id">#${order.id.slice(-8).toUpperCase()}</span>
          <span class="order-date">${formatDate(order.createdAt)}</span>
        </div>
        ${statusBadge(order.status)}
      </div>
      <div class="admin-customer-info">
        <span>👤 ${order.userName}</span>
        <span>📞 ${order.userPhone}</span>
        <span>📍 ${order.userAddress}</span>
      </div>
      <div class="admin-order-items">${items}</div>
      ${order.notes ? `<p class="order-notes">📝 ${order.notes}</p>` : ""}
      <div class="admin-order-footer">
        <strong class="order-total">Total: ${formatCurrency(order.totalAmount)}</strong>
        <div class="admin-order-actions">
          ${quickBtns}
          <div class="status-update-wrap">
            <label>Update Status:</label>
            <select class="status-select" data-order-id="${order.id}">${selectOptions}</select>
          </div>
        </div>
      </div>
    </div>`;
}

init();
