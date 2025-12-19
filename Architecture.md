# System Architecture

## 1. Architecture Style

**Chosen architecture style**: Client-Server (Three-Tier Architecture)

**Reason for this choice**: 
The client-server architecture with clear separation between frontend (presentation layer), backend (business logic layer), and database (data layer) provides:
- Clear separation of concerns
- Independent scalability of components
- Ease of development and maintenance
- RESTful API design enables future mobile app integration
- Stateless backend allows horizontal scaling if needed

The backend follows a monolithic application pattern with modular routers, which is appropriate for an MVP as it simplifies deployment and development while maintaining code organization.

## 2. System Components

Short description of each component:

- **Front end**: 
  - Static HTML/CSS/JavaScript application
  - Serves as the user interface for customers, cleaners, and administrators
  - Communicates with backend via REST API using fetch/XMLHttpRequest
  - Handles client-side validation, form submission, and UI state management
  - Implements theme management (dark/light mode) with local storage persistence

- **Back end**: 
  - FastAPI application providing RESTful API endpoints
  - Handles business logic, authentication, authorization, and data validation
  - Uses SQLAlchemy ORM for database interactions
  - Implements JWT-based authentication with optional TOTP 2FA
  - Provides rate limiting, CORS middleware, and error handling
  - Modular router structure for different feature areas (auth, users, orders, cleaners, admin)

- **Database**: 
  - SQLite relational database
  - Stores user accounts, orders, addresses, and cleaner profiles
  - Managed through SQLAlchemy ORM models
  - Automatic schema creation on application startup
  - Supports relationships (one-to-many, one-to-one) between entities

- **External services**: 
  - SMTP server (optional): For sending password reset emails
  - QR code generation: For TOTP 2FA setup (handled internally via qrcode library)
  - 2GIS Maps API (frontend): For map integration and geolocation (optional)

## 3. Component Diagram

Short description of how components interact:

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTP/REST API
       │ (JSON, JWT tokens)
       ▼
┌─────────────────────────────────┐
│      FastAPI Backend            │
│  ┌───────────────────────────┐  │
│  │   Authentication Layer    │  │
│  │  (JWT, TOTP, Rate Limit)  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Router Layer            │  │
│  │  (auth, users, orders,    │  │
│  │   cleaners, admin)        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Business Logic Layer    │  │
│  │  (validation, processing) │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Data Access Layer       │  │
│  │  (SQLAlchemy ORM)         │  │
│  └───────────────────────────┘  │
└──────────────┬──────────────────┘
               │ SQL queries
               ▼
