// Admin dashboard: manage cleaners, users, and orders

const API_BASE_ADMIN = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";

function getTokenAdmin() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeadersAdmin() {
  const token = getTokenAdmin();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page !== "admin") return;
  if (window.notify?.flash?.consume) window.notify.flash.consume();

  const token = getTokenAdmin();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const usersSelect = document.getElementById("user-select");
  const cleanersSelect = document.getElementById("cleaner-select");
  const ordersTbody = document.getElementById("admin-orders-tbody");
  const createCleanerForm = document.getElementById("create-cleaner-form");
  const createCleanerAccountForm = document.getElementById("create-cleaner-account-form");
  const orderAssignForm = document.getElementById("order-assign-form");

  async function loadUsers() {
    try {
      const res = await fetch(`${API_BASE_ADMIN}/admin/users`, {
        headers: authHeadersAdmin(),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          if (window.notify) window.notify.error("Please log in as an admin.");
          window.location.href = "login.html";
          return;
        }
        console.error("Failed to load users");
        return;
      }
      const users = await res.json();
      if (usersSelect) {
        usersSelect.innerHTML = `<option value="">Select user</option>`;
        users.forEach((u) => {
          const opt = document.createElement("option");
          opt.value = u.id;
          opt.textContent = `${u.name || ""} ${u.surname || ""} (${u.email}) [${u.role}]`;
          usersSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCleaners() {
    try {
      const res = await fetch(`${API_BASE_ADMIN}/admin/cleaners`, {
        headers: authHeadersAdmin(),
      });
      if (!res.ok) {
        console.error("Failed to load cleaners");
        return;
      }
      const cleaners = await res.json();
      if (cleanersSelect) {
        cleanersSelect.innerHTML = `<option value="">Select cleaner</option>`;
        cleaners.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.user_id;
          opt.textContent = `${c.user?.name || ""} ${c.user?.surname || ""} (${c.user?.email || ""})`;
          cleanersSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadOrders() {
    if (!ordersTbody) return;
    ordersTbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_BASE_ADMIN}/admin/orders`, {
        headers: authHeadersAdmin(),
      });
      if (!res.ok) {
        ordersTbody.innerHTML = "<tr><td colspan='7'>Failed to load orders.</td></tr>";
        return;
      }
      const orders = await res.json();
      if (!orders.length) {
        ordersTbody.innerHTML = "<tr><td colspan='7'>No orders yet.</td></tr>";
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
          <td>${o.city || "-"}<br/><span class="text-xs text-muted">${o.address}${
          o.apartment ? " / " + o.apartment : ""
        }</span></td>
          <td><span class="${statusClass}">${o.status}</span></td>
          <td>${o.total_price.toLocaleString()} ₸</td>
          <td class="text-xs">${itemsSummary || "-"}</td>
          <td>${o.cleaner_id ? `Cleaner #${o.cleaner_id}` : "<span class='text-xs text-muted'>Unassigned</span>"}</td>
        `;
        tr.addEventListener("click", () => {
          if (orderAssignForm) {
            orderAssignForm.order_id.value = o.id;
          }
        });
        ordersTbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      ordersTbody.innerHTML = "<tr><td colspan='7'>Error loading orders.</td></tr>";
    }
  }

  if (createCleanerForm) {
    createCleanerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = createCleanerForm.user_id.value;
      if (!userId) {
        if (window.notify) window.notify.error("Please select a user.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_ADMIN}/admin/cleaners`, {
          method: "POST",
          headers: authHeadersAdmin(),
          body: JSON.stringify({ user_id: parseInt(userId, 10), availability: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not create cleaner. Please try again.");
          return;
        }
        if (window.notify) window.notify.success("Cleaner created successfully.");
        createCleanerForm.reset();
        loadCleaners();
        loadOrders();
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  if (createCleanerAccountForm) {
    createCleanerAccountForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        name: createCleanerAccountForm.name.value.trim(),
        surname: createCleanerAccountForm.surname.value.trim(),
        email: createCleanerAccountForm.email.value.trim(),
        password: createCleanerAccountForm.password.value,
        city: createCleanerAccountForm.city.value.trim() || null,
      };

      if (!body.name || !body.surname || !body.email || !body.password) {
        if (window.notify) window.notify.error("Please fill in all required fields.");
        return;
      }
      if (body.password.length < 8) {
        if (window.notify) window.notify.error("Password must be at least 8 characters.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE_ADMIN}/admin/cleaners/create-account`, {
          method: "POST",
          headers: authHeadersAdmin(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly = data?.detail === "Email is already registered"
            ? "That email is already registered."
            : "Could not create the cleaner account. Please try again.";
          if (window.notify) window.notify.error(friendly);
          return;
        }
        if (window.notify) window.notify.success("Cleaner account created successfully.");
        createCleanerAccountForm.reset();
        loadUsers();
        loadCleaners();
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  if (orderAssignForm) {
    orderAssignForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderId = orderAssignForm.order_id.value;
      const cleanerId = orderAssignForm.cleaner_id.value;
      const status = orderAssignForm.status.value;

      if (!orderId) {
        if (window.notify) window.notify.error("Select an order from the table first.");
        return;
      }

      const body = {};
      if (cleanerId) body.cleaner_id = parseInt(cleanerId, 10);
      if (status) body.status = status;

      try {
        const res = await fetch(`${API_BASE_ADMIN}/admin/orders/${orderId}`, {
          method: "PATCH",
          headers: authHeadersAdmin(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not update the order. Please try again.");
          return;
        }
        if (window.notify) window.notify.success("Order updated successfully.");
        loadOrders();
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
      window.location.href = "login.html";
    });
  }

  async function loadFeedbacks() {
    const feedbacksList = document.getElementById("admin-feedbacks-list");
    if (!feedbacksList) return;
    
    feedbacksList.innerHTML = "<p>Loading feedbacks...</p>";
    try {
      const res = await fetch(`${API_BASE_ADMIN}/admin/feedbacks`, {
        headers: authHeadersAdmin(),
      });
      if (!res.ok) {
        feedbacksList.innerHTML = "<p class='text-muted'>Failed to load feedbacks.</p>";
        return;
      }
      const feedbacks = await res.json();
      if (!feedbacks.length) {
        feedbacksList.innerHTML = "<p class='text-muted'>No feedbacks yet.</p>";
        return;
      }
      feedbacksList.innerHTML = "";
      feedbacks.forEach((f) => {
        const card = document.createElement("div");
        card.className = "card mt-3";
        const date = new Date(f.created_at);
        const ratingStars = f.rating ? "⭐".repeat(f.rating) : "No rating";
        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div style="flex: 1;">
              <div class="flex items-center gap-2 mb-2">
                <strong>Order #${f.order_id}</strong>
                ${f.rating ? `<span class="text-sm">${ratingStars}</span>` : ""}
              </div>
              <p class="text-sm text-muted mb-2">
                By: ${f.user?.name || ""} ${f.user?.surname || ""} (${f.user?.email || ""})
              </p>
              <p class="text-sm">${f.comment}</p>
              <p class="text-xs text-muted mt-2">
                ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
              </p>
            </div>
          </div>
        `;
        feedbacksList.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      feedbacksList.innerHTML = "<p class='text-muted'>Error loading feedbacks.</p>";
    }
  }

  loadUsers();
  loadCleaners();
  loadOrders();
  loadFeedbacks();
});



