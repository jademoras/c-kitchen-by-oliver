/**
 * profile.js — Customer profile view and edit.
 */

import { requireAuth, getUserProfile } from "./auth.js";
import { updateUser } from "./db.js";
import { showToast, setLoading, isValidPhone, setFieldError, clearFieldError } from "./utils.js";

async function init() {
  const user    = await requireAuth();
  const profile = await getUserProfile(user.uid);

  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { logOut } = await import("./auth.js");
    logOut();
  });

  if (!profile) {
    showToast("Could not load profile.", "error");
    return;
  }

  // Populate fields
  const nameEl    = document.getElementById("profile-name");
  const phoneEl   = document.getElementById("profile-phone");
  const addressEl = document.getElementById("profile-address");
  const emailEl   = document.getElementById("profile-email");

  nameEl.value    = profile.name    ?? "";
  phoneEl.value   = profile.phone   ?? "";
  addressEl.value = profile.address ?? "";
  emailEl.value   = profile.email   ?? "";

  // Save handler
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    clearFieldError(nameEl);
    clearFieldError(phoneEl);
    clearFieldError(addressEl);

    if (!nameEl.value.trim()) {
      setFieldError(nameEl, "Name is required.");
      valid = false;
    }
    if (!isValidPhone(phoneEl.value)) {
      setFieldError(phoneEl, "Enter a valid 10-digit phone number.");
      valid = false;
    }
    if (!addressEl.value.trim()) {
      setFieldError(addressEl, "Address is required.");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      await updateUser(user.uid, {
        name:    nameEl.value.trim(),
        phone:   phoneEl.value.trim(),
        address: addressEl.value.trim()
      });
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      showToast("Update failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  });
}

init();
