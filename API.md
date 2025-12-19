# API Specification

## Base URL

`http://localhost:8000` (development)
`http://127.0.0.1:8000` (alternative)

## Authentication

Most endpoints require authentication using JWT Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_access_token>
```

Tokens are obtained through `/auth/signup` or `/auth/login` endpoints. Tokens expire after 1440 minutes (24 hours) by default, configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` environment variable.

---

## Health Check

### Endpoint: `/`

**Method**: GET  
**Purpose**: Check if the API is running  
**Authentication**: Not required

**Response**:
```json
{
  "message": "TazaBolsyn API is running"
}
```

---

## Authentication Endpoints

### Endpoint: `/auth/signup`

**Method**: POST  
**Purpose**: Register a new user account  
**Authentication**: Not required

**Request Body**:
```json
{
  "name": "John",
  "surname": "Doe",
  "email": "john.doe@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123",
  "phone": "+77001234567",
  "city": "Almaty"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "John",
    "surname": "Doe",
    "email": "john.doe@example.com",
    "phone": "+77001234567",
    "role": "user",
    "city": "Almaty",
    "reward_points": 0,
    "totp_enabled": false,
    "totp_setup_pending": false,
    "addresses": []
  }
}
```

**Error Codes**:
- 400: Passwords do not match, or email is already registered
- 422: Validation error (invalid email format, password too short, etc.)

---

### Endpoint: `/auth/login`

**Method**: POST  
**Purpose**: Authenticate user and receive access token  
**Authentication**: Not required  
**Rate Limit**: 8 requests per 60 seconds per IP

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "password": "securepassword123",
  "totp_code": "123456"
}
```

**Note**: `totp_code` is optional. Required only if user has 2FA enabled.

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "John",
    "surname": "Doe",
    "email": "john.doe@example.com",
    "phone": "+77001234567",
    "role": "user",
    "city": "Almaty",
    "reward_points": 100,
    "totp_enabled": true,
    "totp_setup_pending": false,
    "addresses": []
  }
}
```

**Error Codes**:
- 401: Invalid email or password, or TOTP_REQUIRED (if 2FA enabled but code not provided), or INVALID_TOTP (if code is incorrect)
- 422: Validation error

---

### Endpoint: `/auth/request-reset`

**Method**: POST  
**Purpose**: Request a password reset code  
**Authentication**: Not required  
**Rate Limit**: 5 requests per 300 seconds per IP

**Request Body**:
```json
{
  "email": "john.doe@example.com"
}
```

**Response** (200 OK):
```json
{
  "message": "If an account with that email exists, a reset code has been sent."
}
```

**Note**: The response is generic to prevent email enumeration. The reset code is sent via email (if SMTP configured) or logged to console.

**Error Codes**:
- 422: Validation error (invalid email format)

---

### Endpoint: `/auth/reset`

