// Cleaner authentication flows: login, signup, forgot password, reset password

const API_BASE = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";
const USER_KEY = "tazabolsyn_user";
const CLEANER_RESET_EMAIL_KEY = "tazabolsyn_cleaner_reset_email";

function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function showMessage(containerId, message, isError = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = message;
  el.className = `auth-message ${isError ? "auth-message--error" : "auth-message--success"}`;
  el.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (window.notify?.flash?.consume) window.notify.flash.consume();

  // CLEANER LOGIN
  const loginForm = document.getElementById("cleaner-login-form");
  if (loginForm && page === "cleaner-login") {
    const totpGroup = document.getElementById("cleaner-login-totp-group");
    const msgId = "cleaner-login-message";

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      const totpCode = loginForm.totp?.value?.trim() || null;

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      try {
        const res = await fetch(`${API_BASE}/cleaner/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, totp_code: totpCode }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.detail === "TOTP_REQUIRED") {
            if (totpGroup) {
              totpGroup.classList.remove("hidden");
              loginForm.totp.focus();
            }
            if (window.notify) window.notify.info("Enter your 6-digit authentication code.");
            showMessage(msgId, "Please enter your 6-digit authentication code.", false);
            return;
          }
          const friendly =
            data?.detail === "NOT_A_CLEANER"
              ? "This account is not registered as a cleaner."
              : data?.detail === "INVALID_TOTP"
                ? "That authentication code is not correct. Please try again."
                : data?.detail === "Invalid email or password"
                  ? "Incorrect email or password. Please try again."
                  : "Login failed. Please try again.";
          if (window.notify) window.notify.error(friendly);
          showMessage(msgId, friendly, true);
          return;
        }

        saveAuth(data.access_token, data.user);
        if (window.notify?.flash?.set) window.notify.flash.set("success", "Cleaner login successful.");
        window.location.href = "cleaner.html";
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // CLEANER SIGNUP
  const signupForm = document.getElementById("cleaner-signup-form");
  if (signupForm && page === "cleaner-signup") {
    const msgId = "cleaner-signup-message";
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        name: signupForm.name.value.trim(),
        surname: signupForm.surname.value.trim(),
        email: signupForm.email.value.trim(),
        phone: signupForm.phone.value.trim(),
        password: signupForm.password.value,
        password_confirm: signupForm.password_confirm.value,
        city: signupForm.city.value.trim() || null,
      };

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      if (!body.phone) {
        if (window.notify) window.notify.error("Phone number is required.");
        showMessage(msgId, "Phone number is required.", true);
        return;
      }
      if (body.password !== body.password_confirm) {
        if (window.notify) window.notify.error("Passwords do not match.");
        showMessage(msgId, "Passwords do not match.", true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/cleaner/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly = data?.detail || "Cleaner signup failed. Please try again.";
          if (window.notify) window.notify.error(friendly);
          showMessage(msgId, friendly, true);
          return;
        }
        saveAuth(data.access_token, data.user);
        if (window.notify?.flash?.set) window.notify.flash.set("success", "Cleaner account created successfully.");
        window.location.href = "cleaner.html";
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // CLEANER FORGOT PASSWORD (uses the same backend endpoint as customers)
  const forgotForm = document.getElementById("cleaner-forgot-form");
  if (forgotForm && page === "cleaner-forgot") {
    const msgId = "cleaner-forgot-message";
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = forgotForm.email.value.trim();

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      try {
        const res = await fetch(`${API_BASE}/auth/request-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        const friendly = data?.message || "If an account exists for that email, a reset code has been sent.";
        if (window.notify) window.notify.success("Reset email sent. Check your inbox.");
        showMessage(msgId, friendly);
        localStorage.setItem(CLEANER_RESET_EMAIL_KEY, email);
        setTimeout(() => {
          window.location.href = "cleaner_reset.html";
        }, 1200);
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // CLEANER RESET PASSWORD (uses the same backend endpoint as customers)
  const resetForm = document.getElementById("cleaner-reset-form");
  if (resetForm && page === "cleaner-reset") {
    const msgId = "cleaner-reset-message";
    const emailInput = resetForm.email;
    const storedEmail = localStorage.getItem(CLEANER_RESET_EMAIL_KEY);
    if (storedEmail && emailInput && !emailInput.value) {
      emailInput.value = storedEmail;
    }

    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        email: resetForm.email.value.trim(),
        code: resetForm.code.value.trim(),
        new_password: resetForm.new_password.value,
      };

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      if (!body.code || body.code.length !== 6) {
        if (window.notify) window.notify.error("Please enter the 6-digit code.");
        showMessage(msgId, "Please enter the 6-digit code.", true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          const friendly =
            data?.detail === "Invalid reset code"
              ? "That code is not correct. Please try again."
              : data?.detail === "Reset code has expired"
                ? "That code has expired. Please request a new one."
                : data?.detail || "Password reset failed. Please try again.";
          if (window.notify) window.notify.error(friendly);
          showMessage(msgId, friendly, true);
          return;
        }
        if (window.notify) window.notify.success("Password updated successfully.");
        showMessage(msgId, data?.message || "Password updated.", false);
        localStorage.removeItem(CLEANER_RESET_EMAIL_KEY);
        setTimeout(() => {
          if (window.notify?.flash?.set) {
            window.notify.flash.set("success", "You can now log in with your new password.");
          }
          window.location.href = "cleaner_login.html";
        }, 1500);
      } catch (err) {
        console.error(err);
        if (window.notify) window.notify.error("Network error. Please try again.");
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }
});


