# TazaBolsyn

## Overview

TazaBolsyn is a full-stack web application for a home and office cleaning service. The platform connects customers with professional cleaners, enabling users to book cleaning services, track orders, and manage their accounts. Cleaners can view available orders, accept assignments, and update order statuses. Administrators have full oversight of users, cleaners, and all orders.

The product solves the following problem: Finding reliable cleaning services and managing bookings is often fragmented across multiple platforms or requires phone calls. TazaBolsyn provides a centralized, digital solution that streamlines the entire process from booking to completion, with transparent pricing, order tracking, and a rewards system.

The target user group includes:
- **Customers**: Homeowners and business owners seeking cleaning services
- **Cleaners**: Professional cleaning service providers
- **Administrators**: Platform managers who oversee operations

## Tech Stack

List of main technologies:

- **Front end**: HTML5, CSS3, Vanilla JavaScript
- **Back end**: FastAPI (Python 3.10+), SQLAlchemy ORM
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens), TOTP 2FA (RFC 6238)
- **Other tools**: 
  - Uvicorn (ASGI server)
  - Pydantic (data validation)
  - Passlib with bcrypt (password hashing)
  - PyOTP (TOTP generation and verification)
  - QRCode (2FA QR code generation)
  - Python-dotenv (environment variable management)

## Project Structure

Short explanation of main folders:

- `/backend` - Backend API application
  - `main.py` - FastAPI application entry point
  - `database.py` - Database configuration and session management
  - `models.py` - SQLAlchemy ORM models (Users, Orders, Addresses, etc.)
  - `schemas.py` - Pydantic schemas for request/response validation
  - `auth.py` - Authentication utilities (JWT, password hashing, TOTP)
  - `email_service.py` - Email service for password reset codes
  - `/routers` - API route handlers
    - `auth.py` - Authentication endpoints (signup, login, password reset, 2FA)
    - `users.py` - User profile and address management endpoints
    - `orders.py` - Order creation and listing endpoints
    - `cleaners.py` - Cleaner-specific endpoints (dashboard, order management)
    - `admin.py` - Admin endpoints (user management, order oversight)
  - `/utils` - Utility modules
    - `db_migrations.py` - Database migration utilities
    - `qr.py` - QR code generation utilities
    - `rate_limit.py` - Rate limiting middleware

- `/frontend` - Frontend application
  - `/css` - Stylesheets (main.css, auth.css, darkmode.css)
  - `/js` - JavaScript modules
    - `auth.js` - Authentication flows
    - `calculator.js` - Cleaning price calculator and order creation
    - `account.js` - User account management
    - `cleaner.js` - Cleaner dashboard functionality
    - `account_admin.js` - Admin dashboard functionality
    - `theme.js` - Dark/light mode theme management
    - `notifications.js` - Notification handling
    - `map_2gis.js` - Map integration
  - `*.html` - HTML pages (homepage, login, signup, account, calculator, cleaner, admin, etc.)

## How to Run the Project

### System Requirements

- Python 3.10 or higher (3.11+ recommended)
- SQLite (bundled with Python; no additional installation required)
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation Steps

1. Clone the repository or navigate to the project directory.

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt)**:
     ```cmd
     .\.venv\Scripts\activate.bat
     ```
   - **Linux/macOS**:
     ```bash
     source .venv/bin/activate
     ```

4. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. (Optional) Create a `.env` file in the project root with environment variables (see `.env.example` for reference):
   ```env
   SECRET_KEY=your-secret-key-here
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

### Start Command

1. **Start the backend API server** (from project root):
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The API will be available at `http://127.0.0.1:8000`
   - API documentation: `http://127.0.0.1:8000/docs`
   - Alternative docs: `http://127.0.0.1:8000/redoc`

2. **Start the frontend server** (in a separate terminal):
   ```bash
   cd frontend
   python -m http.server 5500
   ```
   The frontend will be available at `http://localhost:5500`
   - Homepage: `http://localhost:5500/homepage.html`
   - Login: `http://localhost:5500/login.html`
   - Signup: `http://localhost:5500/signup.html`
   - Calculator: `http://localhost:5500/calculation.html`
   - Account: `http://localhost:5500/account.html`
   - Cleaner Dashboard: `http://localhost:5500/cleaner.html`
   - Admin Panel: `http://localhost:5500/admin.html`

**Note**: The frontend JavaScript is preconfigured to call the API at `http://127.0.0.1:8000`. Ensure both servers are running for full functionality.

## How to Run Tests

Currently, the project does not include automated test suites. To test the application:

1. **Manual Testing**: Use the interactive API documentation at `http://127.0.0.1:8000/docs` to test endpoints directly.

2. **Frontend Testing**: Navigate through the frontend pages and verify functionality:
   - User registration and login
   - Order creation via calculator
   - Account management
   - Cleaner dashboard operations
   - Admin panel features

3. **Database Inspection**: The SQLite database file (`tazabolsyn.db`) is created in the project root. You can inspect it using SQLite tools or database browsers.

For production deployment, it is recommended to add automated test suites (unit tests, integration tests) using frameworks like `pytest` for the backend.

## Additional Documents

Links to product documents:

- [Product Requirements Document (PRD)](PRD.md)
- [User Stories](User_Stories.md)
- [System Architecture](Architecture.md)
- [API Specification](API.md)