**Method**: POST  
**Purpose**: Reset password using a 6-digit code  
**Authentication**: Not required  
**Rate Limit**: 8 requests per 300 seconds per IP

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "code": "123456",
  "new_password": "newsecurepassword123"
}
```

**Response** (200 OK):
```json
{
  "message": "Password updated successfully."
}
```

**Error Codes**:
- 400: Invalid reset request, invalid reset code, or reset code has expired
- 422: Validation error (code must be 6 digits, password too short)

---

### Endpoint: `/auth/totp/setup`

**Method**: POST  
**Purpose**: Start TOTP 2FA setup and receive QR code  
**Authentication**: Required (Bearer token)  
**Rate Limit**: 3 requests per 300 seconds per user

**Request Body**: None

**Response** (200 OK):
```json
{
  "qr_code_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "Scan the QR code in your authenticator app, then enter the 6-digit code to finish setup."
}
```

**Error Codes**:
- 400: TOTP_ALREADY_ENABLED (2FA is already active)
- 409: TOTP_SETUP_PENDING (setup initiated but not verified yet)
- 401: Unauthorized (missing or invalid token)

---

### Endpoint: `/auth/totp/verify`

**Method**: POST  
**Purpose**: Verify TOTP code and enable 2FA  
**Authentication**: Required (Bearer token)  
**Rate Limit**: 12 requests per 300 seconds per user

**Request Body**:
```json
{
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "totp_enabled": true,
  "message": "Two-factor authentication has been enabled successfully."
}
```

**Error Codes**:
- 400: TOTP_NOT_SETUP (setup not initiated), or INVALID_TOTP (code verification failed)
- 401: Unauthorized (missing or invalid token)
- 422: Validation error (code must be 6 digits)

---

## User Endpoints

### Endpoint: `/users/me`

**Method**: GET  
**Purpose**: Get current authenticated user profile  
**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "John",
  "surname": "Doe",
  "email": "john.doe@example.com",
  "phone": "+77001234567",
  "role": "user",
  "city": "Almaty",
  "reward_points": 100,
  "totp_enabled": true,
  "totp_setup_pending": false,
  "addresses": [
    {
      "id": 1,
      "address": "Abay Avenue 150",
      "apartment": "25",
      "latitude": 43.238949,
      "longitude": 76.889709
    }
  ]
}
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)

---

### Endpoint: `/users/me`

**Method**: PUT  
**Purpose**: Update current user profile  
**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "name": "John",
  "surname": "Smith",
  "phone": "+77009876543",
  "city": "Astana"
}
```

**Note**: All fields are optional. Only provided fields will be updated.

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "John",
  "surname": "Smith",
  "email": "john.doe@example.com",
  "phone": "+77009876543",
  "role": "user",
  "city": "Astana",
  "reward_points": 100,
  "totp_enabled": true,
  "totp_setup_pending": false,
  "addresses": []
}
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 422: Validation error

---

### Endpoint: `/users/me/addresses`

**Method**: GET  
**Purpose**: List all saved addresses for current user  
**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "address": "Abay Avenue 150",
    "apartment": "25",
    "latitude": 43.238949,
    "longitude": 76.889709
  },
  {
    "id": 2,
    "address": "Satpayev Street 30",
    "apartment": "10",
    "latitude": 43.250000,
    "longitude": 76.900000
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)

---

### Endpoint: `/users/me/addresses`

**Method**: POST  
**Purpose**: Add a new saved address  
**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "address": "Abay Avenue 150",
  "apartment": "25",
  "latitude": 43.238949,
  "longitude": 76.889709
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "address": "Abay Avenue 150",
  "apartment": "25",
  "latitude": 43.238949,
  "longitude": 76.889709
}
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 422: Validation error

---

### Endpoint: `/users/me/addresses/{address_id}`

**Method**: DELETE  
**Purpose**: Delete a saved address  
**Authentication**: Required (Bearer token)

**Parameters**:
- `address_id` (path, integer): ID of the address to delete

**Response** (204 No Content): Empty body

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 404: Address not found or does not belong to current user

---

### Endpoint: `/users/me/orders`

**Method**: GET  
**Purpose**: Get order history for current user  
**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "user_id": 1,
    "cleaner_id": 2,
    "status": "finished",
    "total_price": 15000.0,
    "created_at": "2024-01-15T10:30:00Z",
    "property_type": "Apartment",
    "rooms": 3,
    "bathrooms": 2,
    "cleaning_type": "Standard",
    "address": "Abay Avenue 150",
    "apartment": "25",
    "city": "Almaty",
    "phone": "+77001234567",
    "latitude": 43.238949,
    "longitude": 76.889709,
    "items": [
      {
        "id": 1,
        "service_name": "Window Cleaning",
        "quantity": 2,
        "price": 2000.0
      },
      {
        "id": 2,
        "service_name": "Deep Cleaning",
        "quantity": 1,
        "price": 11000.0
      }
    ]
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)

---

## Order Endpoints

