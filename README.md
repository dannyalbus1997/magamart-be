# Magamart Backend

REST API for the Magamart e-commerce platform. Built with NestJS 11, MongoDB, and JWT authentication.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 20 (LTS recommended) |
| npm | ≥ 9 |
| MongoDB | ≥ 6 (local or Atlas) |

---

## Installation

```bash
cd magamart-be
npm install
```

---

## Environment Variables

Create a `.env` file in `magamart-be/`:

```env
# Server
PORT=8000
CORS_ORIGINS=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/magamart

# JWT — use strong random strings in production
JWT_ACCESS_SECRET=your-access-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# Swagger UI basic auth
SWAGGER_USER=admin
SWAGGER_PASSWORD=admin

# Azure Communication Services (optional — order confirmation email)
ACS_CONNECTION_STRING=
ACS_SENDER_ADDRESS=DoNotReply@yourdomain.com
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: 8000) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **Yes** | Signing secret for access tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token lifetime (default: 15m) |
| `JWT_REFRESH_SECRET` | **Yes** | Signing secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token lifetime (default: 7d) |
| `SWAGGER_USER` | No | Swagger UI username (default: admin) |
| `SWAGGER_PASSWORD` | No | Swagger UI password (default: admin) |
| `ACS_CONNECTION_STRING` | No | Azure Communication Services (email) |
| `ACS_SENDER_ADDRESS` | No | From address for order confirmation emails |

---

## Running the App

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server starts at **http://localhost:8000**

---

## Seed Data

Run these in order on a fresh database:

```bash
# 1. Create the admin account
npm run db:seed-admin

# 2. Seed product categories
npm run db:seed-categories

# 3. Seed ~60 products (fetches real images from DummyJSON)
npm run db:seed-products
```

### Seeded Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@magamart.com` | `Admin@123` |

To create a customer account, register via `POST /auth/signup` or use the storefront.

---

## API Documentation (Swagger)

Navigate to **http://localhost:8000/api**

Swagger UI is protected with HTTP Basic auth — use `SWAGGER_USER` / `SWAGGER_PASSWORD` from `.env` (defaults: `admin` / `admin`). Click **Authorize** and paste a Bearer token to test authenticated endpoints.

---

## Running Tests

```bash
# All unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

Test files live alongside the code they cover (`*.spec.ts`). Current coverage:

| Module | What's tested |
|---|---|
| `orders.service` | Stock validation, price snapshot, stock decrement, status transitions |
| `auth.service` | Password hashing, wrong password rejection, token response shape |
| `cart.service` | Out-of-stock rejection, quantity capped at stock, item-not-found |

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | Public | Register |
| POST | `/auth/login` | Public | Login → access + refresh tokens |
| POST | `/auth/refresh` | Refresh token | Get new access token |
| POST | `/auth/logout` | Bearer | Invalidate refresh token |

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | Bearer | Get own profile |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Public | List (search, filter, paginate) |
| GET | `/products/categories` | Public | Distinct category names |
| GET | `/products/:id` | Public | Single product |
| GET | `/products/:id/recommendations` | Public | Same-category suggestions (up to 6) |
| POST | `/products` | Bearer | Create product with optional image upload |
| PUT | `/products/:id` | Bearer | Update product |
| DELETE | `/products/:id` | Bearer | Delete product |

Query params for `GET /products`: `search`, `category`, `minPrice`, `maxPrice`, `sortBy`, `sortOrder`, `page`, `limit`.

### Categories
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | All categories |
| POST | `/categories` | Bearer | Create category |
| PUT | `/categories/:id` | Bearer | Update category |
| DELETE | `/categories/:id` | Bearer | Delete category |

### Cart
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart` | Optional Bearer | Get cart (empty object if unauthenticated) |
| POST | `/cart` | Bearer | Add item `{ productId, quantity? }` |
| PUT | `/cart/:productId` | Bearer | Update quantity `{ quantity }` |
| DELETE | `/cart/:productId` | Bearer | Remove item |
| DELETE | `/cart` | Bearer | Clear cart |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Bearer | Place order from cart |
| GET | `/orders/my` | Bearer | My orders |
| GET | `/orders/:id` | Bearer | Single order (own only unless admin) |
| GET | `/orders` | Bearer + admin | All orders |
| PUT | `/orders/:id/status` | Bearer + admin | Update order status |

Order status lifecycle: `pending → processing → shipped → delivered`. `cancelled` is reachable from `pending` or `processing` only.

### Analytics
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/analytics/dashboard` | Bearer + admin | Sales totals, order counts, top products |

---

## Response Format

All responses use a consistent envelope:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Paginated responses add `total`, `page`, `limit`, `totalPages` at the top level alongside `data`.

Errors:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient stock for \"Widget\" (available: 2)",
  "path": "/orders",
  "timestamp": "2026-06-30T10:00:00.000Z"
}
```

---

## Architecture Notes

- **Shipping fee:** Free on orders ≥ $999; $99 flat fee otherwise
- **Price snapshot:** Order items store the product price at checkout — future price changes don't affect existing orders
- **Stock:** Validated before order placement; decremented atomically on success; cart cleared after order
- **Recommendations:** `GET /products/:id/recommendations` returns up to 6 products from the same category, newest first. See `NOTES.md` for design rationale and alternatives considered.
- **Image uploads:** Stored at `./uploads/products/`, served statically at `/uploads/products/<filename>`. Max 5 MB, images only.
