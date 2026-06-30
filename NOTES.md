# Development Notes

## Tool Used

**Claude Code** (claude.ai/code) — the CLI/IDE agent from Anthropic — was used throughout this project. I ran it inside VS Code via the extension, working in an interactive loop rather than a one-shot prompt.

### How I structured prompts

I used a `CLAUDE.md` file at the project root as persistent context. This file documented the architecture, module structure, naming conventions, and response format upfront, so I didn't have to re-explain the project on each prompt. The agent read it automatically at the start of every session.

Rather than asking for the whole project in one go, I broke work into modules and prompted feature by feature:

- "Scaffold the NestJS project with MongoDB, JWT auth, and a ValidationPipe"
- "Add a products module with CRUD and image upload via Multer"
- "Add a cart module — find-or-create cart per user, cap quantity at stock"
- "Add an orders module — validate stock, snapshot prices, decrement stock, clear cart"
- "Add order confirmation email via Azure Communication Services"
- "Add analytics endpoints for the admin dashboard"

For each module I'd review the output, test it via Postman/curl, then move to the next. I also used specialist agents for specific sub-tasks — for example asking a focused agent to just review the JWT refresh flow for security issues, separate from the agent writing application code.

---

## Bugs the Agent Got Wrong

These are concrete issues I caught and had to fix during development:

### 1. Missing role enforcement on admin order routes (security)

**What went wrong:** The agent applied `JwtAuthGuard` at the controller class level and declared `RolesGuard` and `@Roles()` as available, but forgot to wire them onto the two admin-only routes: `GET /orders` (all orders) and `PUT /orders/:id/status`. Any logged-in user — including regular customers — could call these routes.

**How I caught it:** Logged in as a regular customer account in Postman and hit `GET /orders` — it returned all orders in the database with no error.

**Fix:** Added `RolesGuard` to the class-level `@UseGuards()` and decorated both admin routes with `@Roles('admin')`.

---

### 2. Cart quantity not capped at stock limit

**What went wrong:** The first version of `CartService.addItem` simply did:
```typescript
existing.quantity = existing.quantity + qty;
```
There was no upper bound. A user could add 999 units of a product that only had 3 in stock.

**How I caught it:** Tested by adding the same product to the cart three times and checking the quantity — it went to 3, 6, 9 instead of capping at the available stock.

**Fix:** Changed to `Math.min(existing.quantity + qty, product.stock)`, which the agent applied correctly once I described the expected behaviour explicitly.

---

### 3. Order items used a client-provided price instead of a DB snapshot

**What went wrong:** An early iteration of `CreateOrderDto` included a `price` field per item, and the service used `dto.items[i].price` to build the order. This meant a client could send any price they liked.

**How I caught it:** Code review — I noticed the price was coming from the request body rather than being fetched from the product record.

**Fix:** Removed `price` from the DTO entirely. The service now fetches each product from the database and uses `product.price` as the price snapshot. This is the correct behaviour for an e-commerce system where prices need to be tamper-proof.

---

### 4. `req.user.id` missing the `._id` fallback

**What went wrong:** The agent wrote `req.user.id` to extract the user ID. Mongoose documents expose both `.id` (string virtual) and `._id` (ObjectId). Depending on how the JWT strategy's `validate()` returns the user, `.id` could be undefined, causing silent failures when constructing `new Types.ObjectId(userId)`.

**How I caught it:** A cart request failed with a CastError — "Cast to ObjectId failed for value undefined".

**Fix:** Added a `uid()` helper: `req.user.id ?? req.user._id.toString()` to handle both cases robustly.

---

### 5. No status transition validation on order updates

**What went wrong:** `updateStatus` accepted any valid enum value and applied it regardless of the current status. An order that was `delivered` could be moved back to `pending`, and a `cancelled` order could be set to `shipped`.

**How I caught it:** Manual testing — updated a delivered order back to `pending` via Postman, which succeeded silently.

**Fix:** Added a `VALID_TRANSITIONS` map enforcing a one-way lifecycle:
```
pending → processing | cancelled
processing → shipped | cancelled
shipped → delivered
delivered → (terminal)
cancelled → (terminal)
```

---

## How I Verified Output

1. **After each module:** Ran `npm run start:dev` and tested all new endpoints via Postman. Checked request/response shapes against what the frontend expected.
2. **DB state:** Used MongoDB Compass to inspect documents directly — confirmed stock decremented after an order, cart cleared, order record created correctly.
3. **Auth flows:** Tested JWT expiry by manipulating `JWT_ACCESS_EXPIRES_IN=10s`, confirmed 401 was returned and refresh token worked.
4. **Role enforcement (after fixing bug #1):** Confirmed regular users get 403 on admin routes, admin gets 200.
5. **Email:** Azure Communication Services free tier — confirmed delivery in a real inbox after seeding an order.

---

## Recommendations — Interpretation and Reasoning

The spec said "implement recommendations." This is deliberately open-ended; I had to choose an interpretation.

**What I chose:** Same-category suggestions. `GET /products/:id/recommendations` returns up to 6 products from the same category as the requested product, excluding the product itself, sorted by newest first.

**Why this approach:**
- It's a genuine signal. Users viewing a product are likely interested in its category.
- Zero infrastructure overhead — it's one extra MongoDB query using an indexed field (`category: 1`).
- No cold-start problem. Works immediately with the seeded data and for new users with no history.
- Easy to explain, test, and reason about.

**Approaches I considered and rejected:**
- **Purchase-history affinity** (top categories from order history): Better personalisation, but requires order data per user. New users and guest shoppers get nothing, making the feature invisible during the demo/assessment window.
- **Co-occurrence** (products that appear together in orders): Much stronger signal, but requires enough order data to be meaningful and is harder to explain quickly.

**What I'd do with more time:** Add a weighted blend — same-category as the base layer, co-occurrence from order history as a boost when sufficient data exists. The endpoint contract wouldn't change.

---

## Trade-offs and What I'd Do With More Time

| Area | What I built | What I'd add |
|---|---|---|
| **Recommendations** | Same-category, 6 results | Co-occurrence scoring, personalisation by user history |
| **Payment** | `paymentStatus: 'paid'` set on creation (simulated) | Stripe webhook → set status only after payment confirmation |
| **Tests** | Unit tests for critical service logic | Integration tests against a real MongoDB (e.g. `@shelf/jest-mongodb`) |
| **Admin product routes** | JwtAuthGuard only | Should also have `@Roles('admin')` — currently any logged-in user can create/update/delete products |
| **Search** | Regex-based full-text search | MongoDB Atlas Search or a text index with stemming |
| **Refresh token rotation** | Hashed refresh token stored in DB | One-time-use rotation with immediate invalidation on reuse |
| **Rate limiting** | None | `@nestjs/throttler` on auth endpoints |
| **Logging** | `Logger` from NestJS | Structured JSON logs with a correlation ID per request |

---

## Admin Product Routes — Known Gap

While fixing the orders authorization bug, I noticed that `POST /products`, `PUT /products/:id`, and `DELETE /products/:id` also have `@UseGuards(JwtAuthGuard)` but no `@Roles('admin')`. Any authenticated user can currently create or delete products. This is the same class of bug as the orders issue. With more time, `RolesGuard` + `@Roles('admin')` should be added to those routes.