### Endpoint: `/orders/`

**Method**: POST  
**Purpose**: Create a new cleaning order  
**Authentication**: Required (Bearer token, role: user)

**Request Body**:
```json
{
  "property_type": "Apartment",
  "rooms": 3,
  "bathrooms": 2,
  "cleaning_type": "Standard",
  "address": "Abay Avenue 150",
  "apartment": "25",
  "city": "Almaty",
  "phone": "+77001234567",
  "latitude": 43.238949,
  "longitude": 76.889709,
  "items": [
    {
      "service_name": "Window Cleaning",
      "quantity": 2,
      "price": 2000.0
    },
    {
      "service_name": "Deep Cleaning",
      "quantity": 1,
      "price": 11000.0
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "user_id": 1,
  "cleaner_id": null,
  "status": "pending",
  "total_price": 15000.0,
  "created_at": "2024-01-15T10:30:00Z",
  "property_type": "Apartment",
  "rooms": 3,
  "bathrooms": 2,
  "cleaning_type": "Standard",
  "address": "Abay Avenue 150",
  "apartment": "25",
  "city": "Almaty",
  "phone": "+77001234567",
  "latitude": 43.238949,
  "longitude": 76.889709,
  "items": [
    {
      "id": 1,
      "service_name": "Window Cleaning",
      "quantity": 2,
      "price": 2000.0
    },
    {
      "id": 2,
      "service_name": "Deep Cleaning",
      "quantity": 1,
      "price": 11000.0
    }
  ]
}
```

**Error Codes**:
- 400: At least one service must be selected
- 401: Unauthorized (missing or invalid token)
- 422: Validation error

---

### Endpoint: `/orders/me`

**Method**: GET  
**Purpose**: Get order history for current user (alias for `/users/me/orders`)  
**Authentication**: Required (Bearer token, role: user)

**Response**: Same as `/users/me/orders`

**Error Codes**:
- 401: Unauthorized (missing or invalid token)

---

## Cleaner Endpoints

### Endpoint: `/cleaner/signup`

**Method**: POST  
**Purpose**: Register a new cleaner account  
**Authentication**: Not required

**Request Body**:
```json
{
  "name": "Jane",
  "surname": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+77001234568",
  "password": "securepassword123",
  "password_confirm": "securepassword123",
  "city": "Almaty"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "name": "Jane",
    "surname": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+77001234568",
    "role": "cleaner",
    "city": "Almaty",
    "reward_points": 0,
    "totp_enabled": false,
    "totp_setup_pending": false,
    "addresses": []
  }
}
```

**Error Codes**:
- 400: Passwords do not match, or email is already registered
- 422: Validation error

---

### Endpoint: `/cleaner/login`

**Method**: POST  
**Purpose**: Authenticate cleaner and receive access token  
**Authentication**: Not required

**Request Body**:
```json
{
  "email": "jane.smith@example.com",
  "password": "securepassword123",
  "totp_code": "123456"
}
```

**Response**: Same format as `/auth/login`

**Error Codes**:
- 401: Invalid email or password, TOTP_REQUIRED, or INVALID_TOTP
- 403: NOT_A_CLEANER (user exists but is not a cleaner)
- 422: Validation error

---

### Endpoint: `/cleaner/orders/available`

**Method**: GET  
**Purpose**: List available (unassigned) orders  
**Authentication**: Required (Bearer token, role: cleaner)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "user_id": 1,
    "cleaner_id": null,
    "status": "pending",
    "total_price": 15000.0,
    "created_at": "2024-01-15T10:30:00Z",
    "property_type": "Apartment",
    "rooms": 3,
    "bathrooms": 2,
    "cleaning_type": "Standard",
    "address": "Abay Avenue 150",
    "apartment": "25",
    "city": "Almaty",
    "phone": "+77001234567",
    "latitude": 43.238949,
    "longitude": 76.889709,
    "items": []
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not a cleaner)

