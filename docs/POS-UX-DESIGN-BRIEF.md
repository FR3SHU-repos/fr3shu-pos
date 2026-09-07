# KOMOLA POS — UX & Product Design Brief (working document)

Status: **design phase, not yet implemented.** Produced 2026-09-08.
Scope of this document: the design deliverables requested in the product brief,
plus a phased implementation plan for sign-off. No application code has been
changed for this brief. The three code changes already on the branch
(`httpx.Fail` logging, the `NULLIF`/`provisionRegister` SQL casts) are unrelated
bug fixes for the registration/login failure and are described in the session
notes, not here.

Architecture is unchanged and non-negotiable for this work:
`komola-pos (Next.js) → app/api/v1/[...path] proxy → go-api-backend (Gin) →
Supabase PostgreSQL`. Supabase Auth is identity only. No MongoDB. Redis optional.
All data access goes through the typed clients in `shared/lib/api/*`.

---

## 1. Audit of the `pos-zoho` reference images

33 screenshots were reviewed. They are almost entirely the **Zoho POS back-office
web console** (the "Business" and "Sales Channels" admin areas), not the POS
billing terminal itself. That is a useful finding in its own right: the billing
screen — the thing a cashier actually uses all day — is a separate app
(Zoho's "Billing Apps" for Windows/iOS/Android) and was not captured. So the
reference tells us a lot about **catalogue, configuration, and back-office
concepts** and little about **checkout ergonomics**; checkout is designed here
from the brief and POS first-principles.

| # (time) | Screen | What it shows | Relevance to KOMOLA |
|---|---|---|---|
| 1 (3.04.51) | Zoho account review | Generic Zoho account/email verification | None (product-agnostic) |
| 2 (3.05.00) | Onboarding — "Join your existing Organization" | Pick an existing org or create a new business | Seller setup: org selection when a user has memberships |
| 3 (3.05.30) | Dashboard loading skeleton | Full-page skeleton; left icon rail (Business / Sales Channels / Reports / Search / +) | Loading-state pattern; persistent nav rail concept |
| 4 (3.05.47) | Back-office Dashboard | Invoice Summary chart, Total Sales, POS/Commerce/Direct Sales split, Outstanding Receivables | Heavy accounting framing ("receivables", "invoices") — KOMOLA strips this |
| 5 (3.05.55) | Items list — empty | Illustration + "Create New Items", list/grid toggle, "All Items" filter, "+ New" | Empty-state pattern; product list affordances |
| 6 (3.06.03) | New Item form (1/4) | Name, Type Goods/Service, Category, Brand, Manufacturer, up to 15 images (front/rear/other) | The "too much" product form KOMOLA must collapse |
| 7 (3.06.17) | New Item form (2/4) | Item Type Single/Variants, Unit, SKU, Add Identifier, Description, Sales Info (Selling Price, MRP, **Account**) | Accounting "Account" field, MRP, variants |
| 8 (3.06.27) | New Item form (3/4) | Purchase Info (Cost Price, Account = COGS, Preferred Vendor), Track Inventory (Inventory Account, **Valuation Method = FIFO**, Reorder Point) | Valuation/ledger config — internal only for KOMOLA |
| 9 (3.06.38) | New Item form (4/4) | Returnable Item, Fulfilment (Dimensions L×W×H, Weight) | Shipping dimensions — excluded |
| 10 (3.06.48) | Categories — empty | "Grouping Items by Category"; hierarchy diagram Store → Main → Sub → By Brand/Type/Model | Nested categories — KOMOLA flattens to one level |
| 11 (3.06.55) | Add Category modal | Category Name, Parent Category, Category Image | Simple modal; drop "Parent" for v1 |
| 12 (3.07.05) | Inventory Adjustments — empty | "Keep Your Inventory Accurate", filter Type/Period, "FIFO Cost Lot Tracking Report" | "Adjustment" = the concept KOMOLA renames to Add/Reduce stock |
| 13 (3.07.12) | New Adjustment form | Mode Quantity/Value, Reference#, Date, **Account**, **Reason**, item table (Qty Available / New Qty on Hand / Qty Adjusted), Save as Draft / Convert to Adjusted | Ledger-first stock editing — KOMOLA replaces with a 2-field form |
| 14 (3.07.21) | Adjustment + Sales submenu | Sales menu: Orders, Invoices, Payments Received, Packages, Shipments, Returns, Credit Notes, Delivery Challan, **Sessions**, **Conflicts** | "Sessions" (shifts) and "Conflicts" (sync) are the two we keep |
| 15,21,25 (3.07.34 / 3.08.25 / 3.09.14) | New Sales Order | Customer, SO#, Reference, SO Date, Expected Shipment Date, Payment Terms, Delivery Method, Salesperson, item table (Qty/Rate/Amount) | B2B order document — **excluded** from KOMOLA phase |
| 16 (3.07.41) | Sales Order totals | Sub Total, Discount %, **TDS/TCS** tax, Adjustment, Customer Notes, Terms & Conditions, attachments | Tax-withholding config — excluded; KOMOLA tax is inclusive & automatic |
| 17 (3.07.50) | Invoices — empty | "It's time to get paid!", "Life cycle of an Invoice": Draft → Sent → Unpaid → Overdue/Partially Paid → Paid | Invoice *state machine* pattern → reused for **sync state**, not billing |
| 18 (3.07.58) | Transaction preferences modal | Discount level (none/line/txn), extra charges, rounding rules, salesperson field | Config KOMOLA replaces with safe defaults |
| 19 (3.08.03) | New Invoice form | Customer, Invoice#, Order#, Invoice Date, Terms, Due Date, Salesperson, Subject, item table with **"Scan Item"** | "Scan Item" affordance; everything else deferred |
| 20 (3.08.10) | Invoice totals | Same totals block; "Set up Payment Gateway" | KOMOLA has no gateway (manual UPI/card confirmation) |
| 22 (3.08.41) | New Shipment | Customer, SO#, Package#, Ship Date, Carrier, Tracking#, Tracking URL, Shipping Charges | Logistics — **excluded** |
| 23 (3.09.02) | Sales Returns — empty | Lifecycle: Sales Order → Shipment → Product Returned → Sales Return → Receive → Credit Note | KOMOLA return = "return against receipt", one step, restock |
| 24 (3.09.08) | All Sales Orders — empty | Omni-channel lifecycle: walk-in / phone / mobile → counter → fulfil / store pickup / home delivery / delivered | KOMOLA = walk-in counter sale only |
| 26 (3.09.34) | **Conflicts — empty** | "No Conflicts found / POS transactions will be listed here if any conflict is found"; Purchases submenu (Vendors, POs, Receives, Bills…) | Direct model for KOMOLA's **Sync conflicts** screen |
| 27 (3.09.51) | All Customers | Columns Name / Company / Email / Work Phone / Receivables; default "Walk-in Customer"; submenu Customers + **Loyalty** | KOMOLA customer = phone (+ optional name); "Walk-in" is the default |
| 28 (3.09.58) | Customer detail | Overview/Comments/Transactions/Mails/Statement tabs, addresses, Customer Type/Number, activity timeline | Full CRM — KOMOLA keeps only phone + points + recent receipts |
| 29 (3.10.28) | Edit Register modal | Display Name, Profile, per-doc **number formats** (SO `SB-`, Invoice `SI-`, Return `SRN-`, Credit Note `RCN-`); "Keyboard Shortcuts"; "Add Register" | KOMOLA auto-generates receipt numbers server-side; no prefix config UI |
| 30 (3.10.41) | POS Preferences | Transaction types; **Sessions & Cash Tracking** toggle; item **scan fields** (EAN→SKU→Name→Batch→Serial), **search fields**, cart display fields; **Batch Selection**; **weight-scale quantity**, **"enter qty before add"**, **group repeated items**, **weight-embedded barcode** | Richest reference screen. KOMOLA adopts: weight-embedded barcode parsing, "enter qty before add" for weighed goods, group repeated lines; hard-codes sensible scan/search order |
| 31 (3.10.56) | Payment Options | Tender types: Cash, Card, UPI, Credit Sale, Loyalty (inactive), Credits; "first 6 shown in express checkout" | KOMOLA: 3 big buttons — Cash, UPI, Card |
| 32 (3.11.07) | Register Profiles | Per-device profiles (preferences, tenders, item restrictions) for multi-register stores | Enterprise multi-till — **excluded**; one register per stall |
| 33 (3.11.18) | Reports Center | 50 system reports across Sales / Inventory / Valuation / Receivables / Payables / Activity | KOMOLA: two plain summaries (today's sales, register-close), no reports centre |

### Cross-cutting observations

- **Visual language:** Zoho uses a dark left icon-rail + dark secondary nav +
  white content, dense 13px type, `₹` amounts right-aligned, red asterisks for
  required fields, blue primary buttons, lots of chained dropdowns. Information
  density is very high and every list has a filter dropdown + list/grid toggle +
  "+ New" + "⋯" overflow. This is a power-user desktop console.
- **Terminology is accounting-first:** "Receivables", "Account", "COGS",
  "Inventory Valuation Method", "TDS/TCS", "Convert to Adjusted", "Credit Note",
  "Delivery Challan". A farmer will not parse these.
- **Everything is a document with a lifecycle diagram** (Invoice, Sales Order,
  Sales Return each ship an onboarding lifecycle graphic). The lifecycle-diagram
  idea is genuinely good for teaching; KOMOLA reuses it for **one** concept that
  actually matters to its users — the sync state of an offline sale.
- **Config surface is enormous** (Preferences, Payment Options, Register
  Profiles, Transaction Preferences, number formats). KOMOLA's equivalent is
  "sensible defaults, three things in More".
- **The checkout screen is absent.** No cart ergonomics, no numeric keypad, no
  weigh flow, no receipt to copy. Those are designed from the brief below.

---

## 2. Current KOMOLA POS UX audit

Codebase state (26 screens/components under `app/` + `shared/components/`). The
app is the "thin vertical slice" described in `DECISIONS.md` — one online happy
path, honestly built, with offline explicitly deferred.

### 2.1 What exists

| Area | File | State |
|---|---|---|
| Sign in | `app/(auth)/login/page.tsx` | Email/password + Google + WhatsApp(disabled) via Supabase |
| Register (create account) | `app/(auth)/register/page.tsx` | Supabase `signUp`; seller draft saved to `sessionStorage` |
| Seller onboarding | `app/seller/onboarding/page.tsx` (15 lines) | Thin; posts to `POST /seller-organizations` |
| Access-status screens | `app/seller/{pending,rejected,suspended}` | Static status pages |
| Dashboard | `app/(seller)/dashboard/page.tsx` | 3 stat cards (session sales, count, expected drawer cash) + recent sales |
| **Checkout** | `app/(seller)/pos/page.tsx` (642 lines) | Search + 2–3 col product tiles + right-hand cart + inline pay panel (cash/upi/split) + hold/resume via `localStorage` + success screen with `ReceiptView` + `window.print()` |
| Sales history | `app/(seller)/pos/history/page.tsx` | List (80 lines) |
| Sale detail | `app/(seller)/pos/history/[id]/page.tsx` | Receipt + payments |
| Register sessions | `app/(seller)/register-sessions/page.tsx` (219 lines) | Open (register + opening cash) / close (counted cash + variance note) / recent closed list |
| Products list | `app/(seller)/products/page.tsx` | List + search |
| Product create | `app/(seller)/products/new/page.tsx` (204 lines) | Name, SKU\*, Barcode, Category, Sale unit, Base price ₹, Tax %, Organic status — **flat, all fields visible** |
| Product edit | `app/(seller)/products/[id]/page.tsx` | Whitelisted PATCH fields |
| Inventory & lots | `app/(seller)/inventory/lots/page.tsx` | **Read-only** view of balances/lots |
| Admin | `app/admin/seller-applications/page.tsx` | Approve/reject/suspend sellers |
| Shell / nav | `shared/components/SellerShell.tsx` | Desktop 64-wide sidebar + mobile top bar + hamburger; 6 nav items |
| Receipt | `shared/components/pos/ReceiptView.tsx` (65 lines) | Compact print card: store name, receipt#, datetime, lines, gross/discount/tax/total, customer phone, "Thank you" |
| i18n | `shared/lib/i18n.ts` | Framework-free `en` + `te` dict, **POS screen only**, `translator(locale)`; `/pos` has a language `<select>` |
| Money / units | `shared/lib/money.ts`, `shared/lib/units.ts` | Integer paise; base units `g`/`ml`/`count`; `SaleUnit` = kg,g,l,ml,piece,bunch,pack |

### 2.2 Gaps vs. the brief

**Offline (largest gap).** There is no offline capability whatsoever — no service
worker, no IndexedDB, no request queue, no `navigator.onLine` handling.
`salesApi.create()` calls the network synchronously and a failure just toasts
"Sale failed". Held carts are in `localStorage` (brief requires **durable
IndexedDB**). `manifest.ts` exists (installable) but there is no SW so it is not
usable offline. The `sale.ts` interface has a `syncState` field already reserved
("synced" for online) — a hook for the future, unused.

**Navigation.** 6 items with technical labels: *Dashboard, Point of Sale, Sales
history, Register sessions, Products, Inventory & lots*. Brief wants 5 + More:
*Sell, Sales, Products, Stock, Register, More*. "Sell" is not the post-open
default (dashboard is). No connectivity indicator anywhere in the shell.

**Checkout ergonomics.**
- No barcode-scanner path beyond "type into search + press Enter" (single
  `productsApi.lookup`). No weight-embedded barcode parsing. No hardware-scanner
  keystroke buffering.
- No numeric keypad — quantity is a tiny `<input type=number>` with 36px −/+
  steppers; hard on a touch screen and for a weighed 1.75 kg entry.
- No "enter quantity, then add" flow for weighed goods (you add at qty 1 then
  fix it in the cart).
- No pinned/common-product grid — tiles are just the first 12 catalogue rows.
- Payment is **cash / upi / split**; brief wants **Cash / UPI / Card** as three
  large buttons. Split is an extra concept most stalls will not use.
- The whole screen is a `lg:grid-cols-[1fr_380px]` — on a phone the cart sits
  **below** the fold under the product grid; a cashier scrolls a lot.
- Success state replaces the screen; no "share on WhatsApp", no QR, no
  provisional-receipt labelling.

**Product create.** All ~8 fields shown at once, `SKU` is **required** and
farmer-facing, "Tax rate (%)" and "Organic status" enum are exposed with no
progressive disclosure. No photo, no "available quantity" on the same form
(stock is a separate read-only screen).

**Stock.** `inventory/lots` is read-only. There is no "Add stock" / "Reduce
stock" action at all — the backend `receiving`/`adjustment` APIs are not
implemented (per `cross-platform-assets/project-context.md`). Language is
"Inventory & lots", "balances", "movements".

**Buyer experience.** Nothing exists. No public receipt/invoice view, no invoice
lookup, no rewards lookup, no rewards summary. Backend has `pos.customers`,
`loyalty.accounts`, `loyalty.transactions` **tables** but **no API** for them.

**Error handling.** Generic `toast.error(res.message || "Sale failed")`. No
"saved on this device", no "only 3 kg left in this batch", no duplicate-safe
messaging. Raw backend messages can surface.

**Accessibility.** Some `aria-label`s on icon buttons and the language select.
But: quantity target 36px (< 44px), color-only status (variance green/amber
text), no skip link, receipt uses "organic ✓" (glyph only), no screen-reader
live region for cart/total changes, Telugu covers only `/pos` strings.

**Held carts** persist to `localStorage` under two different keys in two files
(`fr3shu-pos:held-carts` in `types.ts`, `HELD_CARTS_KEY` referenced in `pos`) —
brittle, not durable, lost on storage clear.

### 2.3 What is already right (keep)

- Server-authoritative money and stock; idempotency key per cart attempt
  (`idemRef`), regenerated after completion — the correct seam for offline replay.
- Integer paise / integer base units discipline end-to-end.
- `ReceiptView` is already a clean, print-scoped component.
- `translator()` pattern is small and good; just needs more keys + coverage.
- Semantic design tokens (`foreground-*`, `surface-*`, `status-*`), `lucide-react`
  only, `cx()` — consistent, keep.
- Manual (cashier-confirmed) UPI/card, no gateway — matches the brief.

---

## 3. Adopted / simplified / excluded reference patterns

### Adopted (adapted, not copied)

| Zoho pattern | KOMOLA adaptation | Why it suits KOMOLA users |
|---|---|---|
| Persistent left nav with a small set of top-level areas | Bottom tab bar on mobile / left rail on desktop: **Sell · Sales · Products · Stock · Register · More** | Thumb-reachable, always visible, 5 words a non-reader can memorise by icon+position |
| "Scan Item" as a first-class action in billing | Dedicated scan button + hardware-scanner keystroke capture + camera scan on mobile | Stalls use USB/BT scanners and phones; scanning must not require focusing a text field |
| Weight-embedded barcode + "fetch qty from weight scale" (Preferences) | Parse EAN-13 weight/price-embedded barcodes (configurable prefix) → auto-fill kg | Farmers sell loose produce by weight; the scale label *is* the quantity |
| "Enter item quantity before adding to cart" (Preferences) | For `kg`/`g`/`l`/`ml` products, tapping a tile opens a numeric keypad for quantity first; piece/bunch/pack add at 1 | One deliberate weigh entry beats add-then-correct |
| "Group items added more than once as a single line item" | Same — repeated adds increment the existing line | Shorter cart, less scrolling, matches mental model ("2 kg tomatoes", not two rows) |
| Empty states with illustration + one primary action | Same, with plain-language copy and Telugu | Tells a first-timer exactly what to do next |
| Lifecycle diagram as a teaching device (Invoice/Order/Return) | **One** lifecycle, for sync state: `Saved on device → Waiting → Syncing → Synced` (+ `Needs review`) | The only state machine a seller must understand offline; everything else is hidden |
| "Conflicts" screen (empty-state model) | **Sync conflicts** screen, supervisor-only, same "nothing here is good" framing | Direct analogue; sellers need a place to see and resolve rejected replays |
| Register "Sessions & Cash Tracking" + open/close with counted cash | Keep as **Register**: open (float) → sell → close (count) with variance note | Cash discipline is real for stalls; already partly built |
| Default "Walk-in Customer" | Sales are anonymous by default; phone is the only optional identifier | No typing required for the common case |
| Payment Options list, "first 6 in express checkout" | Three fixed big buttons: **Cash / UPI / Card** | Fewer choices = faster, fewer mistakes |
| List filter + search affordances | Simple search + a couple of chips (e.g. All / Low stock) | Keeps power without a dropdown maze |

### Simplified

| Zoho | KOMOLA |
|---|---|
| 4-section New Item form (Name/Type/Brand/Manufacturer/15 images; Variants; Sales+Purchase+Inventory *Accounts*; Valuation Method; Returnable; Dimensions) | **Basic form:** name, selling unit, price, available quantity, optional barcode, optional photo, organic status (when required). Everything else → **Advanced details** accordion, with safe defaults generated (SKU auto = slug+seq, tax = 0 unless set, valuation/FEFO internal) |
| Nested categories (Store → Main → Sub → By Brand/Type/Model) + category images | Flat, optional category label. No parent, no image in v1 |
| Inventory Adjustment (Mode Quantity/Value, Account, Reason enum, draft→adjusted, attachments) | **Add stock** (batch/harvest name + quantity + optional expiry) and **Reduce stock** (quantity + reason: damaged / spoiled / own use / correction). Two fields + a reason |
| Invoice state machine (Draft/Sent/Unpaid/Overdue/Partly/Paid) | A KOMOLA sale is paid at the counter. The only states are **sync** states |
| Sales Return lifecycle (6 nodes, credit notes) | **Return against a receipt:** open receipt → pick lines/quantities → choose cash refund or "adjust later" → stock restored. One screen |
| Reports Center (50 reports) | **Today** summary on Sell/Dashboard + **Register close summary**. CSV export deferred |
| Register number-format config (SB-/SI-/SRN-/RCN- prefixes, sequences) | Server allocates receipt numbers; no UI |
| Customer CRM (types, numbers, statements, mails, addresses, receivables) | Phone + optional name + points balance + last few receipts |

### Excluded (this phase) — and why

| Excluded | Reason |
|---|---|
| Sales Orders / quotes / order confirmation | KOMOLA is a **counter sale**, not an order-to-cash pipeline. No "expected shipment date" for a stall |
| Packages / Shipments / carriers / tracking / Delivery Challan | No delivery in this phase (brief: "Do not build … delivery system") |
| Purchases (Vendors, POs, Purchase Receives, Bills, Payments Made, Vendor Credits) | Procurement ERP is out of scope; stock enters via "Add stock" |
| TDS/TCS, tax accounts, COGS, inventory accounts, valuation-method choice | Accounting-ledger surface. Tax is inclusive and per-product; the rest is internal |
| Variants / brand / manufacturer / dimensions / weight-for-shipping | A farmer sells "tomatoes by the kg", not a variant matrix |
| Register Profiles / multiple registers per device / billing-app management | One stall = one register. Multi-till is an enterprise need |
| Commerce / omni-channel / mobile ordering / online store | Explicitly out of scope |
| Credit Sale / Credit Notes as tender | Adds ledger semantics; cash/UPI/card only |
| Full Reports Center | A farmer needs "how much did I take today", not 50 pivots |
| Customer marketing/CRM (mails, statements, comments, addresses) | Brief: no customer marketplace/social. Phone + points only |

### Unresolved product decisions (see also §13)

1. **Rewards math & funding.** Earn rate, rounding, expiry, whether points are
   per-org or platform-wide, redemption rules. Brief says "no unrestricted
   offline redemption" and "points may show as pending until sync" — but the
   earn formula and who bears the cost are not specified. *Needs product input.*
2. **Buyer identity for lookup.** Phone + OTP? Phone + receipt number? Bare phone
   (privacy risk — anyone can enumerate)? Brief says "verify identity if
   necessary". *Needs a decision before the buyer lookup is built.*
3. **Offline catalogue freshness window.** How stale may cached prices/stock be
   before the app refuses new offline sales (e.g. 24 h / 72 h)?
4. **Returns offline.** Allowed offline at all, or online-only? (Refund cash from
   a drawer that may not reconcile.)
5. **Telugu scope.** Brief says "Telugu support for checkout-critical actions" —
   confirm the exact string set (proposal in §10) and get a human translation
   review; current strings are unreviewed.
6. **Multi-cashier on one device offline.** If two cashiers share a tablet and it
   is offline, are sales attributed to the logged-in user only?

---

## 4. Simplified information architecture

```
KOMOLA POS
│
├─ Sell                     ← default after opening a register
│   ├─ Search / scan
│   ├─ Quantity keypad (weighed goods)
│   ├─ Cart  (held carts live here)
│   ├─ Payment  (Cash / UPI / Card)
│   └─ Receipt  (print · share · new sale)
│
├─ Sales
│   ├─ Sales history (list, filter: today / 7d / range, search phone/receipt)
│   ├─ Sale detail  (receipt + payments + void/return)
│   └─ Offline queue  (pending / syncing / needs review)   ← badge = pending count
│
├─ Products
│   ├─ Product list  (search, chip: All / Low stock / Unverified)
│   └─ Add / edit product  (Basic  +  Advanced details)
│
├─ Stock
│   ├─ Stock overview  ("Available stock" per product, low-stock first)
│   ├─ Add stock  (batch/harvest + quantity + expiry)
│   └─ Reduce stock  (quantity + reason)
│
├─ Register
│   ├─ Open register  (choose register + opening cash)
│   ├─ (session running: totals)
│   └─ Close register  (count cash + variance note + summary)
│
└─ More
    ├─ Sync conflicts        (supervisor)
    ├─ Language              (English / తెలుగు)
    ├─ Today summary
    ├─ Team & profile        (deferred – link only)
    └─ Sign out

Buyer (public, unauthenticated, separate route group `app/(buyer)/`)
├─ /r/[token]           Receipt / invoice view  (from QR or short URL)
├─ /invoice             Invoice lookup   (phone or receipt QR)
└─ /rewards             Rewards lookup + summary + recent history
```

Rationale: the five seller tabs map 1:1 to what a stall does — *sell, look back
at sales, keep the product list right, keep stock right, manage the cash
drawer*. Everything administrative or rare is one level down in **More**. The
**Offline queue** lives under Sales (not hidden in More) because its pending
count is safety-critical information the seller must see; the tab shows a badge.

---

## 5. Primary user flows

### 5.1 Normal sale (target: ≤ 30 s, ≤ 8 taps, 0–1 typed fields)

```
Open Sell (already there after opening register)
 └─ Scan barcode                         [0 taps – scanner keystrokes]
     or tap a pinned product tile        [1 tap]
     or type 2–3 letters → tap result    [~4 keys + 1 tap]
 └─ (weighed goods) keypad: 1 . 7 5 → Add [5 taps]      (piece goods skip this)
 └─ repeat for each product
 └─ [optional] tap "Add phone" → type 10 digits         (skipped for walk-ins)
 └─ tap  Cash   (or UPI / Card)          [1 tap]
 └─ (cash) tap a quick-tender chip ₹200 / ₹500 or type; change shown big
 └─ tap  Complete sale                   [1 tap]
 └─ Receipt: Print · Share · New sale
```

### 5.2 First-time farmer creates a product

```
Products → Add product
 └─ Name:            "Tomatoes"
 └─ Sell by:         [kg] [g] [litre] [piece] [bunch] [pack]   (segmented, kg default)
 └─ Price:           ₹ 40   ("per kg" shown from the unit above)
 └─ Available now:   30      (creates the first batch; expiry optional)
 └─ [Add photo]  [Add barcode]                    (optional, camera/scanner)
 └─ Organic:  [Certified] [In-conversion] [Not organic]   (only if org requires it)
 └─ Save        →  toast "Tomatoes added · 30 kg in stock"
Advanced details ▸ (collapsed):  SKU (auto), tax %, cost price, HSN, per-location price
```

### 5.3 Sale completed with no internet

```
Sell … Complete sale
 └─ POST fails / offline detected
 └─ Sale written to IndexedDB with stable saleId + idempotencyKey
 └─ Full-width banner (not a toast):
    "✅ Sale saved on this device (₹185). It will send when internet returns."
 └─ Receipt shows a PROVISIONAL badge: "Receipt number pending" + local ref
 └─ Sell screen header chip: "Offline · 1 waiting"   → tap → Offline queue
```

### 5.4 Device restarts before sync, then reconnects

```
App reopens → PosSyncProvider hydrates the IndexedDB queue on boot
 └─ header chip: "Offline · 3 waiting"  (survived restart)
 └─ connectivity returns → auto-sync starts (also a manual "Sync now")
 └─ each sale replays with its original Idempotency-Key
     ├─ 201 → mark synced, store server receipt number, drop from queue
     ├─ 200 reused → already synced elsewhere: "This sale was already saved.
     │               No duplicate was created." → mark synced
     └─ 409 / 422 (stock, price, closed shift) → move to Needs review, keep local copy
 └─ chip → "All sales synced ✓" for 5 s, then hides
```

### 5.5 Seller resolves a sync warning

```
Sales → Offline queue → Needs review (1)
 └─ Card: "Tomatoes 2 kg — only 1.5 kg was in the batch when this synced."
    Options:  [Adjust to 1.5 kg & resend]   [Void this sale]   [Keep for supervisor]
 └─ choosing an option replays or voids; card clears; audit event recorded
```

### 5.6 Buyer gets & reopens an invoice

```
At counter: receipt prints/shows QR + short URL  komola.in/r/AB12CD
 └─ Buyer scans QR  →  /r/AB12CD  (public, read-only)
     store name · location · receipt# · date · lines (name/qty/unit/amount) ·
     discount · tax · total · payment method + status · points earned (pending/confirmed)
 └─ Later: /invoice → enter phone or scan the QR → list of their receipts → open one
```

### 5.7 Buyer checks points

```
/rewards → enter phone → (OTP if configured) →
   Available: 120   ·   Pending (awaiting sync/confirmation): 15
   Recent:  +8  Tomatoes sale  2026-09-06   ·   −50  Redeemed  2026-09-01
```

---

## 6. Screen-level design specifications

Notation: **P** = phone (≤640), **T** = tablet (641–1024), **D** = desktop
(≥1025). Touch target ≥ **48×48** everywhere in Sell; ≥ 44 elsewhere. Body text
≥ 16px; amounts and quantities ≥ 20px; the final total and the Complete-sale
button ≥ 24px.

### 6.1 App shell / navigation

- **P:** fixed **bottom tab bar**, 5 items (Sell, Sales, Products, Stock,
  Register) each icon + label; **More** is the 5th slot's long-press / a 6th
  compact item. `Sales` shows a numeric **badge = offline pending count**.
- **T/D:** left rail (icons + labels), same order, More at the bottom above the
  user block.
- **Connectivity chip** in the header on every screen:
  `● Online` (green) · `● Offline · N waiting` (amber) · `↻ Syncing…` ·
  `✓ Synced` (transient). Text + icon + shape, never colour alone. Tapping it
  opens the Offline queue.
- Header also: store/location name, current user, language toggle in More.
- Skip-to-content link; `<main>` landmark; nav is a labelled `<nav>`.

### 6.2 Sign in  (`app/(auth)/login`)

Mostly keep. Changes: bigger inputs (h-48), show Google prominently, WhatsApp
button visibly "Coming soon" (already), plain-language errors ("We couldn't sign
you in. Check your email and password."), Telugu strings, `autocomplete`
attributes, `inputmode="email"`. Offline: if unreachable, "You're offline. Sign
in needs internet the first time." (a previously-signed-in session works offline
from cache).

### 6.3 Initial seller setup  (`app/seller/onboarding`)

Three short steps, one card, progress dots:
1. **Your stall** — display name, seller type (Farmer / FPO / Retailer / Brand as
   segmented control), phone.
2. **Where you sell** — location name, (city prefilled Visakhapatnam), timezone
   hidden default.
3. **Done** — "We're setting up your shop…" → lands on **Open register**.
Everything else (GST, legal name, billing address) → optional "Business details"
accordion. Generates org + owner + location + register server-side (already the
backend behaviour).

### 6.4 Open register  (`Register`)

- One screen. If a register exists for the location: a single big card —
  "Opening cash in drawer" numeric keypad (₹), **Open register** button.
- If several registers: a segmented list above.
- Empty: "No register yet — ask the shop owner to add one."
- After open → auto-navigate to **Sell**.
- Offline: allowed if a register + last session summary are cached; opening cash
  recorded locally, session queued.

### 6.5 Sell  (`app/(seller)/pos` → conceptually `/sell`)  — the core screen

**Layout**
- **P:** vertical. Sticky top: search field + scan button + connectivity chip.
  Then a horizontally-scrolling row of **pinned/common product tiles** (72px
  tall, name + price/unit). Then, when the cart is non-empty, a **sticky bottom
  Cart bar**: "3 items · ₹185" + **Pay ₹185** (full-width, ≥56px). Tapping it
  expands the cart sheet upward (bottom sheet, 90% height) with lines + totals +
  Pay.
- **T/D:** two panes — left search+tiles (grid, 96–120px tiles), right cart
  (sticky, always visible), Pay button pinned to the cart's bottom.

**Product tile**: name (2 lines max), price + unit, a small "organic ✓" or
"not verified" chip (text, not glyph-only), low-stock ribbon ("Low: 2 kg") when
`available ≤ threshold`. Tap = add (piece goods) or open the quantity keypad
(weighed goods).

**Quantity keypad** (weighed goods, and editable per line): big 0–9 . ⌫ keys
(≥64px), a live "= ₹70.00" preview, unit shown ("kg"), quick chips
(¼ ½ 1 2 5), **Add to cart**. Also reachable from a cart line's quantity.

**Scanning**:
- A `useScannerInput()` hook buffers rapid keydown sequences ending in Enter
  (typical HID scanner) anywhere on the screen and resolves via
  `productsApi.lookup({ barcode })`.
- The **Scan** button: on P opens the camera scanner (`BarcodeDetector` where
  available, else a bundled WASM fallback — CDN rules: bundle it); on T/D just
  focuses/parses.
- **Weight-embedded barcodes**: if the code matches the configured EAN-13
  weight/price pattern (prefix `20–29` typical), parse embedded grams or price
  and pre-fill the line quantity; show "from scale label".
- Unknown code → "No product for this barcode. [Add it]".

**Cart line**: name; quantity (tap → keypad) with unit; line total (right,
bold); swipe-left or a trash icon to remove; repeated adds **increment** the
line. Organic status snapshot shown small.

**Held carts**: "Hold" on the cart bar; "Resume" shows held carts as chips at the
top of Sell (label = item count + total + time). Stored in **IndexedDB**
(`heldCarts` store), not localStorage. Migrate the two current localStorage keys
on first run.

**Payment panel** (bottom sheet step 2):
- Three big buttons: **Cash · UPI · Card** (≥64px, icon + word).
- Cash → quick-tender chips (exact, ₹100, ₹200, ₹500, ₹2000) + keypad; **Change
  due ₹__** shown very large.
- UPI / Card → optional "Reference (last 4 / txn id)" field; a line
  "Confirm you received the payment" checkbox → enables Complete.
- "Add customer phone" is a single collapsed link above the buttons; expands to a
  10-digit `inputmode="numeric"` field + a separate "send marketing messages"
  checkbox (unchecked).
- **Complete sale ₹__** — full width, ≥56px, shows a spinner and disables on tap;
  idempotency key fixed for this attempt.

**States**
- *Loading*: skeleton tiles + skeleton cart.
- *No open register*: full-screen "Open a register to start selling" + button.
- *Empty cart*: "Scan or tap a product to start" (Telugu).
- *Offline*: connectivity chip amber; Complete still works → local save + banner
  (§5.3); receipt provisional.
- *Error (online, business)*: inline, specific — "Only 3 kg of Tomatoes left in
  this batch. Reduce the quantity or pick another batch." Never a raw message.
- *Success*: receipt (see 6.6) with Print / Share / **New sale** (autofocus).

### 6.6 Receipt (seller side + the printed/shared artifact)  (`ReceiptView`)

Content (superset of current):
- KOMOLA wordmark; **stall / seller name**; **location**; receipt number (or
  "Provisional — number pending" + local ref); date & time.
- Lines: name · qty + unit · unit price · amount; organic mark per line (word).
- Discounts; tax (labelled "Tax incl."); **Total** (large).
- Payment method + **verification status** ("Cash received" / "UPI – confirmed by
  cashier" / "Card – confirmed"); for offline "Payment recorded — online check
  pending".
- Customer phone (only if given).
- **Reward points earned** + status ("15 points — will confirm when synced" /
  "confirmed").
- **QR code** (to `komola.in/r/<token>`) + the short URL in text.
- Footer: "Thank you" (Telugu too).

Actions: **Print** (`window.print()` + a real thermal-friendly `@media print`
stylesheet, 58mm & 80mm), **Download PDF** (client-side render; must not use a
blocked CDN — bundle the generator), **Share on WhatsApp** (`https://wa.me/?text=`
with the short URL; only when online), **Reopen** (from Sales history).
An offline/provisional receipt is clearly watermarked and says which fields are
pending.

### 6.7 Sales history + Sale detail  (`app/(seller)/pos/history`)

- List: receipt#, time, total, payment icon, **sync badge**. Filter chips:
  *Today · 7 days · Pick dates*. Search: phone or receipt number.
- Row tap → Sale detail: the receipt + payments + **Void** (supervisor, reason
  required) + **Return** (→ 6.8). Void/return disabled while the sale is still
  `pending`/`needs review`.
- Empty: "No sales yet today."

### 6.8 Return against a receipt

One screen: open a receipt → each line with a quantity stepper capped at "sold −
already returned" → choose **Refund cash now** (requires the original shift open)
or **Adjust later (manual)** → confirm. Shows "Stock will be added back to the
batch." Restock + compensating movement handled server-side
(`POST /pos/sales/{id}/returns`).

### 6.9 Offline queue  (`/sales/offline` — new)

- Three sections: **Waiting (N)**, **Syncing**, **Needs review (N)**.
- Each item: time, item summary, total, local ref, status line.
- Top: **Sync now** button + "Last synced 2 min ago".
- Waiting item → tap → read-only local receipt.
- Needs-review item → resolution card (§5.5): *Adjust & resend* / *Void* /
  *Keep for supervisor*.
- Empty: "All sales are synced." with a calm illustration (mirrors Zoho's
  Conflicts empty state).

### 6.10 Sync conflicts  (More → supervisor)

A filtered view of **Needs review** across all devices/users for the store, for
Owner/Manager. Columns: when, cashier, receipt/local ref, reason
(stock / price / closed shift / duplicate), amount, action. Bulk "resend all
fixable". This is the KOMOLA analogue of Zoho's Conflicts screen.

### 6.11 Products list + Add/Edit product

- List: search; chips *All · Low stock · Unverified organic*; each row: name,
  price/unit, **available stock**, organic chip. `+ Add product` (P: FAB).
- **Add/Edit — Basic** (see §5.2): name, sell-by (segmented), price, available
  now (Add only; creates first batch), photo, barcode, organic (conditional).
- **Advanced details** (accordion, collapsed): SKU (auto, editable), tax %, HSN,
  cost price, per-location price, "track expiry", certificate link. Safe defaults
  filled; a farmer never opens this.
- Save → toast with the human result ("Tomatoes added · 30 kg in stock").
- Needs a new backend field or a follow-up call for "available now" +
  photo (see §11 / §13).

### 6.12 Stock overview / Add stock / Reduce stock

- **Overview**: list sorted low-stock-first; row = product, **Available stock**
  (big), oldest batch expiry ("Expires 12 Sep"), `Add` / `Reduce` buttons.
  Language: "Available stock", never "balance".
- **Add stock**: product (prefilled if entered from a row), **Batch / harvest
  name** (optional, default "Batch <date>"), **Quantity** + unit keypad,
  **Expiry date** (optional). "This adds to available stock."
- **Reduce stock**: product, **Quantity**, **Reason**: Damaged · Spoiled · Own
  use · Correction. "This removes from available stock."
- Both are 2–3 field forms. Backend: needs the receiving/adjustment endpoints
  which are **not implemented today** (§11 phase 5, §13 risk).

### 6.13 Register close summary

On close: counted-cash keypad → **Summary card**: opening float, cash sales, UPI
sales, card sales, refunds, **expected cash**, **counted**, **difference**
(word + amount, e.g. "Short by ₹20" / "Over by ₹5" / "Matches"), variance note
(required past threshold), sale count. **Print / share** the summary. Then
"Register closed" → Dashboard.

### 6.14 Buyer screens  (`app/(buyer)/`, public)

- `/r/[token]` — the receipt (6.6 content), read-only, no chrome, big type,
  "Powered by KOMOLA", language toggle. Works on the cheapest phone browser.
- `/invoice` — "Find your receipt": phone `inputmode=numeric` **or** "Scan
  receipt QR"; (optional OTP per §13-2); list newest-first; open → `/r/[token]`.
- `/rewards` — phone (+ OTP) → **Available** (large) · **Pending** · **Recent
  history** (earn/redeem rows with date + reason). No other account surface.
- `/rewards/summary` — same data, shareable link from a receipt.

All buyer screens: no login, no install prompt, minimal JS, English + Telugu,
offline shows "Connect to the internet to look this up."

---

## 7. Responsive behaviour

| Zone | Phone (≤640) | Tablet (641–1024) | Desktop (≥1025) |
|---|---|---|---|
| Nav | Bottom tab bar (5) + More | Left rail collapsed to icons; labels on hover/expand | Left rail, icons + labels |
| Sell | Single column; tiles horizontal scroll; cart = sticky bottom bar → bottom sheet; payment = bottom sheet | Two columns 60/40; cart visible; payment inline in cart pane | Two columns; wider tile grid (4–6 cols); keypad as popover |
| Keypad | Full-width bottom sheet, 64px keys | Centered modal, 64px keys | Popover near the field, 56px keys |
| Lists (Sales/Products/Stock) | Cards, one per row, key number large | 2-col cards or dense table | Table with columns |
| Forms | One field per row, sticky action bar at bottom | One field per row, centered ≤560px | Two-up where fields are short |
| Receipt | Full width ≤ 380px centered | Centered card | Centered card; print = 58/80mm |
| Buyer | Single column, 16px+; QR ~180px | Centered ≤ 480px | Centered ≤ 560px |

Rules: relative units; `flex`/`grid`; images `max-width:100%`; **the page body
never scrolls horizontally** — wide tables/receipts scroll inside their own
`overflow-x:auto`. Respect `prefers-reduced-motion` (bottom sheets fade instead
of slide). Tap targets scale up, never down, on smaller screens.

---

## 8. Offline-first specification

### 8.1 Storage (IndexedDB, via a tiny wrapper — bundled, no CDN)

DB `komola-pos`, stores:

| Store | Key | Contents | Eviction |
|---|---|---|---|
| `catalogue` | `skuId` | product + price + tax + available snapshot, `cachedAt` | replaced on each successful refresh |
| `catalogueMeta` | `"meta"` | `{ orgId, locationId, refreshedAt, priceListVersion }` | — |
| `heldCarts` | `id` | held cart lines | manual (resume/discard); cap 20 |
| `outbox` | `saleId` (client UUID) | `{ idempotencyKey, body, createdAt, attempts, lastError, status }` where status ∈ `pending·syncing·synced·needs_review` | **only after server ack**; `synced` rows pruned after 7 days |
| `receipts` | `saleId` | last-known receipt JSON (local + server-confirmed) for reopen/offline view | LRU, cap 500 |
| `registerState` | `"current"` | open session summary + opening cash + queued open/close ops | on confirmed close |
| `rewardsCache` | `phone` | last seen points (read-only display) | 24 h TTL, display-only |

Never store auth tokens in IndexedDB (Supabase SSR cookie handles session).

### 8.2 Sync state machine (the one lifecycle we teach)

```
        create sale
            │
            ▼
     ┌─────────────┐  online + POST 201        ┌────────┐
     │  pending    │ ─────────────────────────▶│ synced │
     │ (on device) │  online + POST 200 reused └────────┘
     └─────────────┘ ──────────────────────────────▲
        │   ▲   │  connectivity/manual                │ resolved
 offline│   │   │  ▼                                   │
        │   │ ┌──────────┐  409/422 business error ┌───────────────┐
        │   └─│ syncing  │────────────────────────▶│ needs_review  │
        └────▶└──────────┘  network error → back to │  (keep local) │
                             pending (backoff)      └───────────────┘
```

Seller-facing words: **Saved on device → Waiting → Syncing → Synced**, plus
**Needs review**. No other status vocabulary anywhere.

### 8.3 Rules (from the brief, made concrete)

- A completed sale is written to `outbox` **before** any network attempt; the UI
  shows success from the local write.
- **Never delete a local sale before a server ack** (201 or 200-reused).
- Every replay uses the **original `Idempotency-Key`** → retries can't duplicate.
  A 200-reused response is a success, shown as "already saved, no duplicate".
- Auto-sync triggers: `online` event, app foreground, a 60 s timer while pending
  > 0, and a manual **Sync now**. Exponential backoff per item (5s→5min cap).
- **Do not rely solely on Background Sync API** — it's a bonus trigger only; the
  in-app queue + timers are the source of truth.
- Business rejections (stock/price/closed shift) → `needs_review`, local copy
  kept, surfaced in Offline queue and Sync conflicts.
- **Offline guard rails:** refuse to start a *new* offline sale if the catalogue
  cache is older than the configured window (§13-3) or missing → "Connect to the
  internet once to load today's prices." Oversell offline is *possible* (no lock)
  — it's caught at sync and sent to Needs review; the cart shows a soft warning
  when local available would go negative.
- Register **open/close** offline: queued as ops in `registerState`; close
  summary marked provisional until the server confirms.
- **Rewards:** earning shown as **pending** offline; **no offline redemption**
  beyond a cached-balance *display*; the sale ID is the idempotency reference for
  the points award so a replay can't double-credit.
- Clock: store both device time and, on sync, trust the server's `soldAt`;
  receipts show device time with "(device time)" until confirmed.

### 8.4 Service worker

- Precache the app shell + fonts + icons + the WASM barcode fallback.
- Runtime cache: `GET /api/v1/pos/catalogue/*` and `/pos/registers` with
  stale-while-revalidate; **never** cache mutating requests or auth.
- `POST /pos/sales` is **not** intercepted by the SW — the app-level outbox owns
  it (clearer errors, survives SW updates).
- SW update → toast "Update ready — reload".

### 8.5 Empty / loading / error / conflict — every screen

| Screen | Empty | Loading | Error | Conflict |
|---|---|---|---|---|
| Sell | "Scan or tap a product" | skeleton tiles+cart | inline, specific, keeps cart | n/a (goes to queue) |
| Offline queue | "All sales are synced." | spinner + last-synced | per-item error line | Needs-review cards |
| Sales history | "No sales yet today." | skeleton rows | "Couldn't load — showing device copies." | badge on rows |
| Products/Stock | "No products yet — add your first." | skeleton rows | retry banner | n/a |
| Register | "No register yet…" | skeleton card | retry | provisional close banner |
| Buyer lookup | "Enter your phone to find receipts." | spinner | "Nothing found for that number." | "Connect to the internet to check." |

---

## 9. Buyer receipt & rewards experience (summary)

Covered in 6.6 and 6.14. Key points:

- The **printed/shared receipt is the buyer product** for this phase — it carries
  the QR + short URL that unlock `/r/[token]`, `/invoice`, `/rewards`.
- Provisional (offline) receipts are unmistakably labelled; the final number and
  payment confirmation appear after sync — the same `/r/[token]` URL updates.
- Rewards are **display + earn-pending** only offline; redemption is online and
  rule-bound (rules TBD, §13-1). Idempotency reference = sale ID.
- Buyer screens are public, minimal, bilingual, and never expose account,
  marketplace, or marketing surfaces.
- New backend surface required (§11 phase 6): a public receipt-by-token endpoint,
  a phone→receipts lookup (guarded per §13-2), and read-only rewards
  balance/history. `pos.customers` + `loyalty.*` tables already exist.

---

## 10. Accessibility & localization notes

**Targets & layout**
- Sell interactions ≥ 48×48 px; everything else ≥ 44. Spacing ≥ 8px between
  targets. The Complete-sale button and the final total ≥ 24px text.
- Minimum body 16px; never rely on `line-clamp` to hide essential text.
- Minimal scrolling in checkout: cart total + Pay always reachable without
  scrolling (sticky bar / fixed pane).

**Contrast & non-colour cues**
- All text ≥ 4.5:1 (≥ 3:1 for ≥ 24px). Status is always **icon + shape + word**,
  never colour alone: sync chip has a dot *and* text; variance says "Short by
  ₹20" not just red; organic says "Organic ✓ verified" / "Not verified".
- Focus ring visible on every interactive element (2px, token colour), including
  in the bottom sheets.

**Input & hardware**
- `inputmode` correct everywhere (`numeric` for money/phone/quantity,
  `email`/`tel` on auth).
- Full keyboard operability; hardware barcode scanners work without focusing a
  field (global keystroke buffer); Enter submits the obvious action; Esc closes
  sheets.
- The camera scanner has a manual-entry fallback.

**Screen reader**
- Landmarks (`header`/`nav`/`main`), one `h1` per screen, labelled controls.
- A polite `aria-live` region announces cart changes ("Tomatoes, 2 kilograms,
  eighty rupees") and the running total, and the sync chip's state changes.
- Icon-only buttons have `aria-label` (audit: several already do; make it
  universal). Receipts read in a sensible order; the QR has alt text with the
  short URL.
- `prefers-reduced-motion`: no slide/parallax; fades only.

**Localization (English + తెలుగు)**
- Extend `shared/lib/i18n.ts` to cover, at minimum, this **checkout-critical
  set** in Telugu (get a human review — current strings are unreviewed):
  - Sell: search/scan, "Add", quantity, unit names (kg/gram/litre/ml/piece/
    bunch/pack), "Cart", line/total labels, "Hold"/"Resume".
  - Payment: "Cash"/"UPI"/"Card", "Amount received", "Change due",
    "Confirm you received the payment", "Add customer phone", "Complete sale".
  - Result: "Sale complete", "Saved on this device — will send when internet
    returns", "Print", "Share", "New sale", provisional-receipt notice.
  - Sync chip: "Online", "Offline — N waiting", "Syncing", "All sales synced",
    "Needs review".
  - Register: "Opening cash", "Open register", "Count cash", "Close register",
    "Short by / Over by / Matches".
  - Errors: "Only N <unit> left in this batch", "This sale was already saved —
    no duplicate", "You're offline".
- Numbers: Indian digit grouping (₹1,20,000); dates `DD MMM YYYY`; 24h or
  localized time; unit words localized, unit *symbols* (kg) kept.
- Never concatenate translated fragments; use whole templated strings with
  named slots. No unexplained abbreviations ("SKU", "FEFO", "HSN" never shown to
  a seller; "Qty" → "Quantity").
- The language toggle is in **More** and on `/sell`; choice persisted
  (localStorage, per §"browser storage" it's a per-viewer convenience).

---

## 11. Implementation plan (phased, for sign-off)

Each phase is independently shippable, keeps the build green
(`npm run build`, `npm run typecheck`, `npm run lint`, `npm test`;
backend `go build/vet/test`), and touches only `komola-pos` unless noted.
**No code is written until the phasing is approved.**

> Dependency note: Phases 5b and 6 need **new `go-api-backend` endpoints**
> (stock in/out; public receipt + rewards). Those are backend work with their own
> migration + OpenAPI + tests and should be split out or scheduled with backend
> owners. Everything else is frontend-only against today's contract.

### Phase 0 — Foundations (no visible feature change)
- IA + routing: rename route group intent to `/sell`, add `app/(buyer)/` group,
  add `/sales/offline`, `/stock/*`, `More`.
- New shell: bottom tab bar (P) / rail (T/D), 5 tabs + More, **connectivity
  chip** component (`useOnline()` + queue count).
- `shared/lib/i18n.ts`: expand key set; add the checkout-critical Telugu strings
  (flagged for human review); tiny `<Trans>` helper.
- Design-token / a11y pass: focus rings, 48px targets in Sell, `aria-live`
  scaffold.
- Tests: shell renders, tab order, chip states; i18n key coverage test.

### Phase 1 — Sell screen redesign (online only)
- Mobile-first layout: sticky search+scan, horizontal pinned tiles, sticky cart
  bar → bottom sheet, payment bottom sheet.
- **Quantity keypad** component; "enter qty before add" for weighed goods;
  repeated-add increments line.
- `useScannerInput()` global HID buffer; camera scan on P (bundled
  `BarcodeDetector` polyfill); **weight-embedded barcode** parser
  (`shared/lib/barcode.ts`, pure, unit-tested).
- Payment: **Cash / UPI / Card** (drop "split" to an "add another payment" link),
  quick-tender chips, big change-due, "confirm received" for UPI/Card.
- Specific inline error mapping (stock/price/shift) — no raw messages.
- Held carts → IndexedDB (Phase 3 store; interim: keep localStorage but single
  key + migration shim).
- Tests: keypad math, barcode parser, add/increment/remove reducer, payment
  validation, error-mapping.

### Phase 2 — Receipts & buyer receipt view (online)
- `ReceiptView` v2: seller/stall name, location, verification status wording,
  points-earned line, **QR + short URL**, provisional watermark slot.
- Real thermal `@media print` (58/80mm); **Download PDF** (bundled generator);
  **Share on WhatsApp** (`wa.me`).
- `app/(buyer)/r/[token]/page.tsx` reading a public receipt endpoint
  (**needs backend**, Phase 6 — until then, render from a signed client token or
  the authenticated `GET /pos/sales/{id}` for staff preview).
- Tests: receipt renders all fields, provisional state, print stylesheet
  snapshot.

### Phase 3 — Offline core
- IndexedDB wrapper + stores (§8.1); `PosSyncProvider` (context) hydrating
  `outbox` + `registerState` on boot.
- Rewrite `salesApi.create` path: write `outbox` first → attempt → reconcile;
  `useCompleteSale()` returns immediately with a local receipt.
- Sync engine: triggers (online/foreground/timer/manual), per-item backoff,
  201/200/409/422 handling, `needs_review` transitions.
- **Offline queue** screen (`/sales/offline`) with Waiting/Syncing/Needs review +
  **Sync now**.
- Connectivity chip wired to real queue counts; Sales tab badge.
- Catalogue caching + freshness guard; held carts fully on IndexedDB (+ migrate
  old keys).
- Service worker: precache shell, SWR for catalogue GETs, update toast; **not**
  intercepting `POST /sales`.
- Tests (Vitest + fake-indexeddb): enqueue→sync→prune; retry is idempotent
  (same key → no dup); restart rehydration; 200-reused path; needs-review path;
  freshness guard blocks stale offline sale.

### Phase 4 — Sync conflicts, returns, register polish
- **Sync conflicts** screen (supervisor) over `needs_review` across the store;
  bulk resend.
- Return-against-receipt screen → `POST /pos/sales/{id}/returns`; void reason
  flow polish.
- Register: open/close as offline-queueable ops; **close summary** card + print;
  "Short/Over/Matches" wording.
- Tests: return quantity caps, refund-settlement choice, close-summary math,
  conflict resolution actions.

### Phase 5 — Products & Stock
- **5a (frontend):** Add/Edit product with **Basic + Advanced details**; product
  list chips; Stock **overview** (read model exists).
- **5b (backend + frontend):** "Add stock" / "Reduce stock" — **requires new Go
  endpoints** (`POST /pos/inventory/receipts`, `POST /pos/inventory/adjustments`
  or similar) with migration, OpenAPI, `_map.ts`, tests. Until 5b lands, Stock
  overview is read-only with a clear "Add stock — coming soon" and stock is set
  via "Available now" at product creation only if the backend supports it
  (else deferred — see §13-7).
- Tests: basic/advanced form validation, default generation (SKU/tax), stock
  forms, mappers.

### Phase 6 — Buyer lookup & rewards  (**backend-heavy**)
- New Go endpoints (public, rate-limited, per §13-2 identity decision):
  - `GET /api/v1/public/receipts/{token}` — receipt snapshot by opaque token.
  - `POST /api/v1/public/invoice-lookup` — phone (+OTP) → receipt list.
  - `GET /api/v1/public/rewards?phone=…` (+OTP) — balance + pending + history.
  - Rewards **earn** wired into `checkout.Service.Create` (idempotent on sale ID)
    once the earn rule (§13-1) is decided.
- Frontend: `/invoice`, `/rewards`, `/rewards/summary`; receipt QR points here.
- Tests: token privacy (no enumeration), OTP gate, rewards idempotency, offline
  "connect to look up" copy.

### Phase 7 — Validation & hardening
- Run the brief's 10 task tests (§12) with representative data; record metrics.
- Full a11y pass (axe + manual SR); Telugu human review sign-off.
- Lighthouse PWA/installable/offline; low-end device check (throttled).
- Update `cross-platform-assets/project-context.md` and this doc's status.

### Files expected to change (indicative, per phase — not exhaustive)

- **P0:** `shared/components/SellerShell.tsx` (rewrite), new
  `shared/components/shell/{BottomTabs,ConnectivityChip}.tsx`,
  `shared/lib/i18n.ts`, `shared/lib/hooks/useOnline.ts`, `app/(seller)/layout.tsx`,
  route renames, `app/(buyer)/layout.tsx`.
- **P1:** `app/(seller)/pos/page.tsx` (rewrite into components),
  `shared/components/pos/{ProductTile,QuantityKeypad,CartSheet,PaymentSheet}.tsx`,
  `shared/lib/barcode.ts`, `shared/lib/hooks/useScannerInput.ts`,
  `shared/components/pos/types.ts`.
- **P2:** `shared/components/pos/ReceiptView.tsx`, `app/globals.css` (print),
  `shared/lib/receipt/{pdf,share}.ts`, `app/(buyer)/r/[token]/page.tsx`.
- **P3:** `shared/lib/offline/{db,outbox,syncEngine,catalogueCache}.ts`,
  `shared/context/PosSyncProvider.tsx`, `shared/lib/api/sales.ts` (queue path),
  `app/(seller)/sales/offline/page.tsx`, `public/sw.js` +
  `app/register-sw.ts`, `next.config.ts`.
- **P4:** `app/(seller)/sales/conflicts/page.tsx`,
  `app/(seller)/pos/history/[id]/return/page.tsx`,
  `app/(seller)/register-sessions/page.tsx`.
- **P5:** `app/(seller)/products/new/page.tsx` + `[id]`, `app/(seller)/stock/*`,
  `shared/lib/api/inventory.ts`; **backend:** `go-api-backend/internal/modules/
  checkout/*` + `db/migrations/000006_*.sql` + `openapi/openapi.yaml`.
- **P6:** `app/(buyer)/{invoice,rewards}/*`; **backend:** new `public`/`loyalty`
  module, migration, OpenAPI, `checkout.Service.Create` hook.

---

## 12. Tests & verification results

**Not yet run** — no implementation. The plan's per-phase tests are listed in
§11. The brief's acceptance battery, to be executed in Phase 7 with metrics
recorded here:

| # | Task | Pass criteria | Metric captured |
|---|---|---|---|
| 1 | First-time farmer creates a product | Completes Basic form only, no help | time, typed fields, taps |
| 2 | Farmer sells a weighed product | Uses keypad, correct line total | taps, entry errors |
| 3 | Cashier scans several products | Scanner adds without field focus; repeats group | scan→cart latency, taps |
| 4 | Sale completed with no internet | Local save, provisional receipt, banner | success shown offline? |
| 5 | Device restarts before sync | Queue survives; count correct on boot | queue integrity |
| 6 | Sale syncs without duplication | 201 or 200-reused; exactly one server sale | dup count (must be 0) |
| 7 | Buyer receives & reopens an invoice | QR → `/r/token`; `/invoice` finds it | lookup success rate |
| 8 | Buyer checks pending & confirmed points | Both shown, history correct | comprehension |
| 9 | Seller resolves a sync warning | Adjust/void/keep works; conflict clears | resolution success |
| 10 | Normal sale, minimal typing | ≤ 8 taps, 0–1 typed fields, ≤ 30 s | taps, time, typed fields, unaided success |

Targets (proposed): normal sale **≤ 30 s / ≤ 8 taps / ≤ 1 typed field**;
unaided checkout success **≥ 95%**; offline recovery success **100%** (no lost or
duplicated sales); seller can correctly state their sync status when asked
**≥ 90%**.

---

## 13. Remaining risks & unresolved product decisions

1. **Rewards rules & funding unspecified** (earn rate, rounding, expiry,
   per-org vs platform, redemption constraints). Blocks Phase 6 rewards-earn.
   *Owner: product.*
2. **Buyer lookup identity model** — bare phone enables enumeration/scraping of
   receipts and points. Recommend phone + OTP (SMS) or phone + a receipt number
   as proof. Blocks `/invoice` and `/rewards`. *Owner: product + security.*
3. **Offline catalogue freshness window** not defined — pick a max age after
   which new offline sales are blocked (recommend 72 h). *Owner: product.*
4. **Returns offline** — allow or online-only? Cash refunds from an
   unreconciled drawer are risky; recommend **online-only returns** in this
   phase. *Owner: product.*
5. **Stock in/out has no backend** — `receiving`/`adjustment` APIs are not
   implemented (`cross-platform-assets/project-context.md`). Phase 5b is blocked
   on a backend migration + endpoints; without it, "Available now" at product
   creation may also be unsupported. *Owner: backend.*
6. **Oversell while offline** is possible (no lock offline). Mitigation: soft
   cart warning + catch-at-sync → Needs review. Accept, or forbid offline sales
   of low-stock items? *Owner: product.*
7. **Telugu quality** — current `i18n.ts` strings are unreviewed machine-style
   Telugu. Needs a native reviewer before Phase 7. *Owner: product/ops.*
8. **Thermal printing from the browser** is unreliable across devices; PDF +
   share is the dependable path. USB/Bluetooth printer support may need a native
   wrapper later. *Owner: eng, accept for now.*
9. **Camera barcode scanning** — `BarcodeDetector` is not on all target
   browsers; the WASM fallback must be bundled (CSP blocks arbitrary CDNs) and
   adds ~200–500 KB. *Owner: eng.*
10. **Multi-cashier offline attribution** (§3-unresolved-6) — confirm sales are
    tied to the signed-in user only and a shift can't span two cashiers offline.
    *Owner: product.*
11. **Two held-cart storage keys** exist today — migrate both on first run to
    avoid silently dropping a held cart at upgrade. *Owner: eng, Phase 3.*
12. **`start_url: "/pos"`** in `manifest.ts` — update to `/sell` (or keep `/pos`
    as a redirect) so installed-app launch lands on the right screen.

---

## Appendix A — nav label mapping (old → new)

| Today | New | Notes |
|---|---|---|
| Dashboard | (folded into **Sell** "Today" + **More → Today summary**) | Sell is the landing screen |
| Point of Sale | **Sell** | default after register open |
| Sales history | **Sales** → History | + Offline queue sibling |
| Register sessions | **Register** | open/close |
| Products | **Products** | + Basic/Advanced form |
| Inventory & lots | **Stock** | "Available stock", Add/Reduce |
| — | **More** | Sync conflicts, Language, Today, Team, Sign out |

## Appendix B — glossary shown to sellers (plain words only)

| Internal / Zoho term | Word shown in KOMOLA |
|---|---|
| SKU / variant / identifier | (hidden; auto) |
| Inventory balance | Available stock |
| Inventory receipt / adjustment (positive) | Add stock |
| Negative adjustment / wastage | Reduce stock |
| Lot / batch | Batch / harvest |
| FEFO / FIFO / valuation method | (hidden; "sells oldest batch first" if ever surfaced) |
| Idempotency key / replay | (hidden; "already saved — no duplicate") |
| Tender / payment capture | Payment · Cash received / confirmed |
| Sync / outbox / reconciliation | Saved on device · Waiting · Syncing · Synced · Needs review |
| Variance | Short by / Over by / Matches |
| Receivable / invoice lifecycle | (not shown) |
| Organization ID / tenant | (hidden) |
```
