// Cleaning price calculator & order creation

const CALC_API_BASE = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";

const SERVICES = [
  { key: "window", name: "Window cleaning", price: 4200 },
  { key: "fridge", name: "Refrigerator cleaning", price: 3500 },
  { key: "dishwashing", name: "Dishwashing (hour)", price: 3500 },
  { key: "ironing", name: "Ironing (hour)", price: 3500 },
  { key: "closet", name: "Closet / Pantry", price: 2500 },
  { key: "chandelier", name: "Chandelier", price: 2000 },
  { key: "balcony", name: "Balcony", price: 6000 },
  { key: "wall", name: "Wall washing (10 m²)", price: 10000 },
  { key: "blinds", name: "Blinds (per m²)", price: 1500 },
  { key: "extra_cleaner", name: "Extra cleaner", price: 7000 },
  { key: "kitchen_set", name: "Kitchen set", price: 8000 },
  { key: "oven", name: "Oven", price: 4500 },
  { key: "microwave", name: "Microwave", price: 2000 },
  { key: "dishwasher", name: "Dishwasher", price: 2000 },
  { key: "curtains", name: "Curtains", price: 2500 },
  { key: "ceiling", name: "Ceiling (per m²)", price: 1500 },
  { key: "key_delivery", name: "Key delivery", price: 2000 },
];

