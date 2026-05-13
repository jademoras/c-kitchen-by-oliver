/**
 * utils.js — Shared utility functions across the app.
 */

// ─── Toast Notifications ────────────────────────────────────────────────────
export function showToast(message, type = "info", duration = 3500) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] ?? "ℹ"}</span><span class="toast-message">${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ─── Formatters ─────────────────────────────────────────────────────────────
export function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

export function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Validation ─────────────────────────────────────────────────────────────
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone.trim());
}
export function setFieldError(input, message) {
  clearFieldError(input);
  input.classList.add("input-error");
  const err = document.createElement("p");
  err.className = "field-error";
  err.textContent = message;
  input.parentNode.insertBefore(err, input.nextSibling);
}
export function clearFieldError(input) {
  input.classList.remove("input-error");
  const next = input.nextElementSibling;
  if (next && next.classList.contains("field-error")) next.remove();
}

// ─── Notifications ──────────────────────────────────────────────────────────
export async function sendNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") new Notification(title, { body, icon: "/assets/logo.svg" });
}

// ─── Loading Overlay ────────────────────────────────────────────────────────
export function setLoading(show) {
  let overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.innerHTML = `<div class="spinner"></div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? "flex" : "none";
}

// ─── Status Badge ────────────────────────────────────────────────────────────
export function statusBadge(status) {
  const map = {
    Pending:   { color: "amber",  icon: "⏳" },
    Accepted:  { color: "blue",   icon: "✔" },
    Rejected:  { color: "red",    icon: "✕" },
    Preparing: { color: "purple", icon: "👨‍🍳" },
    Delivered: { color: "green",  icon: "🎉" }
  };
  const s = map[status] ?? { color: "gray", icon: "?" };
  return `<span class="badge badge-${s.color}">${s.icon} ${status}</span>`;
}
