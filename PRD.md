# Product Requirements Document (PRD)

## 1. Product Goal

The main objective of TazaBolsyn is to provide a digital platform that connects customers with professional cleaning service providers, streamlining the booking process, order management, and service delivery. The platform aims to eliminate the friction in finding and booking cleaning services while providing transparency in pricing, order tracking, and a rewards system to enhance customer loyalty.

## 2. Problem Statement

Customers seeking cleaning services face several challenges:
- Difficulty finding reliable and available cleaners
- Lack of transparent pricing information
- Inefficient booking processes (phone calls, multiple platforms)
- No centralized system to track order status and history
- Limited visibility into service quality and cleaner availability

Cleaners face challenges:
- Difficulty finding customers and managing bookings
- Lack of a centralized platform to manage multiple orders
- No efficient way to update customers on service progress

Administrators need:
- A comprehensive view of all users, cleaners, and orders
- Tools to manage user roles and assign cleaners to orders
- Ability to monitor platform activity and resolve issues

## 3. Target Audience

The platform serves three distinct user groups:

1. **Customers**: Homeowners, renters, and business owners who need cleaning services
2. **Cleaners**: Professional cleaning service providers who perform the cleaning work
3. **Administrators**: Platform managers who oversee operations, manage users, and ensure service quality

## 4. User Roles

- **User (Customer)**: Standard customer role with access to booking, account management, order history, and rewards
- **Cleaner**: Service provider role with access to available orders, assigned orders, and status update capabilities
- **Admin**: Administrative role with full access to user management, cleaner management, and order oversight

## 5. User Scenarios

### Customer Scenarios:
1. **New Customer Registration**: A new user visits the platform, creates an account, and receives a welcome experience
2. **Service Booking**: A customer uses the price calculator to estimate costs, selects services, and creates a cleaning order
3. **Order Tracking**: A customer views their order history and tracks the status of active orders
4. **Account Management**: A customer updates their profile, manages saved addresses, and enables two-factor authentication
5. **Password Recovery**: A customer forgets their password and uses the reset flow to regain access

### Cleaner Scenarios:
1. **Cleaner Registration**: A cleaner creates an account and sets up their profile
2. **Order Discovery**: A cleaner views available orders and selects one to accept
3. **Order Management**: A cleaner updates order status as they progress (accepted → going → started → finished)
4. **Availability Management**: A cleaner's availability is automatically managed based on active orders

### Administrator Scenarios:
1. **User Management**: An admin views all users, creates cleaner accounts, and manages user roles
2. **Order Oversight**: An admin views all orders, filters by status or city, and manually assigns cleaners if needed
3. **Cleaner Management**: An admin views all cleaners, creates cleaner accounts, and monitors cleaner availability

## 6. Functional Requirements

The system must:

1. **User Authentication and Authorization**:
   - Allow users to register with email and password
   - Support login with email and password
   - Implement JWT-based authentication
   - Support optional TOTP two-factor authentication
   - Provide password reset functionality via email

2. **Customer Features**:
   - Provide a cleaning price calculator with configurable parameters (rooms, bathrooms, property type)
   - Allow customers to create cleaning orders with service selections
   - Display order history with status tracking
   - Enable profile management (name, phone, city)
   - Support multiple saved addresses with geolocation
   - Implement a rewards points system (1 point per 1000₸ spent)

3. **Cleaner Features**:
   - Allow cleaners to view available (unassigned) orders
   - Enable cleaners to accept available orders
   - Support order status updates (pending → accepted → going → started → finished → paid)
   - Enforce business rule: one active order per cleaner at a time
   - Automatically manage cleaner availability based on active orders

4. **Administrator Features**:
   - View all users with filtering capabilities
   - Create and manage cleaner accounts
   - View all orders with status and city filtering
   - Manually assign cleaners to orders
   - Update order status and details

5. **Security Features**:
   - Hash passwords using bcrypt
   - Implement rate limiting on authentication endpoints
   - Enforce role-based access control (RBAC)
   - Support TOTP 2FA with QR code generation
   - Validate all input data using Pydantic schemas

## 7. Non-Functional Requirements

The system must satisfy:

- **Performance**: 
  - API response time under 500ms for standard operations
  - Support concurrent requests from multiple users
  - Efficient database queries with proper indexing

