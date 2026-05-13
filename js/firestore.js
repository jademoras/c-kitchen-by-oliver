/**
 * firestore.js — All Firestore read/write helpers for the app.
 * Keeps database logic separate from UI logic.
 */

import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

// ─── Menu Items ──────────────────────────────────────────────────────────────

export async function getMenuItems() {
  const snap = await getDocs(query(collection(db, "menuItems"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function listenMenuItems(callback) {
  const q = query(collection(db, "menuItems"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addMenuItem(data) {
  return await addDoc(collection(db, "menuItems"), { ...data, createdAt: serverTimestamp() });
}

export async function updateMenuItem(id, data) {
  await updateDoc(doc(db, "menuItems", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteMenuItem(id) {
  await deleteDoc(doc(db, "menuItems", id));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Places a new order in Firestore.
 * @param {object} orderData - { userId, userName, userPhone, userAddress, items, totalAmount, notes }
 * @returns {string} The new order's document ID
 */
export async function placeOrder(orderData) {
  const ref = await addDoc(collection(db, "orders"), {
    ...orderData,
    status:    "Pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Listens to orders for a specific customer in real-time.
 */
export function listenUserOrders(userId, callback) {
  const q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Listens to ALL orders in real-time (admin use).
 */
export function listenAllOrders(callback) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Updates the status of an order (admin use).
 */
export async function updateOrderStatus(orderId, status) {
  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp()
  });
}
