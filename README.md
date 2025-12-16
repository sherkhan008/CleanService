## TazaBolsyn – Cleaning Service Web Application

TazaBolsyn is a production-ready full‑stack web application for a home & office cleaning service.
It provides user signup & login (with optional 2FA), a rich cleaning price calculator, customer
accounts with rewards and order history, a cleaner dashboard, and an admin panel.

The stack is:

- **Backend**: FastAPI (Python), SQLite via SQLAlchemy
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Auth**: JWT bearer tokens + optional TOTP 2FA (RFC 6238)

SQLite is used as the only database engine for simplicity. No PostgreSQL configuration is required.

---

### Project structure

```text
backend/
  main.py           # FastAPI app entrypoint
  database.py       # SQLAlchemy + SQLite configuration
  models.py         # ORM models (Users, Orders, etc.)
  schemas.py        # Pydantic schemas
  auth.py           # JWT, password hashing, TOTP helpers
  routers/
    auth.py         # /auth/* (signup, login, reset, TOTP setup)
    users.py        # /users/* (profile, addresses, order history)
    orders.py       # /orders/* (create + list my orders)
    cleaners.py     # /cleaner/* (cleaner dashboard)
    admin.py        # /admin/* (admin dashboard)

frontend/
  css/
    main.css        # Global styling, layout
    auth.css        # Auth pages styling
    darkmode.css    # Light/dark mode toggle styles
  js/
    auth.js         # Login, signup, forgot/reset flows
    calculator.js   # Cleaning calculator + order creation
    account.js      # User account / profile / addresses / 2FA / orders
    cleaner.js      # Cleaner dashboard
    account_admin.js# Admin dashboard
    theme.js        # Light/dark mode persistence
  *.html            # login, signup, forgot, reset, homepage, account,
                    # calculation, cleaner, admin
```

---

### Requirements

- Python 3.10+ (3.11+ recommended)
- SQLite (bundled with Python; no extra setup required)

Install Python dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\activate  # on Windows
pip install -r requirements.txt
```

---

### Running the backend (API)

From the project root (`TazaBolsyn/`):

```bash
.\.venv\Scripts\activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

This will:

- Create a local `tazabolsyn.db` SQLite file in the project root
- Expose the API at `http://127.0.0.1:8000`
- Serve OpenAPI docs at `http://127.0.0.1:8000/docs`

---

### Running the frontend

You can open the HTML files directly in a browser, or serve them via a simple static server.
From the `frontend/` directory:

```bash
cd frontend
python -m http.server 5500
```

Then open:

- `http://localhost:5500/homepage.html` – marketing homepage
- `http://localhost:5500/login.html` – login
- `http://localhost:5500/signup.html` – signup
- `http://localhost:5500/calculation.html` – cleaning calculator
- `http://localhost:5500/account.html` – customer account
- `http://localhost:5500/cleaner.html` – cleaner dashboard
- `http://localhost:5500/admin.html` – admin panel

The frontend JavaScript is preconfigured to call the API at `http://127.0.0.1:8000`.

---

### Authentication & security

- Passwords are hashed using **bcrypt** via `passlib`.
- JWT access tokens are issued on signup/login and must be sent as:

  ```http
  Authorization: Bearer <token>
  ```

- Optional **TOTP 2FA** (Google Authenticator compatible) can be enabled from the account page:
  - Backend generates a TOTP secret and `otpauth://` URI.
  - Frontend displays a QR code using an external QR API.
  - For users with 2FA enabled, login requires a valid 6‑digit TOTP code.

- Role‑based access control:
  - `user`: normal customer (account, calculator, create orders).
  - `cleaner`: access to `/cleaner/*` to view and update their assigned orders.
  - `admin`: access to `/admin/*` to manage users, cleaners, and all orders.

---

### Database schema (SQLite)

Core tables:

- **Users** – basic profile, role, rewards, TOTP secret, reset codes.
- **Addresses** – saved addresses per user.
- **Orders** – order metadata, status, totals, property info, contact phone.
- **OrderItems** – line items for extra services (e.g. window cleaning).
- **Cleaners** – one‑to‑one relation with `Users` for cleaner-specific info.

All tables are created automatically on startup by `backend/main.py` using `Base.metadata.create_all`.

---

### Environment variables

SQLite is hard‑coded as the database; you do not need to set `DATABASE_URL`.

**Optional (for JWT):**

- `SECRET_KEY`: override the default JWT signing key (recommended for production).
- `ACCESS_TOKEN_EXPIRE_MINUTES`: override token lifetime (default: 1440 minutes).

**SMTP Configuration (for password reset emails):**

To enable email sending for password reset codes, set these environment variables:

- `SMTP_HOST`: SMTP server hostname (e.g., `smtp.gmail.com`)
- `SMTP_PORT`: SMTP server port (e.g., `587` for TLS)
- `SMTP_USER`: Your SMTP username/email
- `SMTP_PASSWORD`: Your SMTP password or app-specific password
- `SMTP_FROM`: Sender email address (usually same as `SMTP_USER`)

If SMTP is not configured, password reset codes will be logged to the console instead of being emailed.

**Example (PowerShell):**

```powershell
# JWT configuration
$env:SECRET_KEY = "your-very-strong-secret"
$env:ACCESS_TOKEN_EXPIRE_MINUTES = "1440"

# SMTP configuration (for password reset emails)
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your-email@gmail.com"
$env:SMTP_PASSWORD = "your-app-password"
$env:SMTP_FROM = "your-email@gmail.com"

# Activate virtual environment and run server
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Note for Gmail users:** You'll need to generate an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular Gmail password. Enable 2-Step Verification first, then create an app-specific password for this application.

---

### License

This project is licensed under the MIT License. See `LICENSE` for details.


