// Cleaner dashboard: view and update assigned orders

const API_BASE_CLEANER = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";

const STATUS_FLOW = ["pending", "accepted", "going", "started", "finished", "paid"];

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

  const token = getTokenCleaner();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const ordersTbody = document.getElementById("cleaner-orders-tbody");

  async function loadOrders() {
    if (!ordersTbody) return;
    ordersTbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_BASE_CLEANER}/cleaner/orders`, {
        headers: authHeadersCleaner(),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("You must be logged in as a cleaner.");
          window.location.href = "login.html";
          return;
        }
        ordersTbody.innerHTML = "<tr><td colspan='6'>Failed to load orders.</td></tr>";
        return;
      }
      const orders = await res.json();
      if (!orders.length) {
        ordersTbody.innerHTML = "<tr><td colspan='6'>No assigned orders yet.</td></tr>";
        return;
      }
      ordersTbody.innerHTML = "";
      orders.forEach((o) => {
        const tr = document.createElement("tr");
        const date = new Date(o.created_at);
        const statusIdx = STATUS_FLOW.indexOf(o.status);
        const nextStatus = statusIdx >= 0 && statusIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[statusIdx + 1] : null;
        const statusClass = `pill-status ${o.status}`;
        tr.innerHTML = `
          <td>#${o.id}</td>
          <td>${date.toLocaleDateString()}<br/><span class="text-xs text-muted">${date.toLocaleTimeString()}</span></td>
          <td>${o.address}${o.apartment ? " / " + o.apartment : ""}</td>
          <td><span class="${statusClass}">${o.status}</span></td>
          <td>${o.total_price.toLocaleString()} ₸</td>
          <td>
            ${
              nextStatus
                ? `<button class="btn btn-primary btn-pill text-xs" data-next-status="${nextStatus}" data-order-id="${o.id}">
                    Mark as ${nextStatus}
                  </button>`
                : "<span class='text-xs text-muted'>No further actions</span>"
            }
          </td>
        `;
        ordersTbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      ordersTbody.innerHTML = "<tr><td colspan='6'>Error loading orders.</td></tr>";
    }
  }

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
          alert(data?.detail || "Failed to update status.");
          return;
        }
        loadOrders();
      } catch (err) {
        console.error(err);
        alert("Network error.");
      }
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("tazabolsyn_user");
      window.location.href = "login.html";
    });
  }

  loadOrders();
});