---

### Endpoint: `/cleaner/orders/{order_id}/take`

**Method**: POST  
**Purpose**: Accept an available order  
**Authentication**: Required (Bearer token, role: cleaner)

**Parameters**:
- `order_id` (path, integer): ID of the order to accept

**Response** (200 OK):
```json
{
  "id": 1,
  "user_id": 1,
  "cleaner_id": 2,
  "status": "accepted",
  "total_price": 15000.0,
  "created_at": "2024-01-15T10:30:00Z",
  "property_type": "Apartment",
  "rooms": 3,
  "bathrooms": 2,
  "cleaning_type": "Standard",
  "address": "Abay Avenue 150",
  "apartment": "25",
  "city": "Almaty",
  "phone": "+77001234567",
  "latitude": 43.238949,
  "longitude": 76.889709,
  "items": []
}
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not a cleaner)
- 404: Order not available (already assigned or not found)
- 409: CLEANER_HAS_ACTIVE_ORDER (cleaner already has an active order)

---

### Endpoint: `/cleaner/orders`

**Method**: GET  
**Purpose**: List orders assigned to current cleaner  
**Authentication**: Required (Bearer token, role: cleaner)

**Response** (200 OK): Same format as `/cleaner/orders/available`, but only includes orders where `cleaner_id` matches current user.

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not a cleaner)

---

### Endpoint: `/cleaner/orders/{order_id}/status`

**Method**: PATCH  
**Purpose**: Update order status  
**Authentication**: Required (Bearer token, role: cleaner)

**Parameters**:
- `order_id` (path, integer): ID of the order to update

**Request Body**:
```json
{
  "status": "going"
}
```

**Allowed Status Values**: `pending`, `accepted`, `going`, `started`, `finished`, `paid`

**Valid Status Transitions**:
- `accepted` → `going`
- `going` → `started`
- `started` → `finished`
- `finished` → `paid` (admin only, typically)

**Response** (200 OK):
```json
{
  "id": 1,
  "user_id": 1,
  "cleaner_id": 2,
  "status": "going",
  "total_price": 15000.0,
  "created_at": "2024-01-15T10:30:00Z",
  "property_type": "Apartment",
  "rooms": 3,
  "bathrooms": 2,
  "cleaning_type": "Standard",
  "address": "Abay Avenue 150",
  "apartment": "25",
  "city": "Almaty",
  "phone": "+77001234567",
  "latitude": 43.238949,
  "longitude": 76.889709,
  "items": []
}
```

**Error Codes**:
- 400: Invalid status, or INVALID_STATUS_TRANSITION (e.g., cannot go from `accepted` to `finished`)
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not a cleaner)
- 404: Order not found or not assigned to current cleaner

---

## Admin Endpoints

### Endpoint: `/admin/users`

**Method**: GET  
**Purpose**: List all users  
**Authentication**: Required (Bearer token, role: admin)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "name": "John",
    "surname": "Doe",
    "email": "john.doe@example.com",
    "phone": "+77001234567",
    "role": "user",
    "city": "Almaty",
    "reward_points": 100,
    "totp_enabled": false,
    "totp_setup_pending": false,
    "addresses": []
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)

---

### Endpoint: `/admin/cleaners`

**Method**: GET  
**Purpose**: List all cleaners with their user information  
**Authentication**: Required (Bearer token, role: admin)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "user_id": 2,
    "availability": true,
    "user": {
      "id": 2,
      "name": "Jane",
      "surname": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+77001234568",
      "role": "cleaner",
      "city": "Almaty",
      "reward_points": 0,
      "totp_enabled": false,
      "totp_setup_pending": false,
      "addresses": []
    }
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)

---

### Endpoint: `/admin/cleaners`

**Method**: POST  
**Purpose**: Promote an existing user to cleaner and create cleaner profile  
**Authentication**: Required (Bearer token, role: admin)

**Request Body**:
```json
{
  "user_id": 3,
  "availability": true
}
```

**Response** (201 Created):
```json
{
  "id": 2,
  "user_id": 3,
  "availability": true,
  "user": {
    "id": 3,
    "name": "Bob",
    "surname": "Johnson",
    "email": "bob.johnson@example.com",
    "phone": "+77001234569",
    "role": "cleaner",
    "city": "Almaty",
    "reward_points": 0,
    "totp_enabled": false,
    "totp_setup_pending": false,
    "addresses": []
  }
}
```

**Error Codes**:
- 400: Cleaner profile already exists for this user
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)
- 404: User not found
- 422: Validation error

---

### Endpoint: `/admin/cleaners/create-account`

**Method**: POST  
**Purpose**: Create a new cleaner account directly  
**Authentication**: Required (Bearer token, role: admin)

**Request Body**:
```json
{
  "name": "Alice",
  "surname": "Williams",
  "email": "alice.williams@example.com",
  "phone": "+77001234570",
  "password": "securepassword123",
  "city": "Almaty"
}
```

**Response** (201 Created): Same format as `/admin/cleaners` POST

**Error Codes**:
- 400: Email is already registered
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)
- 422: Validation error

---

### Endpoint: `/admin/orders`

**Method**: GET  
**Purpose**: List all orders with optional filtering  
**Authentication**: Required (Bearer token, role: admin)

**Query Parameters**:
- `status_filter` (optional, string): Filter by order status (pending, accepted, going, started, finished, paid)
- `city` (optional, string): Filter by city

**Example Request**:
```
GET /admin/orders?status_filter=pending&city=Almaty
```

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "user_id": 1,
    "cleaner_id": 2,
    "status": "pending",
    "total_price": 15000.0,
    "created_at": "2024-01-15T10:30:00Z",
    "property_type": "Apartment",
    "rooms": 3,
    "bathrooms": 2,
    "cleaning_type": "Standard",
    "address": "Abay Avenue 150",
    "apartment": "25",
    "city": "Almaty",
    "phone": "+77001234567",
    "latitude": 43.238949,
    "longitude": 76.889709,
    "items": []
  }
]
```

