/**
 * db.js — All Supabase read/write helpers for the app.
 * Drop-in replacement for firestore.js — same exported function names.
 */

import { supabase } from "./supabase-config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function throwOnError({ data, error }) {
  if (error) throw error;
  return data;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) return null;
  return data;
}

export async function updateUser(uid, data) {
  throwOnError(
    await supabase
      .from("users")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", uid)
  );
}

// ─── Menu Items ──────────────────────────────────────────────────────────────

export async function getMenuItems() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Normalize snake_case → camelCase for UI compatibility
  return (data ?? []).map(normalizeMenuItem);
}

export function listenMenuItems(callback) {
  // Initial fetch
  getMenuItems().then(callback);

  const channel = supabase
    .channel("menu_items_rt")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_items" },
      async () => {
        const items = await getMenuItems();
        callback(items);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function addMenuItem(data) {
  throwOnError(
    await supabase.from("menu_items").insert(denormalizeMenuItem(data))
  );
}

export async function updateMenuItem(id, data) {
  throwOnError(
    await supabase
      .from("menu_items")
      .update({ ...denormalizeMenuItem(data), updated_at: new Date().toISOString() })
      .eq("id", id)
  );
}

export async function deleteMenuItem(id) {
  throwOnError(await supabase.from("menu_items").delete().eq("id", id));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Places a new order.
 * @param {object} orderData - { userId, userName, userPhone, userAddress, items, totalAmount, notes }
 * @returns {string} The new order's UUID
 */
export async function placeOrder(orderData) {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id:      orderData.userId,
      user_name:    orderData.userName,
      user_phone:   orderData.userPhone,
      user_address: orderData.userAddress,
      items:        orderData.items,
      total_amount: orderData.totalAmount,
      notes:        orderData.notes ?? "",
      status:       "Pending"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function getUserOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeOrder);
}

async function getAllOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeOrder);
}

/**
 * Listens to orders for a specific customer in real-time.
 */
export function listenUserOrders(userId, callback) {
  getUserOrders(userId).then(callback);

  const channel = supabase
    .channel(`user_orders_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `user_id=eq.${userId}`
      },
      async () => {
        const orders = await getUserOrders(userId);
        callback(orders);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Listens to ALL orders in real-time (admin use).
 */
export function listenAllOrders(callback) {
  getAllOrders().then(callback);

  const channel = supabase
    .channel("all_orders_rt")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      async () => {
        const orders = await getAllOrders();
        callback(orders);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Updates the status of an order (admin use).
 */
export async function updateOrderStatus(orderId, status) {
  throwOnError(
    await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId)
  );
}

// ─── Field normalizers (snake_case DB ↔ camelCase UI) ────────────────────────

function normalizeMenuItem(row) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    price:       Number(row.price),
    category:    row.category,
    available:   row.available,
    imageUrl:    row.image_url ?? "",
    createdAt:   row.created_at,
    updatedAt:   row.updated_at
  };
}

function denormalizeMenuItem(data) {
  return {
    name:        data.name,
    description: data.description ?? "",
    price:       data.price,
    category:    data.category,
    available:   data.available ?? true,
    image_url:   data.imageUrl ?? ""
  };
}

function normalizeOrder(row) {
  return {
    id:          row.id,
    userId:      row.user_id,
    userName:    row.user_name,
    userPhone:   row.user_phone,
    userAddress: row.user_address,
    items:       row.items ?? [],
    totalAmount: Number(row.total_amount),
    notes:       row.notes ?? "",
    status:      row.status,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at
  };
}
