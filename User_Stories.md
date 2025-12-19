# User Stories

## Story 1

As a **customer**, I want to **create an account with email and password**, so I can **access the platform and book cleaning services**.

**Acceptance Criteria**:
- System accepts unique email addresses
- Password must be at least 8 characters long
- Password confirmation must match password
- User receives JWT access token upon successful registration
- User role is set to "user" by default
- Duplicate email registration returns 400 error with clear message
- User profile is created with provided information (name, surname, phone, city)

---

## Story 2

As a **customer**, I want to **log in with my email and password**, so I can **access my account and manage my orders**.

**Acceptance Criteria**:
- System validates email and password combination
- Returns JWT access token on successful authentication
- Returns 401 error for invalid credentials
- If 2FA is enabled, system requires valid 6-digit TOTP code
- Rate limiting prevents more than 8 login attempts per minute per IP
- User profile information is returned in response

---

## Story 3

As a **customer**, I want to **reset my password if I forget it**, so I can **regain access to my account**.

**Acceptance Criteria**:
- System generates a 6-digit reset code
- Reset code expires after 15 minutes
- Code is sent via email if SMTP is configured, otherwise logged to console
- User can reset password with valid code and new password
- Invalid or expired codes return 400 error
- Rate limiting prevents abuse (5 requests per 5 minutes per IP)
- Response message does not reveal whether email exists (security)

---

## Story 4

As a **customer**, I want to **use a price calculator to estimate cleaning costs**, so I can **make informed decisions before booking**.

**Acceptance Criteria**:
- Calculator accepts property type (Apartment/Private House)
- Calculator accepts number of rooms and bathrooms
- Calculator allows selection of additional services (e.g., window cleaning)
- Total price is calculated and displayed in real-time
- Calculator provides clear breakdown of costs

---

## Story 5

As a **customer**, I want to **create a cleaning order with selected services**, so I can **book a cleaning service**.

**Acceptance Criteria**:
- Customer must be authenticated to create an order
- Order must include at least one service item
- Order includes property details (type, rooms, bathrooms, address)
- Total price is calculated automatically from selected items
- Order status defaults to "pending"
- Customer receives reward points (1 point per 1000₸ spent)
- Order is stored with all provided details
- Order confirmation is displayed to customer

---

## Story 6

As a **customer**, I want to **view my order history**, so I can **track past and current cleaning services**.

**Acceptance Criteria**:
- Customer can view all their orders
- Orders are displayed in reverse chronological order (newest first)
- Each order shows status, total price, date, address, and service items
- Orders include assigned cleaner information (if assigned)
- Only authenticated customers can view their own orders

---

## Story 7

As a **customer**, I want to **manage my saved addresses**, so I can **quickly select addresses when creating orders**.

**Acceptance Criteria**:
- Customer can add multiple saved addresses
- Addresses include street address, apartment number, and optional geolocation
- Customer can view list of all saved addresses
- Customer can delete their own addresses
- Addresses are associated with the authenticated user
- Address validation ensures required fields are provided

---

## Story 8

As a **customer**, I want to **update my profile information**, so I can **keep my account details current**.

**Acceptance Criteria**:
- Customer can update name, surname, phone, and city
- Email cannot be changed (security)
- All fields are optional (partial updates supported)
- Changes are saved immediately
- Updated profile is returned in response

---

## Story 9

As a **customer**, I want to **enable two-factor authentication (2FA)**, so I can **enhance the security of my account**.

**Acceptance Criteria**:
- Customer can initiate 2FA setup from account page
- System generates TOTP secret and QR code
- QR code is displayed only once during setup
- Customer must verify TOTP code to enable 2FA
- 2FA is not enabled until verification succeeds
- Rate limiting prevents abuse (3 setup attempts per 5 minutes)
- 2FA is compatible with Google Authenticator and similar apps

---

## Story 10

As a **customer**, I want to **earn reward points for my orders**, so I can **benefit from loyalty rewards**.

**Acceptance Criteria**:
- Customer earns 1 reward point per 1000₸ spent on orders
- Points are calculated and added automatically upon order creation
- Points are displayed in customer profile
- Points balance is updated in real-time

---

## Story 11

As a **cleaner**, I want to **create a cleaner account**, so I can **access the cleaner dashboard and accept orders**.

**Acceptance Criteria**:
- Cleaner can register with email, password, name, surname, phone, and city
- Phone number is mandatory for cleaners
- Cleaner role is assigned automatically
- Cleaner profile is created with availability set to true
- Cleaner receives JWT access token upon registration
- Duplicate email registration returns 400 error

---

## Story 12

As a **cleaner**, I want to **log in to my cleaner account**, so I can **access the cleaner dashboard**.

**Acceptance Criteria**:
- Cleaner can log in with email and password
- System validates that account has "cleaner" role
- Returns 403 error if user is not a cleaner
- Supports optional TOTP 2FA if enabled
- Returns JWT access token on successful authentication

