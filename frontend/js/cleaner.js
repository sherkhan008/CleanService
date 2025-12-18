// Cleaner dashboard: view available orders, take an order, and update assigned order statuses

const API_BASE_CLEANER = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";

const STATUS_FLOW = ["pending", "accepted", "going", "started", "finished"];
const ACTIVE_STATUSES = new Set(["accepted", "going", "started"]);

function getTokenCleaner() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeadersCleaner() {
  const token = getTokenCleaner();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page !== "cleaner") return;
  if (window.notify?.flash?.consume) window.notify.flash.consume();

  const token = getTokenCleaner();
  if (!token) {
    window.location.href = "cleaner_login.html";
    return;
  }

  const availableTbody = document.getElementById("available-orders-tbody");
  const ordersTbody = document.getElementById("cleaner-orders-tbody");
  let lastAssigned = [];
  let loadingAssigned = false;
  let loadingAvailable = false;

  function hasActiveOrder(orders) {
    return (orders || []).some((o) => ACTIVE_STATUSES.has(o.status));
  }

  function renderAvailableOrders(orders, canTake) {
    if (!availableTbody) return;
    if (!orders.length) {
      availableTbody.innerHTML = "<tr><td colspan='7'>No available orders right now.</td></tr>";
      return;
    }
    availableTbody.innerHTML = "";
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      const date = new Date(o.created_at);
      const statusClass = `pill-status ${o.status}`;
      tr.innerHTML = `
        <td>#${o.id}</td>
        <td>${date.toLocaleDateString()}<br/><span class="text-xs text-muted">${date.toLocaleTimeString()}</span></td>
        <td>${o.address}${o.apartment ? " / " + o.apartment : ""}</td>
        <td>${o.city || "-"}</td>
        <td><span class="${statusClass}">${o.status}</span></td>
        <td>${o.total_price.toLocaleString()} ₸</td>
        <td>
          ${
            canTake
              ? `<button class="btn btn-primary btn-pill text-xs" data-take-order="${o.id}">Take order</button>`
              : `<button class="btn btn-outline btn-pill text-xs" disabled title="Finish your current order first">Unavailable</button>`
          }
        </td>
      `;
      availableTbody.appendChild(tr);
    });
  }

  function renderAssignedOrders(orders) {
    if (!ordersTbody) return;
    if (!orders.length) {
      ordersTbody.innerHTML = "<tr><td colspan='6'>No assigned orders yet.</td></tr>";
      return;
    }
    ordersTbody.innerHTML = "";
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      const date = new Date(o.created_at);
      const statusIdx = STATUS_FLOW.indexOf(o.status);
      const nextStatus =
        statusIdx >= 0 && statusIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[statusIdx + 1] : null;
      const statusClass = `pill-status ${o.status}`;
      tr.innerHTML = `
        <td>#${o.id}</td>
        <td>${date.toLocaleDateString()}<br/><span class="text-xs text-muted">${date.toLocaleTimeString()}</span></td>
        <td>${o.address}${o.apartment ? " / " + o.apartment : ""}</td>
        <td><span class="${statusClass}">${o.status}</span></td>
        <td>${o.total_price.toLocaleString()} ₸</td>
        <td>
          ${
            nextStatus && o.status !== "finished"
              ? `<button class="btn btn-primary btn-pill text-xs" data-next-status="${nextStatus}" data-order-id="${o.id}">
                  Mark as ${nextStatus}
                </button>`
              : "<span class='text-xs text-muted'>No further actions</span>"
          }
        </td>
      `;
      ordersTbody.appendChild(tr);
    });
  }

  async function loadAssignedOrders() {
    if (loadingAssigned) return;
    loadingAssigned = true;
    if (ordersTbody) ordersTbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_BASE_CLEANER}/cleaner/orders`, {
        headers: authHeadersCleaner(),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          if (window.notify) window.notify.error("Please log in as a cleaner.");
          window.location.href = "cleaner_login.html";
          return;
        }
        if (ordersTbody) ordersTbody.innerHTML = "<tr><td colspan='6'>Failed to load orders.</td></tr>";
        return;
      }
      const orders = await res.json();
      lastAssigned = orders || [];
      renderAssignedOrders(lastAssigned);
    } catch (err) {
      console.error(err);
      if (ordersTbody) ordersTbody.innerHTML = "<tr><td colspan='6'>Error loading orders.</td></tr>";
    } finally {
      loadingAssigned = false;
    }
  }

  async function loadAvailableOrders() {
    if (!availableTbody || loadingAvailable) return;
    loadingAvailable = true;
    availableTbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_BASE_CLEANER}/cleaner/orders/available`, {
        headers: authHeadersCleaner(),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          if (window.notify) window.notify.error("Please log in as a cleaner.");
          window.location.href = "cleaner_login.html";
          return;
        }
        availableTbody.innerHTML = "<tr><td colspan='7'>Failed to load available orders.</td></tr>";
        return;
      }
      const orders = await res.json();
      const canTake = !hasActiveOrder(lastAssigned);
      renderAvailableOrders(orders || [], canTake);
    } catch (err) {
      console.error(err);
      availableTbody.innerHTML = "<tr><td colspan='7'>Error loading available orders.</td></tr>";
    } finally {
      loadingAvailable = false;
    }
  }

  // Take order
  if (availableTbody) {
    availableTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-take-order]");
      if (!btn) return;
      const orderId = btn.getAttribute("data-take-order");
      if (!orderId) return;
      if (hasActiveOrder(lastAssigned)) {
        if (window.notify) window.notify.info("Finish your current order before taking a new one.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_CLEANER}/cleaner/orders/${orderId}/take`, {
          method: "POST",
          headers: authHeadersCleaner(),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly =
            data?.detail === "CLEANER_HAS_ACTIVE_ORDER"
              ? "You already have an active order. Finish it first."
              : "Could not take this order. It may have been taken already.";
          if (window.notify) window.notify.error(friendly);
          return;
        }
        if (window.notify) window.notify.success("Order taken successfully.");
        await loadAssignedOrders();
        await loadAvailableOrders();
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  // Update order status
  if (ordersTbody) {
    ordersTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-next-status]");
      if (!btn) return;
      const orderId = btn.getAttribute("data-order-id");
      const nextStatus = btn.getAttribute("data-next-status");
      if (!orderId || !nextStatus) return;

      try {
        const res = await fetch(`${API_BASE_CLEANER}/cleaner/orders/${orderId}/status`, {
          method: "PATCH",
          headers: authHeadersCleaner(),
          body: JSON.stringify({ status: nextStatus }),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly =
            typeof data?.detail === "string" && data.detail.startsWith("INVALID_STATUS_TRANSITION")
              ? "That status change is not allowed. Please follow the order flow."
              : "Could not update status. Please try again.";
          if (window.notify) window.notify.error(friendly);
          return;
        }
        if (window.notify) window.notify.success("Status updated.");
        await loadAssignedOrders();
        await loadAvailableOrders();
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
      localStorage.removeItem("tazabolsyn_user");
      window.location.href = "cleaner_login.html";
    });
  }

  // Initial load + polling for near-real-time updates
  (async () => {
    await loadAssignedOrders();
    await loadAvailableOrders();
  })();
  setInterval(async () => {
    await loadAssignedOrders();
    await loadAvailableOrders();
  }, 5000);
});



