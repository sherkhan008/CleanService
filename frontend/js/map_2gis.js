// 2GIS MapGL Address Picker (lazy-loaded)
(function () {
  const API_KEY = "f0a8af0d-6631-4a2f-8ca6-7665de558985";
  const MAPGL_SRC = "https://mapgl.2gis.com/api/js/v1";
  const GEOCODE_BASE = "https://catalog.api.2gis.com/3.0/items/geocode";

  let mapglLoading = null;

  function loadMapgl() {
    if (window.mapgl) return Promise.resolve();
    if (mapglLoading) return mapglLoading;
    mapglLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = MAPGL_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load 2GIS MapGL"));
      document.head.appendChild(s);
    });
    return mapglLoading;
  }

  function parsePoint(item) {
    const p = item?.point || item?.geometry?.centroid || item?.geometry?.center;
    if (!p) return null;
    // Common shapes:
    // - { lat, lon }
    // - { latitude, longitude }
    // - { x, y } (lon/lat)
    // - [lon, lat]
    if (Array.isArray(p) && p.length >= 2) return { lng: Number(p[0]), lat: Number(p[1]) };
    if (typeof p === "object") {
      const lng = p.lon ?? p.lng ?? p.longitude ?? p.x;
      const lat = p.lat ?? p.latitude ?? p.y;
      if (lng == null || lat == null) return null;
      return { lng: Number(lng), lat: Number(lat) };
    }
    return null;
  }

  async function geocode(query) {
    const url =
      `${GEOCODE_BASE}?q=${encodeURIComponent(query)}` +
      `&fields=items.point,items.full_name,items.address_name,items.name` +
      `&key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocode failed");
    return await res.json();
  }

  async function reverseGeocode(lng, lat) {
    const url =
      `${GEOCODE_BASE}?point=${encodeURIComponent(`${lng},${lat}`)}` +
      `&fields=items.point,items.full_name,items.address_name,items.name` +
      `&key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Reverse geocode failed");
    return await res.json();
  }

  function pickAddressFromResult(json) {
    const items = json?.result?.items || json?.items || [];
    if (!items.length) return null;
    const i = items[0];
    const label = i.full_name || i.address_name || i.name || null;
    const pt = parsePoint(i);
    return { label, point: pt };
  }

  function createDropdown(anchorEl) {
    const box = document.createElement("div");
    box.className = "dg-suggest";
    box.style.position = "absolute";
    box.style.zIndex = 20;
    box.style.left = "0";
    box.style.right = "0";
    box.style.top = "calc(100% + 6px)";
    box.style.background = "var(--color-card)";
    box.style.border = "1px solid var(--color-border)";
    box.style.borderRadius = "12px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.12)";
    box.style.overflow = "hidden";
    box.style.maxHeight = "260px";
    box.style.overflowY = "auto";
    box.hidden = true;

    anchorEl.style.position = "relative";
    anchorEl.appendChild(box);
    return box;
  }

  function debounce(fn, delay) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  async function initAddressPicker(opts) {
    const root = document.getElementById(opts.rootId);
    if (!root) return;

    const mapEl = document.getElementById(opts.mapId);
    const searchInput = document.getElementById(opts.searchInputId);
    const addressInput = document.getElementById(opts.addressInputId);
    const latInput = document.getElementById(opts.latInputId);
    const lngInput = document.getElementById(opts.lngInputId);

    if (!mapEl || !searchInput || !addressInput) return;

    // Lazy init only once when visible
    let inited = false;
    const io = new IntersectionObserver(
      async (entries) => {
        if (inited) return;
        if (!entries.some((e) => e.isIntersecting)) return;
        inited = true;
        io.disconnect();

        try {
          await loadMapgl();
        } catch (e) {
          console.error(e);
          if (window.notify) window.notify.error("Could not load the map. Please try again later.");
          return;
        }

        const start = opts.defaultCenter || { lng: 76.915, lat: 43.238 };
        const map = new window.mapgl.Map(mapEl.id, {
          key: API_KEY,
          center: [start.lng, start.lat],
          zoom: opts.defaultZoom || 13,
        });

        let marker = null;
        function setMarker(lng, lat) {
          if (!marker) {
            marker = new window.mapgl.Marker(map, { coordinates: [lng, lat] });
            return;
          }
          if (typeof marker.setCoordinates === "function") {
            marker.setCoordinates([lng, lat]);
          } else {
            // fallback: recreate
            marker.destroy?.();
            marker = new window.mapgl.Marker(map, { coordinates: [lng, lat] });
          }
        }

        async function setFromClick(lng, lat) {
          setMarker(lng, lat);
          if (latInput) latInput.value = String(lat);
          if (lngInput) lngInput.value = String(lng);
          try {
            const json = await reverseGeocode(lng, lat);
            const picked = pickAddressFromResult(json);
            if (picked?.label) addressInput.value = picked.label;
          } catch (e) {
            console.warn(e);
          }
        }

        map.on("click", async (ev) => {
          const ll = ev?.lngLat || ev?.lnglat || ev?.coordinates || ev?.location || null;
          let lng = null;
          let lat = null;
          if (Array.isArray(ll) && ll.length >= 2) {
            lng = Number(ll[0]);
            lat = Number(ll[1]);
          } else if (ll && typeof ll === "object") {
            lng = Number(ll.lng ?? ll.lon ?? ll.longitude);
            lat = Number(ll.lat ?? ll.latitude);
          }
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            setFromClick(lng, lat);
          }
        });

        // Suggestions dropdown
        const wrapper = searchInput.parentElement || root;
        const dropdown = createDropdown(wrapper);

        function hideDropdown() {
          dropdown.hidden = true;
          dropdown.innerHTML = "";
        }

        async function runSuggest(q) {
          if (!q || q.length < 3) {
            hideDropdown();
            return;
          }
          try {
            const json = await geocode(q);
            const items = json?.result?.items || json?.items || [];
            dropdown.innerHTML = "";
            if (!items.length) {
              hideDropdown();
              return;
            }
            items.slice(0, 6).forEach((it) => {
              const label = it.full_name || it.address_name || it.name || "Address";
              const pt = parsePoint(it);
              const row = document.createElement("button");
              row.type = "button";
              row.className = "dg-suggest__item";
              row.textContent = label;
              row.style.width = "100%";
              row.style.textAlign = "left";
              row.style.padding = "10px 12px";
              row.style.border = "none";
              row.style.background = "transparent";
              row.style.cursor = "pointer";
              row.addEventListener("click", () => {
                addressInput.value = label;
                hideDropdown();
                if (pt) {
                  if (latInput) latInput.value = String(pt.lat);
                  if (lngInput) lngInput.value = String(pt.lng);
                  setMarker(pt.lng, pt.lat);
                  map.setCenter([pt.lng, pt.lat]);
                  map.setZoom(16);
                }
              });
              dropdown.appendChild(row);
            });
            dropdown.hidden = false;
          } catch (e) {
            console.warn(e);
            hideDropdown();
          }
        }

        const debounced = debounce(runSuggest, 350);
        searchInput.addEventListener("input", () => debounced(searchInput.value.trim()));
        document.addEventListener("click", (e) => {
          if (!wrapper.contains(e.target)) hideDropdown();
        });
      },
      { threshold: 0.15 }
    );

    io.observe(root);
  }

  window.Map2GIS = { initAddressPicker };
})();


