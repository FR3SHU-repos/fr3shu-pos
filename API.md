# KOMOLA Organic POS — API (`/api/v1`)

All responses use the standard envelope:

```jsonc
// success
{ "success": true,  "message": "…", "data": <payload> }
// failure  (error detail only in development)
{ "success": false, "message": "…", "error": "…" }
```

Auth is a JWT in the `httpOnly` cookie `pos_token`. The session payload carries
`sub, email, name, role, orgId, orgType, locationId`. **Tenant scope (`orgId`,
`locationId`) is taken from the session — never from the request.** List endpoints that
paginate return `data.meta = { total, page, limit, totalPages }`.

Roles: `Admin | Owner | Manager | Cashier | InventoryManager`.

---

## Auth

### `POST /auth/login`
Body `{ email, password }`. Sets the cookie. → `data`: `{ id, name, email, role, orgId, orgType, locationId }`.
`401` on bad credentials (uniform message).

### `POST /auth/logout`
Clears the cookie. → `data: null`.

### `GET /auth/me`
→ current session user, or `401`.

---

## Categories

### `GET /categories`
Any authenticated user. → `{ items: Category[] }` (org-scoped, active only).

### `POST /categories`  — `Owner | Manager | Admin`
Body `{ name, sortOrder? }`. Slug is derived; `409` on duplicate slug.

---

## Products

### `GET /products`
Query `q?` (name / sku / barcode, regex-escaped), `status?`, `page?`, `limit?` (≤100).
Org-scoped; excludes `archived` unless `status` is given. → `{ items, meta }`.

### `POST /products`  — `Owner | Manager | Admin`
Body (Zod `createProductSchema`):
```jsonc
{
  "name": "Organic Tomatoes",
  "sku": "GH-VEG-TOM",
  "barcode": "8901…",           // optional
  "categoryId": "…",            // optional
  "saleUnit": "kg",             // kg|g|l|ml|piece|bunch|pack
  "baseUnit": "g",              // g|ml|count — must match saleUnit's family
  "basePerSaleUnit": 1000,      // must equal the canonical value for saleUnit
  "taxRateBps": 0,              // basis points, 0..10000
  "basePricePaise": 6000,       // optional fallback price
  "certificationId": "…",       // optional
  "organicStatus": "Verified",  // Verified|InConversion|PendingVerification|Expired|Rejected|NotOrganic
  "isPinned": false
}
```
`409` on duplicate SKU within the org.

### `GET /products/:id`  — org-scoped
### `PATCH /products/:id`  — `Owner | Manager | Admin`
Whitelisted fields only: `name, barcode, categoryId, description, taxRateBps,
basePricePaise, certificationId, organicStatus, isPinned, status`. The raw body is never
`$set`.

---

## Lots & inventory

### `GET /lots`
Query `productId?`, `locationId?`. → `{ items: Lot[] }` (org-scoped, FEFO-ish order).

### `POST /lots`  — `Owner | Manager | InventoryManager | Admin`
Receives a lot into inventory. Body (Zod `receiveLotSchema`):
```jsonc
{
  "productId": "…",
  "lotCode": "TOM-A",
  "receivedBase": 40000,        // integer base units (g / ml / count)
  "receivedUnit": "kg",
  "locationId": "…",            // must belong to the caller's org
  "producerName": "…",          // optional
  "fpoName": "…",               // optional
  "farmOrProducerId": "…",      // optional
  "harvestDate": "ISO", "packingDate": "ISO", "expiryDate": "ISO"  // optional
}
```
In one transaction: creates the `Lot` (with a `certificationSnapshot` copied from the
product's certificate), upserts the `InventoryBalance`, and appends a `receipt`
`StockMovement`. `409` on duplicate `(productId, lotCode)`.

### `GET /inventory`
Query `productId?`, `locationId?` (defaults to the session location). →
`{ items: InventoryBalance[] }` enriched with `productName, sku, saleUnit, lotCode, expiryDate`.

---

## Register sessions

### `GET /register-sessions`
→ `{ registers, currentSession, recentSessions }` for the caller's location.

### `POST /register-sessions/open`  — `Cashier | Manager | Owner | Admin`
Body `{ registerId, openingCashPaise }`. `409` if the register already has an open session
(partial unique index + service check). Register must be at the caller's location.

### `POST /register-sessions/:id/close`  — `Cashier | Manager | Owner | Admin`
Body `{ countedCashPaise, varianceNote? }`.
`expectedCashPaise = opening + cashSales − refunds + cashIn − cashOut`;
`cashVariancePaise = counted − expected`.
`400` if `|variance| > POS_CASH_VARIANCE_NOTE_THRESHOLD_PAISE` and no note is given.

---

## Sales

### `GET /sales`
Query `page?`, `limit?`, `receiptNo?` (prefix), `phone?` (exact). Org- and
location-scoped, newest first. → `{ items, meta }`.

### `POST /sales`  — `Cashier | Manager | Owner | Admin`  — **idempotent**
Body (Zod `createSaleSchema`):
```jsonc
{
  "idempotencyKey": "uuid-or-client-key",   // 8..120 chars, unique
  "sessionId": "…",                          // optional; else the caller's open session
  "items": [
    { "productId": "…", "qty": 1.5, "saleUnit": "kg",
      "lotId": "…",                          // optional; Manager+ override, needs a reason
      "lotOverrideReason": "…",
      "discountPaise": 0 }                    // optional, clamped to line gross
  ],
  "payments": [
    { "method": "cash", "amountPaise": 9000 },
    { "method": "upi",  "amountPaise": 1000, "upiRef": "…" }
  ],
  "cartDiscountPaise": 0,                     // optional
  "customerName": "…", "customerPhone": "…",  // optional
  "marketingConsent": false,                  // optional, separate from recording the phone
  "deviceId": "…"                             // optional
}
```
Behaviour:
- If `idempotencyKey` already exists → `200` `{ sale, reused: true }`, no new effect.
- Otherwise, in one transaction: recompute every line from `ProductPrice` (client
  amounts ignored) → FEFO lot pick → atomic `$gte` stock decrement per line → insert
  `Sale` + `Payment[]` + `sale` `StockMovement[]` → `$inc` the `POSSession` totals →
  `201` `{ sale, reused: false }`.
- `payments` must sum **exactly** to the server-computed total → else `400`.
- Insufficient stock in any single lot → `409` (no split-across-lots in this slice).
- No open register session → `409`.

### `GET /sales/:id`  — org-scoped
→ `{ sale, payments }`.

---

## Error status codes

`400` validation / payment mismatch / bad id · `401` no session · `403` role or
cross-location · `404` not found · `409` duplicate / stock conflict / no open session ·
`500` unexpected (no stack trace in the body).