**Error Codes**:
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)

---

### Endpoint: `/admin/orders/{order_id}`

**Method**: PATCH  
**Purpose**: Update order status and/or assign cleaner (admin override)  
**Authentication**: Required (Bearer token, role: admin)

**Parameters**:
- `order_id` (path, integer): ID of the order to update

**Request Body**:
```json
{
  "status": "accepted",
  "cleaner_id": 2
}
```

**Note**: Both fields are optional. Only provided fields will be updated.

**Response** (200 OK):
```json
{
  "id": 1,
  "user_id": 1,
  "cleaner_id": 2,
  "status": "accepted",
  "total_price": 15000.0,
  "created_at": "2024-01-15T10:30:00Z",
  "property_type": "Apartment",
  "rooms": 3,
  "bathrooms": 2,
  "cleaning_type": "Standard",
  "address": "Abay Avenue 150",
  "apartment": "25",
  "city": "Almaty",
  "phone": "+77001234567",
  "latitude": 43.238949,
  "longitude": 76.889709,
  "items": []
}
```

**Error Codes**:
- 400: Cleaner user not found or not a cleaner
- 401: Unauthorized (missing or invalid token)
- 403: Not enough permissions (not an admin)
- 404: Order not found
- 422: Validation error

---

## Common Error Response Format

All error responses follow this format:

```json
{
  "detail": "Error message description"
}
```

## HTTP Status Codes Summary

- **200 OK**: Successful GET, PUT, PATCH request
- **201 Created**: Successful POST request that created a resource
- **204 No Content**: Successful DELETE request
- **400 Bad Request**: Invalid request data or business rule violation
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions (wrong role)
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email, active order exists)
- **422 Unprocessable Entity**: Validation error (invalid data format)

