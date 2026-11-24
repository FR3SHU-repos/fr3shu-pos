"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { receiptsApi } from "@/shared/lib/api";
import type { BuyerReceiptSummary, ReceiptClaimCandidate } from "@/shared/lib/api/receipts";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";

export default function BuyerReceiptsPage() {
  const [receipts, setReceipts] = useState<BuyerReceiptSummary[]>([]);
  const [claims, setClaims] = useState<ReceiptClaimCandidate[]>([]);
  const [review, setReview] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [weekAgo, setWeekAgo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [claimError, setClaimError] = useState("");

  const loadReceipts = useCallback(async (next: number) => {
    setLoading(true);
    setError("");
    const result = await receiptsApi.list(25, next);
    if (result.success && result.data) {
      const data = result.data;
      setReceipts((previous) =>
        next === 1
          ? data.items
          : [
              ...previous,
              ...data.items.filter((item) => !previous.some((receipt) => receipt.id === item.id)),
            ],
      );
      setPage(next);
      setTotalPages(data.meta.totalPages);
    } else setError(result.message);
    setLoading(false);
  }, []);

  const loadClaims = useCallback(async () => {
    const result = await receiptsApi.claimable();
    if (result.success && result.data) {
      setClaims(result.data.items);
      setClaimError("");
    } else setClaimError(result.message);
  }, []);

  useEffect(() => {
    void loadReceipts(1);
    void loadClaims();
  }, [loadReceipts, loadClaims]);

  async function resolve(id: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    setClaimError("");
    const result = await (accept ? receiptsApi.claim(id) : receiptsApi.decline(id));
    if (result.success) {
      setClaims((previous) => previous.filter((item) => item.id !== id));
      setReview(null);
      if (accept) await loadReceipts(1);
    } else setClaimError(result.message);
    setBusy(false);
  }

  const needle = query.trim().toLowerCase();
  const visible = receipts.filter(
    (receipt) =>
      (!needle ||
        [receipt.receiptNo, receipt.storeName, receipt.locationName].some((value) =>
          value?.toLowerCase().includes(needle),
        )) &&
      (filter !== "coins" || receipt.coinsEarned > 0) &&
      (filter !== "week" || new Date(receipt.purchasedAt).getTime() >= weekAgo),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-32 sm:p-8">
      <h1 className="text-3xl font-bold">My receipts</h1>
      {claims.length || claimError ? (
        <section className={cardCls + " space-y-3"}>
          <h2 className="text-lg font-semibold">Ready for review</h2>
          {claimError ? (
            <p role="alert">
              {claimError}{" "}
              <button className={ghostBtnCls} onClick={() => void loadClaims()}>
                Retry
              </button>
            </p>
          ) : null}
          {claims.map((claim) => (
            <article key={claim.id} className="space-y-2 border-t border-border-subtle pt-3">
              <p className="font-semibold">
                {claim.storeName} · {formatPaise(claim.totalMinor)}
              </p>
              <p className="text-sm text-foreground-muted">
                {claim.receiptNo} · {new Date(claim.purchasedAt).toLocaleDateString("en-IN")}
              </p>
              {review === claim.id ? (
                <>
                  <p>Does this purchase belong to you?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={primaryBtnCls}
                      disabled={busy}
                      onClick={() => void resolve(claim.id, true)}
                    >
                      Confirm receipt
                    </button>
                    <button
                      className={ghostBtnCls}
                      disabled={busy}
                      onClick={() => void resolve(claim.id, false)}
                    >
                      This isn’t mine
                    </button>
                    <button className={ghostBtnCls} disabled={busy} onClick={() => setReview(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button className={ghostBtnCls} disabled={busy} onClick={() => setReview(claim.id)}>
                  Review receipt
                </button>
              )}
            </article>
          ))}
        </section>
      ) : null}
      <section className={cardCls + " space-y-4"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Search receipts
            <input
              className={inputCls}
              placeholder="Store or receipt number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            Filter
            <select
              className={inputCls}
              value={filter}
              onChange={(event) => {
                setWeekAgo(Date.now() - 7 * 24 * 60 * 60 * 1000);
                setFilter(event.target.value);
              }}
            >
              <option value="all">All receipts</option>
              <option value="week">Last 7 days</option>
              <option value="coins">Earned coins</option>
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button className={ghostBtnCls} onClick={() => void loadReceipts(page + 1)}>
              Retry
            </button>
          </p>
        ) : null}
        {visible.length ? (
          <ul className="divide-y divide-border-subtle">
            {visible.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/buyer/receipts/${receipt.id}`}
                  className="flex justify-between gap-3 py-3"
                >
                  <span>
                    <strong>{receipt.storeName}</strong>
                    <span className="block text-sm text-foreground-muted">
                      {receipt.receiptNo} ·{" "}
                      {new Date(receipt.purchasedAt).toLocaleDateString("en-IN")}
                    </span>
                  </span>
                  <span>{formatPaise(receipt.totalMinor)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : !loading && !error ? (
          <p>No matching receipts in the loaded results.</p>
        ) : null}
        {loading ? <p role="status">Loading receipts…</p> : null}
        {page > 0 && page < totalPages ? (
          <div>
            <p className="text-sm text-foreground-muted">
              Search and filters apply to receipts loaded so far.
            </p>
            <button
              className={ghostBtnCls}
              disabled={loading}
              onClick={() => void loadReceipts(page + 1)}
            >
              Load more receipts
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
