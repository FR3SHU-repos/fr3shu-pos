# End-to-end smoke tests (Playwright)

These drive a real running stack, so they are opt-in and skip when the variables below are unset. `npm test` (Vitest) never runs them.

Prerequisites: the web app (`npm run dev` or a deployed URL), the Go API and Supabase it points at, a seller account with an **open register** and at least one in-stock product, and a buyer account. Use test accounts only.

```bash
export E2E_BASE_URL=http://localhost:3000        # default
export E2E_SELLER_IDENTIFIER=seller@example.com
export E2E_SELLER_PASSWORD=...
export E2E_BUYER_IDENTIFIER=9876543210
export E2E_BUYER_PASSWORD=...
export E2E_WALKIN_PHONE=9876543210               # optional
npx playwright install chromium                   # first time
npm run test:e2e
```

Covered: seller login → cash sale → sale in history (and the period chips); buyer login → buyer code + QR; an offline cash sale that syncs after reconnecting. The sale tests create real sales in the target environment.