┌──────────────────────────────┐
│      SQLite Database         │
│  (tazabolsyn.db)             │
└──────────────────────────────┘
```

**Interaction Flow**:
1. Frontend sends HTTP requests to backend API endpoints
2. Backend middleware handles CORS, authentication, and rate limiting
3. Routers process requests and apply business logic
4. SQLAlchemy ORM translates operations to SQL queries
5. Database executes queries and returns data
6. Backend formats responses as JSON
7. Frontend receives responses and updates UI accordingly

## 4. Data Flow

Explanation of data movement from user actions to system responses:

### Customer Order Creation Flow:
1. **User Action**: Customer fills out calculator form and submits order
2. **Frontend**: JavaScript collects form data, retrieves JWT token from localStorage
3. **API Request**: POST request to `/orders/` with order data and Authorization header
4. **Backend Authentication**: JWT token validated, user identity extracted
5. **Authorization**: User role verified (must be "user")
6. **Validation**: Pydantic schema validates request data
7. **Business Logic**: 
   - Calculate total price from order items
   - Create Order record in database
   - Create OrderItem records for each service
   - Update user reward points (1 point per 1000₸)
8. **Database**: SQLAlchemy commits transaction
9. **Response**: JSON response with created order details
10. **Frontend**: Updates UI to show order confirmation and redirects to account page

### Cleaner Order Acceptance Flow:
1. **User Action**: Cleaner views available orders and clicks "Accept"
2. **Frontend**: JavaScript sends POST request to `/cleaner/orders/{order_id}/take`
3. **Backend Authentication**: JWT token validated, user role verified as "cleaner"
4. **Business Logic**:
   - Check if cleaner has active orders (status: accepted, going, or started)
   - Verify order is available (status: pending, cleaner_id: null)
   - Assign cleaner to order (set cleaner_id, status: accepted)
   - Update cleaner availability to false
5. **Database**: Transaction commits changes
6. **Response**: JSON response with updated order
7. **Frontend**: Updates UI to show order in "My Orders" section

### Authentication Flow:
1. **User Action**: User submits login form with email and password
2. **Frontend**: POST request to `/auth/login` with credentials
3. **Backend**: 
   - Query database for user by email
   - Verify password hash using bcrypt
   - If 2FA enabled, verify TOTP code
   - Generate JWT token with user ID and role
4. **Response**: JSON with access_token and user data
5. **Frontend**: Store token in localStorage, redirect to appropriate dashboard

## 5. Database Schema

Description of main entities and relations:

### Core Tables:

**Users**:
- Primary key: `id` (Integer)
- Fields: `name`, `surname`, `email` (unique), `phone`, `password_hash`, `role` (user/cleaner/admin), `totp_secret`, `is_totp_enabled`, `city`, `reward_points`, `reset_code`, `reset_expires_at`
- Relationships: One-to-many with Addresses, One-to-many with Orders (as customer), One-to-one with Cleaner profile

**Addresses**:
- Primary key: `id` (Integer)
- Foreign key: `user_id` → Users.id
- Fields: `address`, `apartment`, `latitude`, `longitude`
- Relationship: Many-to-one with User

**Orders**:
- Primary key: `id` (Integer)
- Foreign keys: `user_id` → Users.id (customer), `cleaner_id` → Users.id (cleaner, nullable)
- Fields: `status` (pending/accepted/going/started/finished/paid), `total_price`, `created_at`, `property_type`, `rooms`, `bathrooms`, `cleaning_type`, `address`, `apartment`, `city`, `phone`, `latitude`, `longitude`
- Relationships: Many-to-one with User (customer), Many-to-one with User (cleaner), One-to-many with OrderItems

**OrderItems**:
- Primary key: `id` (Integer)
- Foreign key: `order_id` → Orders.id
- Fields: `service_name`, `quantity`, `price` (per unit)
- Relationship: Many-to-one with Order

**Cleaners**:
- Primary key: `id` (Integer)
- Foreign key: `user_id` → Users.id (unique, one-to-one)
- Fields: `availability` (boolean)
- Relationship: One-to-one with User

### Entity Relationship Diagram (Text Representation):
```
Users (1) ────< (N) Addresses
Users (1) ────< (N) Orders (as customer)
Users (1) ────< (N) Orders (as cleaner)
Users (1) ──── (1) Cleaners
Orders (1) ────< (N) OrderItems
```

## 6. Technology Decisions

Chosen technologies with short justification:

- **FastAPI**: 
  - Modern, high-performance Python web framework
  - Automatic API documentation (OpenAPI/Swagger)
  - Built-in data validation with Pydantic
  - Async support for future scalability
  - Type hints for better code quality

- **SQLite**: 
  - Zero-configuration database, perfect for MVP
  - File-based, easy to backup and deploy
  - Sufficient for small to medium user base
  - Can migrate to PostgreSQL later if needed
  - SQLAlchemy abstraction allows easy database switching

- **SQLAlchemy ORM**: 
  - Provides database abstraction layer
  - Type-safe queries with Python objects
  - Relationship management simplifies data access
  - Migration support via Alembic (for future use)

- **JWT Authentication**: 
  - Stateless authentication, scalable
  - No server-side session storage required
  - Token contains user identity and role
  - Standard format, widely supported

- **Pydantic**: 
  - Automatic data validation and serialization
  - Type safety with Python type hints
  - Clear error messages for invalid input
  - Reduces boilerplate code

- **bcrypt (via Passlib)**: 
  - Industry-standard password hashing
  - Resistant to brute force attacks
  - Automatic salt generation
  - Configurable cost factor

- **PyOTP**: 
  - RFC 6238 compliant TOTP implementation
  - Compatible with Google Authenticator and similar apps
  - Secure secret generation
  - Time-window validation for clock drift tolerance

- **Vanilla JavaScript (Frontend)**: 
  - No build step required, simple deployment
  - Direct browser compatibility
  - Easy to understand and maintain for MVP
  - Can migrate to framework (React, Vue) later if needed

## 7. Future Extensions

Possible future improvements:

- **Database Migration**: 
  - Migrate from SQLite to PostgreSQL for production scalability
  - Implement Alembic for database version control and migrations

- **Caching Layer**: 
  - Add Redis for session management and caching
  - Cache frequently accessed data (user profiles, order lists)

- **Message Queue**: 
  - Integrate RabbitMQ or Celery for asynchronous tasks
  - Background job processing (email sending, notifications)

- **API Versioning**: 
  - Implement API versioning strategy (e.g., `/api/v1/`, `/api/v2/`)
  - Maintain backward compatibility

- **Microservices Architecture**: 
  - Split into separate services (auth service, order service, notification service)
  - Enable independent scaling and deployment

- **Real-time Features**: 
  - WebSocket support for real-time order updates
  - Push notifications for order status changes

- **Frontend Framework**: 
  - Migrate to React, Vue, or Angular for better state management
  - Implement component-based architecture

- **Containerization**: 
  - Dockerize application for consistent deployment
  - Docker Compose for local development environment

- **CI/CD Pipeline**: 
  - Automated testing and deployment
  - Code quality checks and security scanning

- **Monitoring and Logging**: 
  - Integrate logging service (e.g., ELK stack)
  - Application performance monitoring (APM)
  - Error tracking (e.g., Sentry)

- **Payment Integration**: 
  - Integrate payment gateway (Stripe, PayPal)
  - Handle payment processing and refunds

- **Advanced Features**: 
  - Machine learning for price optimization
  - Route optimization for cleaners
  - Customer review and rating system
  - Automated scheduling and reminders

