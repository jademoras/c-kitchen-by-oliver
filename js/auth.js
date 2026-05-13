/**
 * auth.js — Supabase Authentication helpers + route guards.
 * Drop-in replacement for the Firebase version — same exported function names.
 */

import { supabase } from "./supabase-config.js";
import { showToast, setLoading } from "./utils.js";

// ─── Sign Up ─────────────────────────────────────────────────────────────────
/**
 * Creates a new customer account and saves their profile in the users table.
 */
export async function signUp({ name, email, phone, address, password }) {
  setLoading(true);
  try {
    // 1. Create auth user
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const user = data.user;

    // 2. Insert profile row (id matches auth.users.id)
    const { error: dbError } = await supabase.from("users").insert({
      id:      user.id,
      name,
      email,
      phone,
      address,
      role:    "customer"
    });
    if (dbError) throw dbError;

    return user;
  } finally {
    setLoading(false);
  }
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  } finally {
    setLoading(false);
  }
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export async function logOut() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

// ─── Get Current User Profile ────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) return null;
  return data;
}

// ─── Route Guards ────────────────────────────────────────────────────────────

/**
 * Redirects unauthenticated users to login.
 * Resolves with the Supabase user if authenticated.
 */
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/index.html";
    return new Promise(() => {}); // never resolves — page is redirecting
  }
  return session.user;
}

/**
 * Requires the user to be an admin (role === "admin").
 * Resolves with { user, profile } if authorized.
 */
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/admin/index.html";
    return new Promise(() => {});
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile || profile.role !== "admin") {
    showToast("Access denied. Admins only.", "error");
    await supabase.auth.signOut();
    window.location.href = "/admin/index.html";
    return new Promise(() => {});
  }

  return { user: session.user, profile };
}

/**
 * Redirects already-authenticated users away from auth pages.
 * @param {string} redirectUrl - Where to send authenticated customers
 */
export async function redirectIfAuthenticated(redirectUrl = "/menu.html") {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const profile = await getUserProfile(session.user.id);
  if (profile?.role === "admin") {
    window.location.href = "/admin/dashboard.html";
  } else {
    window.location.href = redirectUrl;
  }
}
