// Account dashboard: profile, addresses, rewards, orders, TOTP setup

const API_BASE = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";
const USER_KEY = "tazabolsyn_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ensureAuthenticated() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
  }
  return token;
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page !== "account") return;
  if (window.notify?.flash?.consume) window.notify.flash.consume();

  // 2GIS map address picker for saved addresses (lazy-loads when visible)
  if (window.Map2GIS?.initAddressPicker) {
    window.Map2GIS.initAddressPicker({
      rootId: "dg-map-root-account",
      mapId: "dg-map-account",
      searchInputId: "dg-search-account",
      addressInputId: "address",
      latInputId: "latitude",
      lngInputId: "longitude",
    });
  }

  const token = ensureAuthenticated();
  if (!token) return;

  const profileForm = document.getElementById("profile-form");
  const addressForm = document.getElementById("address-form");
  const addressList = document.getElementById("address-list");
  const rewardsEl = document.getElementById("reward-points");
  const ordersTbody = document.getElementById("orders-tbody");
  const totpBtn = document.getElementById("enable-totp-btn");
  const totpInfo = document.getElementById("totp-info");
  const totpStatus = document.getElementById("totp-status");

  async function fetchProfile() {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          window.location.href = "login.html";
          return;
        }
        console.error("Failed to load profile");
        return;
      }
      const user = await res.json();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      populateProfile(user);
      populateAddresses(user.addresses || []);
      if (rewardsEl) rewardsEl.textContent = user.reward_points ?? 0;
      if (totpStatus) {
        totpStatus.textContent = user.totp_enabled
          ? "Enabled"
          : user.totp_setup_pending
            ? "Pending"
            : "Disabled";
      }
      if (totpBtn) {
        totpBtn.disabled = Boolean(user.totp_enabled || user.totp_setup_pending);
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  }

  function populateProfile(user) {
    if (!profileForm) return;
    profileForm.name.value = user.name || "";
    profileForm.surname.value = user.surname || "";
    profileForm.email.value = user.email || "";
    profileForm.city.value = user.city || "";
  }

  function populateAddresses(addresses) {
    if (!addressList) return;
    addressList.innerHTML = "";
    if (!addresses.length) {
      addressList.innerHTML = '<p class="text-muted">No saved addresses yet.</p>';
      return;
    }
    addresses.forEach((addr) => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center mt-2";
      row.innerHTML = `
        <div>
          <div>${addr.address}</div>
          ${addr.apartment ? `<div class="text-xs text-muted">Apt: ${addr.apartment}</div>` : ""}
        </div>
        <button class="btn btn-ghost text-sm" data-remove-address="${addr.id}">Remove</button>
      `;
      addressList.appendChild(row);
    });
  }

  async function fetchOrders() {
    if (!ordersTbody) return;
    ordersTbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_BASE}/orders/me`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        ordersTbody.innerHTML = "<tr><td colspan='6'>Failed to load orders.</td></tr>";
        return;
      }
      const orders = await res.json();
      if (!orders.length) {
        ordersTbody.innerHTML = "<tr><td colspan='6'>No orders yet.</td></tr>";
        return;
      }
      ordersTbody.innerHTML = "";
      orders.forEach((o) => {
        const tr = document.createElement("tr");
        const date = new Date(o.created_at);
        const statusClass = `pill-status ${o.status}`;
        const itemsSummary = o.items
          .map((i) => `${i.service_name} ×${i.quantity}`)
          .join(", ");
        tr.innerHTML = `
          <td>#${o.id}</td>
          <td>${date.toLocaleDateString()}<br/><span class="text-xs text-muted">${date.toLocaleTimeString()}</span></td>
          <td>${o.address}${o.apartment ? " / " + o.apartment : ""}</td>
          <td><span class="${statusClass}">${o.status}</span></td>
          <td>${o.total_price.toLocaleString()} ₸</td>
          <td class="text-xs">${itemsSummary || "-"}</td>
        `;
        ordersTbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      ordersTbody.innerHTML = "<tr><td colspan='6'>Error loading orders.</td></tr>";
    }
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        name: profileForm.name.value.trim(),
        surname: profileForm.surname.value.trim(),
        city: profileForm.city.value.trim() || null,
      };
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not update your profile. Please try again.");
          return;
        }
        const user = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (window.notify) window.notify.success("Profile updated successfully.");
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  if (addressForm && addressList) {
    addressForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const address = addressForm.address.value.trim();
      const apartment = addressForm.apartment.value.trim();
      if (!address) return;
      const latitude = addressForm.latitude ? parseFloat(addressForm.latitude.value || "") || null : null;
      const longitude = addressForm.longitude ? parseFloat(addressForm.longitude.value || "") || null : null;
      try {
        const res = await fetch(`${API_BASE}/users/me/addresses`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ address, apartment: apartment || null, latitude, longitude }),
        });
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not save the address. Please try again.");
          return;
        }
        addressForm.reset();
        if (addressForm.latitude) addressForm.latitude.value = "";
        if (addressForm.longitude) addressForm.longitude.value = "";
        if (window.notify) window.notify.success("Address saved.");
        fetchProfile();
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });

    addressList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-address]");
      if (!btn) return;
      const id = btn.getAttribute("data-remove-address");
      if (!confirm("Remove this address?")) return;
      try {
        const res = await fetch(`${API_BASE}/users/me/addresses/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not remove the address. Please try again.");
          return;
        }
        if (window.notify) window.notify.success("Address removed.");
        fetchProfile();
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  if (totpBtn && totpInfo && totpStatus) {
    totpBtn.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/totp/setup`, {
          method: "POST",
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly =
            data?.detail === "TOTP_SETUP_PENDING"
              ? "2FA setup is already in progress. Please finish setup without refreshing."
              : data?.detail === "TOTP_ALREADY_ENABLED"
                ? "Two-factor authentication is already enabled."
                : "Could not start 2FA setup. Please try again later.";
          if (window.notify) window.notify.error(friendly);
          return;
        }
        totpStatus.textContent = "Pending";
        totpBtn.disabled = true;
        const qrUrl = `data:image/png;base64,${data.qr_code_base64}`;
        totpInfo.innerHTML = `
          <p class="text-sm mb-2">Scan this QR code with Google Authenticator (or similar), then enter the 6-digit code to activate.</p>
          <img src="${qrUrl}" alt="TOTP QR code" />
          <div class="input-group mt-3" style="max-width: 260px;">
            <label for="totp-verify-code">6-digit code</label>
            <input class="input totp-input" id="totp-verify-code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="123456" />
          </div>
          <button id="totp-verify-btn" class="btn btn-primary btn-pill mt-2">Confirm activation</button>
          <p class="text-xs text-muted mt-2">Important: This QR code is shown only once. Please finish setup now.</p>
        `;
        const verifyBtn = document.getElementById("totp-verify-btn");
        const codeInput = document.getElementById("totp-verify-code");
        if (verifyBtn && codeInput) {
          verifyBtn.addEventListener("click", async () => {
            const code = codeInput.value.trim();
            if (!/^\d{6}$/.test(code)) {
              if (window.notify) window.notify.error("Please enter the 6-digit code from your authenticator app.");
              return;
            }
            try {
              const r = await fetch(`${API_BASE}/auth/totp/verify`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ code }),
              });
              const d = await r.json();
              if (!r.ok) {
                const friendly = d?.detail === "INVALID_TOTP"
                  ? "That code is not correct. Please try again."
                  : "Could not verify the code. Please try again.";
                if (window.notify) window.notify.error(friendly);
                return;
              }
              totpStatus.textContent = "Enabled";
              totpInfo.innerHTML = `<p class="text-sm">Two-factor authentication is now enabled.</p>`;
              if (window.notify) window.notify.success("2FA enabled successfully.");
              fetchProfile();
            } catch (err) {
              console.error(err);
              if (window.notify) window.notify.error("Network error. Please try again.");
            }
          });
        }
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = "login.html";
    });
  }

  fetchProfile();
});



