/**
 * admin-menu.js — Admin menu item management (add/edit/delete + image upload).
 * Updated to use Supabase Storage instead of Firebase Storage.
 */

import { requireAdmin } from "./auth.js";
import { supabase } from "./supabase-config.js";
import { listenMenuItems, addMenuItem, updateMenuItem, deleteMenuItem } from "./db.js";
import { showToast, setLoading, formatCurrency, formatDate } from "./utils.js";

const CATEGORIES = ["Fried Rice & Noodles", "Schezwan Special", "Kabab & Manchurian"];
let editingId    = null; // null = creating new, string = editing existing

async function init() {
  const { profile } = await requireAdmin();
  document.getElementById("admin-name").textContent = profile.name ?? "Admin";

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { logOut } = await import("./auth.js");
    logOut();
  });

  populateCategorySelects();
  setupForm();

  // Open add-item modal
  document.getElementById("add-item-btn").addEventListener("click", () => openModal(null));
  document.getElementById("modal-overlay").addEventListener("click", closeModal);
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);

  // Real-time menu list
  listenMenuItems(renderMenuTable);
}

function populateCategorySelects() {
  const select = document.getElementById("item-category");
  CATEGORIES.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(item) {
  editingId = item?.id ?? null;
  const modal     = document.getElementById("item-modal");
  const title     = document.getElementById("modal-title");
  const nameEl    = document.getElementById("item-name");
  const descEl    = document.getElementById("item-desc");
  const priceEl   = document.getElementById("item-price");
  const catEl     = document.getElementById("item-category");
  const availEl   = document.getElementById("item-available");
  const imageEl   = document.getElementById("item-image");
  const previewEl = document.getElementById("image-preview");

  title.textContent = item ? "Edit Menu Item" : "Add Menu Item";
  nameEl.value    = item?.name ?? "";
  descEl.value    = item?.description ?? "";
  priceEl.value   = item?.price ?? "";
  catEl.value     = item?.category ?? CATEGORIES[0];
  availEl.checked = item?.available !== false;
  imageEl.value   = "";
  previewEl.src   = item?.imageUrl ?? "";
  previewEl.style.display = item?.imageUrl ? "block" : "none";

  modal.classList.add("open");
  document.getElementById("modal-overlay").classList.add("visible");
}

function closeModal() {
  document.getElementById("item-modal").classList.remove("open");
  document.getElementById("modal-overlay").classList.remove("visible");
  editingId = null;
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function setupForm() {
  // Image preview on file select
  document.getElementById("item-image").addEventListener("change", (e) => {
    const file    = e.target.files[0];
    const preview = document.getElementById("image-preview");
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }
  });

  document.getElementById("menu-item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name      = document.getElementById("item-name").value.trim();
    const desc      = document.getElementById("item-desc").value.trim();
    const price     = parseFloat(document.getElementById("item-price").value);
    const category  = document.getElementById("item-category").value;
    const available = document.getElementById("item-available").checked;
    const imageFile = document.getElementById("item-image").files[0];

    if (!name || isNaN(price) || price <= 0) {
      showToast("Name and a valid price are required.", "error");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = document.getElementById("image-preview").src || "";

      // ── Upload new image to Supabase Storage if selected ──────────────────
      if (imageFile) {
        const path = `${Date.now()}_${imageFile.name.replace(/\s+/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(path, imageFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("menu-images")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const data = { name, description: desc, price, category, available, imageUrl };

      if (editingId) {
        await updateMenuItem(editingId, data);
        showToast("Menu item updated!", "success");
      } else {
        await addMenuItem(data);
        showToast("Menu item added!", "success");
      }
      closeModal();
    } catch (err) {
      showToast("Save failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  });
}

// ─── Table Rendering ──────────────────────────────────────────────────────────
let cachedItems = [];

function renderMenuTable(items) {
  cachedItems = items;
  const tbody   = document.getElementById("menu-table-body");
  const emptyMsg = document.getElementById("table-empty");

  if (items.length === 0) {
    tbody.innerHTML      = "";
    emptyMsg.style.display = "flex";
    return;
  }
  emptyMsg.style.display = "none";

  tbody.innerHTML = items.map(item => `
    <tr>
      <td><img class="table-thumb" src="${item.imageUrl || '/assets/placeholder.svg'}" alt="${item.name}" /></td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${formatCurrency(item.price)}</td>
      <td><span class="badge ${item.available !== false ? 'badge-green' : 'badge-red'}">${item.available !== false ? "Available" : "Hidden"}</span></td>
      <td class="table-actions">
        <button class="btn btn-sm btn-outline edit-btn" data-id="${item.id}">✏ Edit</button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">🗑 Delete</button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = cachedItems.find(i => i.id === btn.dataset.id);
      if (item) openModal(item);
    });
  });

  tbody.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this menu item? This cannot be undone.")) return;
      try {
        await deleteMenuItem(btn.dataset.id);
        showToast("Item deleted.", "success");
      } catch (err) {
        showToast("Delete failed: " + err.message, "error");
      }
    });
  });
}

init();
