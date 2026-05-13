/**
 * orders.js — Customer order history with real-time status updates.
 */

import { requireAuth } from "./auth.js";
import { listenUserOrders } from "./db.js";
import { showToast, formatCurrency, formatDate, statusBadge, sendNotification } from "./utils.js";

let prevStatuses = {};

async function init() {
  const user = await requireAuth();

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { logOut } = await import("./auth.js");
    logOut();
  });

  const container = document.getElementById("orders-container");
  const emptyMsg  = document.getElementById("orders-empty");
  const skeleton  = document.getElementById("orders-skeleton");

  // Real-time listener
  listenUserOrders(user.uid, (orders) => {
    skeleton.style.display = "none";

    if (orders.length === 0) {
      container.innerHTML  = "";
      emptyMsg.style.display = "flex";
      return;
    }
    emptyMsg.style.display = "none";

    // Detect status changes and notify
    orders.forEach(order => {
      if (prevStatuses[order.id] && prevStatuses[order.id] !== order.status) {
        const msg = `Order ${order.id.slice(-6).toUpperCase()}: Status changed to ${order.status}`;
        showToast(msg, order.status === "Rejected" ? "error" : "success", 5000);
        sendNotification("Order Update 🍽", msg);
      }
      prevStatuses[order.id] = order.status;
    });

    container.innerHTML = orders.map(order => orderCardHTML(order)).join("");
  });
}

function orderCardHTML(order) {
  const items = order.items.map(i =>
    `<div class="order-item-row">
      <img src="${i.imageUrl || '/assets/placeholder.svg'}" alt="${i.name}" />
      <span>${i.name} × ${i.quantity}</span>
      <span>${formatCurrency(i.price * i.quantity)}</span>
    </div>`
  ).join("");

  return `
    <div class="order-card" id="order-${order.id}">
      <div class="order-card-header">
        <div>
          <span class="order-id">#${order.id.slice(-8).toUpperCase()}</span>
          <span class="order-date">${formatDate(order.createdAt)}</span>
        </div>
        ${statusBadge(order.status)}
      </div>
      <div class="order-items">${items}</div>
      ${order.notes ? `<p class="order-notes">📝 ${order.notes}</p>` : ""}
      <div class="order-card-footer">
        <span class="order-total">Total: ${formatCurrency(order.totalAmount)}</span>
      </div>
    </div>`;
}

init();