---

## Story 13

As a **cleaner**, I want to **view available (unassigned) orders**, so I can **select orders to accept**.

**Acceptance Criteria**:
- Cleaner can view list of orders with status "pending" and no assigned cleaner
- Orders are displayed in reverse chronological order
- Each order shows property details, address, total price, and service items
- Only authenticated cleaners can view available orders
- Orders assigned to other cleaners are not shown

---

## Story 14

As a **cleaner**, I want to **accept an available order**, so I can **start working on it**.

**Acceptance Criteria**:
- Cleaner can only accept orders with status "pending" and no assigned cleaner
- Cleaner cannot accept new order if they have an active order (status: accepted, going, or started)
- Order status changes to "accepted" upon acceptance
- Cleaner is assigned to the order (cleaner_id is set)
- Cleaner availability is automatically set to false
- System returns 409 error if cleaner already has an active order
- System returns 404 error if order is not available

---

## Story 15

As a **cleaner**, I want to **view my assigned orders**, so I can **track my work progress**.

**Acceptance Criteria**:
- Cleaner can view all orders assigned to them
- Orders are displayed in reverse chronological order
- Each order shows status, customer details, property details, and service items
- Only authenticated cleaners can view their own assigned orders

---

## Story 16

As a **cleaner**, I want to **update order status as I progress**, so I can **keep customers informed about service progress**.

**Acceptance Criteria**:
- Cleaner can only update status of their assigned orders
- Status transitions follow valid flow: accepted → going → started → finished
- Invalid status transitions return 400 error with clear message
- When order is marked "finished", cleaner availability is restored (if no other active orders exist)
- System enforces forward-only status progression
- Status updates are saved immediately

---

## Story 17

As an **administrator**, I want to **view all users in the system**, so I can **manage user accounts and roles**.

**Acceptance Criteria**:
- Admin can view list of all users (customers, cleaners, admins)
- User list includes profile information, role, and reward points
- Only users with "admin" role can access this endpoint
- Returns 403 error for non-admin users

---

## Story 18

As an **administrator**, I want to **create cleaner accounts**, so I can **onboard new cleaning service providers**.

**Acceptance Criteria**:
- Admin can create new cleaner accounts with all required information
- Cleaner role is assigned automatically
- Cleaner profile is created with availability set to true
- Duplicate email registration returns 400 error
- Only admins can create cleaner accounts

---

## Story 19

As an **administrator**, I want to **promote existing users to cleaners**, so I can **convert customers into service providers**.

**Acceptance Criteria**:
- Admin can promote any user to cleaner role
- Cleaner profile is created for the user
- User role is updated to "cleaner"
- Returns 400 error if cleaner profile already exists
- Returns 404 error if user does not exist
- Only admins can perform this action

---

## Story 20

As an **administrator**, I want to **view all cleaners**, so I can **monitor cleaner availability and performance**.

**Acceptance Criteria**:
- Admin can view list of all cleaners
- Each cleaner entry includes user information and availability status
- Cleaner list shows all cleaners regardless of availability
- Only admins can access this endpoint

---

## Story 21

As an **administrator**, I want to **view all orders with filtering options**, so I can **monitor platform activity and resolve issues**.

**Acceptance Criteria**:
- Admin can view all orders in the system
- Admin can filter orders by status (pending, accepted, going, started, finished, paid)
- Admin can filter orders by city
- Filters can be combined
- Orders are displayed in reverse chronological order
- Only admins can access this endpoint

---

## Story 22

As an **administrator**, I want to **manually assign cleaners to orders**, so I can **resolve assignment issues or optimize workload**.

**Acceptance Criteria**:
- Admin can assign any cleaner to any order
- System validates that assigned user is a cleaner
- Order cleaner_id is updated
- Returns 400 error if cleaner user not found or not a cleaner role
- Only admins can perform this action

---

## Story 23

As an **administrator**, I want to **update order status and details**, so I can **resolve disputes and correct data**.

**Acceptance Criteria**:
- Admin can update order status to any valid status
- Admin can assign or reassign cleaners to orders
- Both status and cleaner_id can be updated independently
- Changes are saved immediately
- Only admins can perform this action

---

## Story 24

As a **user (any role)**, I want to **access the platform with dark/light mode**, so I can **use the application comfortably in different lighting conditions**.

**Acceptance Criteria**:
- User can toggle between dark and light themes
- Theme preference is saved in browser local storage
- Theme persists across page reloads and sessions
- Theme applies consistently across all pages

---

## Story 25

As a **user (any role)**, I want to **receive clear error messages**, so I can **understand what went wrong and how to fix it**.

**Acceptance Criteria**:
- All API errors return descriptive error messages
- Validation errors specify which fields are invalid
- Authentication errors clearly indicate missing or invalid tokens
- Business rule violations return appropriate error codes and messages
- Error messages are user-friendly and actionable

