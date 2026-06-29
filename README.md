# Magamart — Backend API

REST API for the Magamart e-commerce platform, built with **NestJS**, **MongoDB (Mongoose)**, and **JWT authentication**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | MongoDB via Mongoose |
| Auth | JWT (access + refresh tokens), Passport |
| File uploads | Multer + ServeStaticModule |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI |
| Config | @nestjs/config + Joi schema validation |

---

## Project Structure

```
src/
├── common/
│   ├── guards/          # JwtAuthGuard
│   └── interceptors/    # TransformInterceptor (wraps all responses)
├── config/              # configuration.ts + Joi validation schema
├── modules/
│   ├── auth/            # Login, signup, refresh, logout
│   ├── users/           # User profile
│   ├── products/        # Product CRUD + image upload + filtering
│   ├── categories/      # Category list + names
│   ├── cart/            # Per-user cart (add, update, remove, clear)
│   ├── upload/          # Generic file upload endpoint
│   └── health/          # Health check endpoint
└── main.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)

### Installation

```bash
cd magamart-be
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=8000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/magamart

JWT_ACCESS_SECRET=your_access_secret_here
JWT_ACCESS_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGINS=http://localhost:3000

# Swagger basic-auth credentials
SWAGGER_USER=admin
SWAGGER_PASSWORD=admin
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server starts on `http://localhost:8000`.

---

## API Overview

All responses are wrapped by the `TransformInterceptor`:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Paginated list responses additionally include `total`, `page`, `limit`, and `totalPages` at the top level.

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | Public | Register a new user |
| POST | `/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Bearer | Invalidate refresh token |
| GET | `/auth/me` | Bearer | Get current user |

### Products — `/products`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Public | List products (search, category, price, sort, pagination) |
| GET | `/products/:id` | Public | Get single product |
| GET | `/products/categories` | Public | Get distinct category names |
| POST | `/products` | Bearer | Create product (multipart/form-data) |
| PUT | `/products/:id` | Bearer | Update product (multipart/form-data) |
| DELETE | `/products/:id` | Bearer | Delete product |

Query params for `GET /products`: `search`, `category`, `minPrice`, `maxPrice`, `sortBy`, `sortOrder`, `page`, `limit`.

### Categories — `/categories`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | List all categories |
| GET | `/categories/names` | Public | List category name strings |
| POST | `/categories` | Bearer | Create category |
| PUT | `/categories/:id` | Bearer | Update category |
| DELETE | `/categories/:id` | Bearer | Delete category |

### Cart — `/cart`

All cart routes require a valid Bearer token.

| Method | Path | Description |
|---|---|---|
| GET | `/cart` | Get the current user's cart |
| POST | `/cart` | Add item `{ productId, quantity? }` |
| PUT | `/cart/:productId` | Update item quantity `{ quantity }` |
| DELETE | `/cart/:productId` | Remove a single item |
| DELETE | `/cart` | Clear the entire cart |

### Users — `/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | Bearer | List all users |
| GET | `/users/:id` | Bearer | Get user by ID |
| PUT | `/users/:id` | Bearer | Update user |
| DELETE | `/users/:id` | Bearer | Delete user |

---

## File Uploads

Product images are uploaded via `multipart/form-data` to `POST /products` and `PUT /products/:id` (field name: `image`).

- Stored at: `./uploads/products/<timestamp>-<random>.<ext>`
- Served statically at: `http://localhost:8000/uploads/products/<filename>`
- Accepted formats: jpg, jpeg, png, gif, webp
- Max size: 5 MB

---

## Swagger Docs

Swagger UI is available at `http://localhost:8000/api` (protected by HTTP Basic Auth using `SWAGGER_USER` / `SWAGGER_PASSWORD`).

---

## Scripts

```bash
npm run start:dev     # Watch mode development server
npm run start:debug   # Debug mode
npm run build         # Compile TypeScript
npm run start:prod    # Run compiled output
npm run lint          # ESLint
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
```
