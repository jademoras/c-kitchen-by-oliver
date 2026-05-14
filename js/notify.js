/**
 * notify.js — Send email notification to admin when a new order is placed.
 * Uses EmailJS free tier (200 emails/month).
 * 
 * Setup: Create free account at https://www.emailjs.com
 * 1. Add an Email Service (Gmail) → get SERVICE_ID
 * 2. Create an Email Template with variables: {{order_id}}, {{customer_name}}, {{items}}, {{total}}, {{notes}}
 * 3. Get your PUBLIC_KEY from Account → API Keys
 */

const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";   // Replace after setup
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";   // Replace after setup
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID"; // Replace after setup
const ADMIN_EMAIL = "pres10lobo21@gmail.com";

let emailjsLoaded = false;

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
 * Sends an order notification email to the admin.
 * Fails silently — never blocks the order flow.
 */
export async function notifyAdmin(orderData) {
  // Skip if EmailJS is not configured
  if (EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
    console.log("[notify] EmailJS not configured, skipping email notification");
    return;
  }

  try {
    await loadEmailJS();

    const itemsList = orderData.items
      .map(i => `${i.name} × ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}`)
      .join("\n");

    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:      ADMIN_EMAIL,
      order_id:      orderData.orderId?.slice(-8)?.toUpperCase() ?? "NEW",
      customer_name: orderData.userName ?? "Customer",
      customer_phone: orderData.userPhone ?? "",
      customer_address: orderData.userAddress ?? "",
      items:         itemsList,
      total:         `₹${orderData.totalAmount.toFixed(2)}`,
      notes:         orderData.notes || "None",
      order_time:    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    });

    console.log("[notify] Admin email sent successfully");
  } catch (err) {
    // Never block the order — just log
    console.warn("[notify] Email failed (non-blocking):", err);
  }
}
