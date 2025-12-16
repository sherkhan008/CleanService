// Authentication flows: login, signup, forgot password, reset password

const API_BASE = "http://127.0.0.1:8000";
const TOKEN_KEY = "tazabolsyn_token";
const USER_KEY = "tazabolsyn_user";
const RESET_EMAIL_KEY = "tazabolsyn_reset_email";

function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

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

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function navigateAfterLogin(user) {
  if (user.role === "admin") {
    window.location.href = "admin.html";
  } else if (user.role === "cleaner") {
    window.location.href = "cleaner.html";
  } else {
    window.location.href = "account.html";
  }
}

function showMessage(containerId, message, isError = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = message;
  el.className = `auth-message ${isError ? "auth-message--error" : "auth-message--success"}`;
  el.classList.remove("hidden");
}

/**
 * Check password strength and return: 'weak', 'medium', or 'strong'
 */
function checkPasswordStrength(password) {
  if (!password || password.length < 8) {
    return { strength: "weak", score: 0 };
  }

  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1; // lowercase
  if (/[A-Z]/.test(password)) score += 1; // uppercase
  if (/[0-9]/.test(password)) score += 1; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 1; // special chars
  
  // Common patterns (penalize)
  const commonPatterns = [
    /12345|123456|1234567|12345678/,
    /password|qwerty|abc123|admin/,
    /(.)\1{3,}/, // repeated characters
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password.toLowerCase()))) {
    score = Math.max(0, score - 2);
  }

  if (score <= 2) {
    return { strength: "weak", score };
  } else if (score <= 4) {
    return { strength: "medium", score };
  } else {
    return { strength: "strong", score };
  }
}

/**
 * Update password strength indicator UI
 */
function updatePasswordStrength(passwordInputId, strengthContainerId) {
  const passwordInput = document.getElementById(passwordInputId);
  const strengthContainer = document.getElementById(strengthContainerId);
  const strengthFill = document.getElementById(`${strengthContainerId}-fill`);
  const strengthText = document.getElementById(`${strengthContainerId}-text`);

  if (!passwordInput || !strengthContainer || !strengthFill || !strengthText) {
    return;
  }

  const password = passwordInput.value;
  
  if (!password || password.length === 0) {
    strengthContainer.classList.add("hidden");
    return;
  }

  strengthContainer.classList.remove("hidden");
  const { strength } = checkPasswordStrength(password);

  // Update fill bar
  strengthFill.className = `password-strength-fill ${strength}`;
  
  // Update text
  strengthText.className = `password-strength-text ${strength}`;
  const labels = {
    weak: "Weak password",
    medium: "Medium strength",
    strong: "Strong password",
  };
  strengthText.textContent = labels[strength];
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  // LOGIN
  const loginForm = document.getElementById("login-form");
  if (loginForm && page === "login") {
    const totpGroup = document.getElementById("login-totp-group");
    const msgId = "login-message";

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      const totpCode = loginForm.totp?.value?.trim() || null;

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, totp_code: totpCode }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data?.detail === "TOTP_REQUIRED") {
            if (totpGroup) {
              totpGroup.classList.remove("hidden");
              loginForm.totp.focus();
            }
            showMessage(msgId, "Please enter your 6-digit authentication code.", false);
            return;
          }
          showMessage(msgId, data?.detail || "Login failed. Please try again.", true);
          return;
        }

        saveAuth(data.access_token, data.user);
        navigateAfterLogin(data.user);
      } catch (err) {
        console.error(err);
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // SIGNUP
  const signupForm = document.getElementById("signup-form");
  if (signupForm && page === "signup") {
    const msgId = "signup-message";
    const passwordInput = document.getElementById("password");
    
    // Add password strength indicator
    if (passwordInput) {
      passwordInput.addEventListener("input", () => {
        updatePasswordStrength("password", "password-strength");
      });
    }
    
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        name: signupForm.name.value.trim(),
        surname: signupForm.surname.value.trim(),
        email: signupForm.email.value.trim(),
        password: signupForm.password.value,
        password_confirm: signupForm.password_confirm.value,
        city: signupForm.city.value.trim() || null,
      };

      showMessage(msgId, "", false);
      document.getElementById(msgId).classList.add("hidden");

      if (body.password !== body.password_confirm) {
        showMessage(msgId, "Passwords do not match.", true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showMessage(msgId, data?.detail || "Signup failed.", true);
          return;
        }
        saveAuth(data.access_token, data.user);
        navigateAfterLogin(data.user);
      } catch (err) {
        console.error(err);
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // FORGOT PASSWORD
  const forgotForm = document.getElementById("forgot-form");
  if (forgotForm && page === "forgot") {
    const msgId = "forgot-message";
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
        showMessage(msgId, data?.message || "If the email exists, a code was sent.");
        localStorage.setItem(RESET_EMAIL_KEY, email);
        setTimeout(() => {
          window.location.href = "reset.html";
        }, 1200);
      } catch (err) {
        console.error(err);
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }

  // RESET PASSWORD
  const resetForm = document.getElementById("reset-form");
  if (resetForm && page === "reset") {
    const msgId = "reset-message";
    const emailInput = resetForm.email;
    const storedEmail = localStorage.getItem(RESET_EMAIL_KEY);
    if (storedEmail && emailInput && !emailInput.value) {
      emailInput.value = storedEmail;
    }

    // Add password strength indicator
    const newPasswordInput = document.getElementById("new_password");
    if (newPasswordInput) {
      newPasswordInput.addEventListener("input", () => {
        updatePasswordStrength("new_password", "password-strength");
      });
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
        showMessage(msgId, "Please enter the 6-digit code.", true);
        return;
      }

      if (!body.new_password || body.new_password.length < 8) {
        showMessage(msgId, "Password must be at least 8 characters.", true);
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
          showMessage(msgId, data?.detail || "Reset failed.", true);
          return;
        }
        showMessage(msgId, data?.message || "Password updated.", false);
        localStorage.removeItem(RESET_EMAIL_KEY);
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } catch (err) {
        console.error(err);
        showMessage(msgId, "Network error. Please try again.", true);
      }
    });
  }
});


