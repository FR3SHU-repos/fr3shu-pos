"use client";

import { useEffect, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { syncOfflineProducts } from "@/shared/lib/api/products";
import {
  isOffline,
  readProducts,
  searchProducts,
  setProductScope,
  type ProductSnapshot,
} from "@/shared/lib/offline/products";
import { formatPaise } from "@/shared/lib/money";
import { formatProductQuantity } from "@/shared/lib/units";
import { inputCls } from "@/shared/components/ui";

/** Stays mounted in the seller shell: offline browsing needs no route request. */
export function OfflineCatalogue({
  compact = false,
  visible = true,
  active = true,
}: {
  compact?: boolean;
  visible?: boolean;
  active?: boolean;
}) {
  const { user } = usePosUser();
  const [offline, setOffline] = useState(false);
  const [snapshot, setSnapshot] = useState<ProductSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!user || !active) return;
    setProductScope(user);
    let alive = true;
    const controller = new AbortController();
    const read = async () => {
      const saved = await readProducts();
      if (alive) setSnapshot(saved);
    };
    let syncing = false;
    const sync = async (force = revision > 0) => {
      if (syncing || !alive) return;
      syncing = true;
      if (alive) {
        setBusy(true);
        setError("");
      }
      const ok = await syncOfflineProducts(controller.signal, { force });
      syncing = false;
      if (alive) {
        await read();
        setBusy(false);
        if (!ok) setError("Catalogue sync incomplete. Any previous saved copy is still available.");
      }
    };
    const connection = () => {
      setOffline(isOffline());
      if (isOffline()) setOpen(true);
      else void sync(true);
    };
    void Promise.resolve().then(() => {
      if (!alive) return;
      setSnapshot(null);
      void read();
      setOffline(isOffline());
      if (!isOffline()) void sync(revision > 0);
      else setOpen(true);
    });
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      alive = false;
      controller.abort();
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [active, user, revision]); // scope changes must discard the previous view

  if (!visible) return null;

  const results = snapshot ? searchProducts(snapshot.items, { q: query, limit: 100 }).items : [];
  return (
    <section
      className={`${compact ? "mb-5 rounded-2xl bg-surface-muted p-3" : "mb-4 rounded-xl bg-surface-card p-3"} border border-border text-sm`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground-heading">Saved catalogue</p>
          <p role="status" className="text-xs text-foreground-muted">
            {offline ? "Offline" : "Online"} ·{" "}
            {busy
              ? "Saving products for offline use…"
              : snapshot
                ? `${snapshot.items.length} products saved · ${new Date(snapshot.savedAt).toLocaleString()} · ${snapshot.snapshotVersion}`
                : "No offline catalogue saved yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-full border border-border bg-surface-card px-4 py-2 text-xs font-semibold text-foreground-body hover:bg-surface-card"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? "Hide saved products" : "Browse saved products"}
          </button>
          <button
            type="button"
            disabled={offline || busy}
            className="min-h-11 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            onClick={() => setRevision((v) => v + 1)}
          >
            Sync products
          </button>
        </div>
      </div>
      {error && (
        <p role="status" className="mt-2">
          {error}
        </p>
      )}
      {(offline || open) && (
        <p className="mt-2 text-foreground-muted">
          Saved prices and stock may have changed. Offline product creation and stock updates are
          disabled; reconnect to change the catalogue or receive stock. Eligible cash sales can be
          saved offline and synced later.
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <input
            aria-label="Search saved products"
            className={inputCls}
            placeholder="Search saved products by name, barcode or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!snapshot ? (
            <p>Connect to the internet to save your catalogue on this device.</p>
          ) : results.length === 0 ? (
            <p>No saved products match your search.</p>
          ) : (
            <>
              <p className="text-xs text-foreground-muted">
                Showing up to 100 matches. Search to narrow the list.
              </p>
              <div className="max-h-96 overflow-auto divide-y divide-border">
                {results.map((product) => (
                  <details key={product._id} className="py-3">
                    <summary className="cursor-pointer">
                      {product.name} ·{" "}
                      {product.basePricePaise == null
                        ? "No price"
                        : formatPaise(product.basePricePaise)}{" "}
                      / {product.saleUnit}
                    </summary>
                    <div className="mt-2 space-y-1 text-foreground-muted">
                      <p>
                        SKU: {product.sku}
                        {product.barcode ? ` · Barcode: ${product.barcode}` : ""}
                      </p>
                      <p>
                        Last saved stock:{" "}
                        {formatProductQuantity(
                          product.availableBase,
                          product.saleUnit,
                          product.baseUnit,
                          product.basePerSaleUnit,
                        )}{" "}
                        · {product.status}
                      </p>
                      <p>
                        {product.organicStatus}
                        {product.category ? ` · ${product.category}` : ""}
                      </p>
                      {product.description && <p>{product.description}</p>}
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
