/**
 * notify.js — Smart order notification system.
 * 
 * Uses Supabase Realtime Presence to detect if admin is online.
 * - If admin dashboard is OPEN → skip email (they see it in real-time)
 * - If admin is OFFLINE → send email notification
 * 
 * EmailJS Setup (free 200 emails/month):
 * 1. Create account at https://www.emailjs.com
 * 2. Add Email Service (Gmail) → get SERVICE_ID
 * 3. Create Email Template → get TEMPLATE_ID
 * 4. Get PUBLIC_KEY from Account → API Keys
 */

import { supabase } from "./supabase-config.js";

// ─── EmailJS Config (replace after setup) ────────────────────────────────────
const EMAILJS_PUBLIC_KEY  = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID  = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const ADMIN_EMAIL = "pres10lobo21@gmail.com";

// ─── Presence Channel (shared between admin dashboard and customer checkout) ─
const PRESENCE_CHANNEL = "admin_presence";

let emailjsLoaded = false;

/**
 * Called by admin dashboard to announce "I'm online".
 * As long as the admin has the dashboard tab open, they're tracked as present.
 */
export function trackAdminPresence(adminId) {
  const channel = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: adminId } }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      console.log("[presence] Admin dashboard synced");
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString(), role: "admin" });
        console.log("[presence] Admin presence tracked");
      }
    });

  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    channel.untrack();
  });

  return channel;
}

/**
 * Checks if any admin is currently on the dashboard.
 */
async function isAdminOnline() {
  return new Promise((resolve) => {
    const channel = supabase.channel(PRESENCE_CHANNEL);
    let resolved = false;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const adminCount = Object.keys(state).length;
        
        // If we found an admin, resolve immediately
        if (adminCount > 0 && !resolved) {
          console.log(`[presence] Admins online: ${adminCount}`);
          resolved = true;
          supabase.removeChannel(channel);
          resolve(true);
        }
      })
      .subscribe();

    // Give it 2.5 seconds to find an admin. If not, assume offline.
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        supabase.removeChannel(channel);
        resolve(false);
      }
    }, 2500);
  });
}

// Lazy-load the EmailJS SDK
function loadEmailJS() {
  if (emailjsLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.onload = () => {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjsLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Smart notification: only emails if admin is NOT on the dashboard.
 * Fails silently — never blocks the order flow.
 */
export async function notifyAdmin(orderData) {
  try {
    // 1. Check if admin is online
    const adminOnline = await isAdminOnline();
    if (adminOnline) {
      console.log("[notify] Admin is online — skipping email");
      return;
    }

    // 2. Admin is offline — send email
    if (EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
      console.log("[notify] EmailJS not configured — would send email here");
      console.log("[notify] Order details:", JSON.stringify(orderData, null, 2));
      return;
    }

    await loadEmailJS();

    const itemsList = orderData.items
      .map(i => `${i.name} × ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}`)
      .join("\n");

    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:         ADMIN_EMAIL,
      order_id:         orderData.orderId?.slice(-8)?.toUpperCase() ?? "NEW",
      customer_name:    orderData.userName ?? "Customer",
      customer_phone:   orderData.userPhone ?? "",
      customer_address: orderData.userAddress ?? "",
      items:            itemsList,
      total:            `₹${orderData.totalAmount.toFixed(2)}`,
      notes:            orderData.notes || "None",
      order_time:       new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    });

    console.log("[notify] Admin offline → email sent successfully");
  } catch (err) {
    console.warn("[notify] Notification failed (non-blocking):", err);
  }
}