function getTokenCalc() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeadersCalc() {
  const token = getTokenCalc();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page !== "calculation") return;
  if (window.notify?.flash?.consume) window.notify.flash.consume();

  // 2GIS map address picker (lazy-loads when visible)
  if (window.Map2GIS?.initAddressPicker) {
    window.Map2GIS.initAddressPicker({
      rootId: "dg-map-root",
      mapId: "dg-map",
      searchInputId: "dg-search",
      addressInputId: "address",
      latInputId: "latitude",
      lngInputId: "longitude",
    });
  }

  const servicesContainer = document.getElementById("services-list");
  const receiptList = document.getElementById("receipt-list");
  const totalEl = document.getElementById("total-price");
  const orderForm = document.getElementById("order-form");

  const roomsInput = document.getElementById("rooms");
  const bathsInput = document.getElementById("bathrooms");
  const propertySelect = document.getElementById("property_type");
  const cleaningTypeSelect = document.getElementById("cleaning_type");
  const citySelect = document.getElementById("city");

  // Pre-select city from user account if logged in
  async function loadUserCity() {
    const token = getTokenCalc();
    if (!token || !citySelect) return;

    try {
      const res = await fetch(`${CALC_API_BASE}/users/me`, {
        headers: authHeadersCalc(),
      });
      if (res.ok) {
        const user = await res.json();
        if (user.city && citySelect) {
          citySelect.value = user.city;
        }
      }
    } catch (err) {
      console.error("Failed to load user city:", err);
    }
  }

  const state = {
    basePrice: 0,
    services: {},
  };

  function updateBasePrice() {
    const rooms = parseInt(roomsInput.value || "0", 10);
    const baths = parseInt(bathsInput.value || "0", 10);
    const baseRate = cleaningTypeSelect.value === "deep" ? 6000 : 4000;
    state.basePrice = baseRate + rooms * 2000 + baths * 1500;
    renderReceipt();
  }

  function updateServiceQty(key, delta) {
    const current = state.services[key] || 0;
    const next = Math.max(0, current + delta);
    state.services[key] = next;
    const qtyEl = document.querySelector(`[data-qty="${key}"]`);
    if (qtyEl) {
      qtyEl.textContent = String(next);
    }
    renderReceipt();
  }

  function renderServices() {
    if (!servicesContainer) return;
    servicesContainer.innerHTML = "";
    SERVICES.forEach((s) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="feature-icon">
            <span>🧼</span>
          </div>
          <div>
            <div class="feature-title">${s.name}</div>
            <div class="text-sm text-muted">${s.price.toLocaleString()} ₸</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="chip">Price: <strong>${s.price.toLocaleString()} ₸</strong></div>
          <div class="flex items-center gap-2">
            <button class="btn btn-outline btn-pill" data-minus="${s.key}">−</button>
            <div data-qty="${s.key}" class="text-sm" style="min-width: 2rem; text-align: center;">0</div>
            <button class="btn btn-primary btn-pill" data-plus="${s.key}">+</button>
          </div>
        </div>
      `;
      servicesContainer.appendChild(card);
    });

    servicesContainer.addEventListener("click", (e) => {
      const minus = e.target.closest("[data-minus]");
      const plus = e.target.closest("[data-plus]");
      if (minus) {
        const key = minus.getAttribute("data-minus");
        updateServiceQty(key, -1);
      }
      if (plus) {
        const key = plus.getAttribute("data-plus");
        updateServiceQty(key, 1);
      }
    });
  }

  function renderReceipt() {
    if (!receiptList || !totalEl) return;
    receiptList.innerHTML = "";
    let total = 0;

    if (state.basePrice > 0) {
      const li = document.createElement("div");
      li.className = "flex justify-between text-sm mt-1";
      li.innerHTML = `<span>Base cleaning</span><span>${state.basePrice.toLocaleString()} ₸</span>`;
      receiptList.appendChild(li);
      total += state.basePrice;
    }

    SERVICES.forEach((s) => {
      const qty = state.services[s.key] || 0;
      if (!qty) return;
      const itemTotal = qty * s.price;
      total += itemTotal;
      const li = new DocumentFragment();
    });

    // Render again with actual DOM elements
    Object.entries(state.services).forEach(([key, qty]) => {
      const service = SERVICES.find((s) => s.key === key);
      if (!service || !qty) return;
      const itemTotal = qty * service.price;
      const row = document.createElement("div");
      row.className = "flex justify-between text-sm mt-1";
      row.innerHTML = `<span>${service.name} ×${qty}</span><span>${itemTotal.toLocaleString()} ₸</span>`;
      receiptList.appendChild(row);
    });

    totalEl.textContent = total.toLocaleString() + " ₸";
  }

  if (roomsInput) {
    roomsInput.addEventListener("input", updateBasePrice);
  }
  if (bathsInput) {
    bathsInput.addEventListener("input", updateBasePrice);
  }
  if (cleaningTypeSelect) {
    cleaningTypeSelect.addEventListener("change", updateBasePrice);
  }

  if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = getTokenCalc();
      if (!token) {
        if (window.notify) window.notify.info("Please log in to place an order.");
        window.location.href = "login.html";
        return;
      }

      const items = [];
      SERVICES.forEach((s) => {
        const qty = state.services[s.key] || 0;
        if (qty > 0) {
          items.push({
            service_name: s.name,
            quantity: qty,
            price: s.price,
          });
        }
      });

      if (!items.length) {
        if (window.notify) window.notify.error("Please select at least one additional option.");
        return;
      }

      const body = {
        property_type: propertySelect.value,
        rooms: parseInt(roomsInput.value || "0", 10),
        bathrooms: parseInt(bathsInput.value || "0", 10),
        cleaning_type: cleaningTypeSelect.value,
        address: orderForm.address.value.trim(),
        apartment: orderForm.apartment.value.trim() || null,
        city: orderForm.city.value.trim() || null,
        phone: orderForm.phone.value.trim() || null,
        latitude: orderForm.latitude ? parseFloat(orderForm.latitude.value || "") || null : null,
        longitude: orderForm.longitude ? parseFloat(orderForm.longitude.value || "") || null : null,
        items,
      };

      try {
        const res = await fetch(`${CALC_API_BASE}/orders`, {
          method: "POST",
          headers: authHeadersCalc(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (window.notify) window.notify.error("Could not place your order. Please try again.");
          return;
        }
        if (window.notify?.flash?.set) window.notify.flash.set("success", "Order submitted successfully.");
        window.location.href = "account.html";
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
      }
    });
  }

  renderServices();
  updateBasePrice();
  loadUserCity();
});


