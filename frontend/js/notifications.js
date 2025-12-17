// Unified toast notifications (success / error / info)
(function () {
  const DEFAULT_TIMEOUT = 3000;
  const FLASH_KEY = "tazabolsyn_flash";

  function ensureContainer() {
    let el = document.getElementById("toast-container");
    if (el) return el;
    el = document.createElement("div");
    el.id = "toast-container";
    el.className = "toast-container";
    document.body.appendChild(el);
    return el;
  }

  function show(type, message, opts = {}) {
    const container = ensureContainer();
    const timeout = typeof opts.timeout === "number" ? opts.timeout : DEFAULT_TIMEOUT;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const text = document.createElement("div");
    text.className = "toast__text";
    text.textContent = message || "Done.";

    const btn = document.createElement("button");
    btn.className = "toast__close";
    btn.type = "button";
    btn.setAttribute("aria-label", "Dismiss notification");
    btn.textContent = "×";

    function dismiss() {
      toast.classList.add("toast--hide");
      setTimeout(() => toast.remove(), 180);
    }

    btn.addEventListener("click", dismiss);
    toast.addEventListener("click", (e) => {
      // Allow click anywhere to dismiss except selecting text.
      if (e.target === btn) return;
      dismiss();
    });

    toast.appendChild(text);
    toast.appendChild(btn);
    container.appendChild(toast);

    if (timeout > 0) {
      setTimeout(dismiss, timeout);
    }
  }

  window.notify = {
    success: (msg, opts) => show("success", msg, opts),
    error: (msg, opts) => show("error", msg, opts),
    info: (msg, opts) => show("info", msg, opts),
    flash: {
      set(type, message) {
        try {
          localStorage.setItem(FLASH_KEY, JSON.stringify({ type, message, t: Date.now() }));
        } catch {
          // ignore
        }
      },
      consume() {
        try {
          const raw = localStorage.getItem(FLASH_KEY);
          if (!raw) return;
          localStorage.removeItem(FLASH_KEY);
          const data = JSON.parse(raw);
          if (!data?.type || !data?.message) return;
          show(data.type, data.message, { timeout: DEFAULT_TIMEOUT });
        } catch {
          // ignore
        }
      },
    },
  };
})();