- **Reliability**: 
  - Database transactions ensure data consistency
  - Error handling prevents data corruption
  - Graceful degradation when optional services (email) are unavailable

- **Security**: 
  - Passwords stored as bcrypt hashes (never in plain text)
  - JWT tokens with configurable expiration
  - Rate limiting to prevent brute force attacks
  - Input validation to prevent injection attacks
  - CORS configuration for frontend security

- **Usability**: 
  - Intuitive user interface with clear navigation
  - Responsive design for various screen sizes
  - Dark/light mode theme support
  - Clear error messages and user feedback
  - Accessible forms and interactive elements

- **Scalability**: 
  - Modular architecture allowing component expansion
  - Database schema supports future feature additions
  - API design follows RESTful principles
  - Code structure supports team collaboration

## 8. MVP Scope

Features that must enter version 0.1:

- User registration and authentication (email/password)
- Customer account creation and profile management
- Cleaning price calculator
- Order creation with service selection
- Order history viewing for customers
- Cleaner registration and authentication
- Cleaner dashboard with available orders
- Order acceptance by cleaners
- Order status updates by cleaners
- Admin panel for user and order management
- Password reset functionality
- Optional TOTP 2FA setup and verification
- Saved addresses management
- Rewards points system
- Role-based access control (user, cleaner, admin)

## 9. Out-of-Scope (Backlog)

Features that do not enter MVP:

- Payment processing integration
- Real-time notifications (push notifications, WebSocket)
- Mobile applications (iOS/Android)
- Customer reviews and ratings
- Cleaner scheduling and calendar
- Multi-language support
- Advanced analytics and reporting
- Email notifications for order updates
- SMS notifications
- Customer-cleaner messaging/chat
- Recurring order scheduling
- Invoice generation
- Advanced search and filtering for customers
- Cleaner performance metrics
- Geographic routing optimization
- Integration with external mapping services (beyond basic coordinates)

## 10. Acceptance Criteria

Clear and testable criteria for each feature:

- **User Registration**:
  - System accepts unique email addresses
  - Password must be at least 8 characters
  - Password confirmation must match password
  - User receives JWT token upon successful registration
  - User role defaults to "user"
  - Duplicate email registration returns 400 error

- **User Login**:
  - System validates email and password
  - Returns JWT token on successful authentication
  - Returns 401 error for invalid credentials
  - If 2FA is enabled, requires valid TOTP code
  - Rate limiting prevents more than 8 login attempts per minute

- **Password Reset**:
  - System generates 6-digit reset code
  - Reset code expires after 15 minutes
  - Code is sent via email (if SMTP configured) or logged to console
  - User can reset password with valid code
  - Invalid or expired codes return 400 error
  - Rate limiting prevents abuse (5 requests per 5 minutes)

- **Order Creation**:
  - Customer must be authenticated
  - Order must include at least one service item
  - Total price is calculated from items
  - Order status defaults to "pending"
  - Customer receives reward points (1 point per 1000₸)
  - Order is stored with all provided details (address, property type, etc.)

- **Cleaner Order Acceptance**:
  - Cleaner can only accept orders with status "pending" and no assigned cleaner
  - Cleaner cannot accept new order if they have an active order (accepted, going, or started)
  - Cleaner availability is set to false upon order acceptance
  - Order status changes to "accepted" upon acceptance

- **Order Status Updates**:
  - Cleaner can only update status of their assigned orders
  - Status transitions follow valid flow: accepted → going → started → finished
  - Invalid status transitions return 400 error
  - When order is marked "finished", cleaner availability is restored (if no other active orders)

- **Admin Order Management**:
  - Admin can view all orders
  - Admin can filter orders by status and city
  - Admin can manually assign cleaners to orders
  - Admin can update order status
  - Only users with "admin" role can access admin endpoints

- **TOTP 2FA Setup**:
  - User can initiate 2FA setup from account page
  - System generates TOTP secret and QR code
  - QR code is displayed only once during setup
  - User must verify TOTP code to enable 2FA
  - 2FA is not enabled until verification succeeds
  - Rate limiting prevents abuse (3 setup attempts per 5 minutes)

- **Address Management**:
  - Customer can add multiple saved addresses
  - Addresses include optional geolocation (latitude, longitude)
  - Customer can delete their own addresses
  - Addresses are associated with the authenticated user

