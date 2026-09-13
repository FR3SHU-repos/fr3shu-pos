"use client";

import { useEffect, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { syncOfflineProducts } from "@/shared/lib/api/products";
import { isOffline, readProducts, searchProducts, setProductScope, type ProductSnapshot } from "@/shared/lib/offline/products";
import { formatPaise } from "@/shared/lib/money";
import { formatBaseQuantity } from "@/shared/lib/units";
import { inputCls } from "@/shared/components/ui";

/** Stays mounted in the seller shell: offline browsing needs no route request. */
export function OfflineCatalogue() {
  const { user } = usePosUser();
  const [offline, setOffline] = useState(false);
  const [snapshot, setSnapshot] = useState<ProductSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!user) return;
    setProductScope(user);
    let active = true;
    const controller = new AbortController();
    const read = async () => {
      const saved = await readProducts();
      if (active) setSnapshot(saved);
    };
    let syncing = false;
    const sync = async () => {
      if (syncing || !active) return;
      syncing = true;
      if (active) { setBusy(true); setError(""); }
      const ok = await syncOfflineProducts(controller.signal);
      syncing = false;
      if (active) {
        await read();
        setBusy(false);
        if (!ok) setError("Catalogue sync incomplete. Any previous saved copy is still available.");
      }
    };
    const connection = () => {
      setOffline(isOffline());
      if (isOffline()) setOpen(true);
      else void sync();
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      setSnapshot(null);
      void read();
      setOffline(isOffline());
      if (!isOffline()) void sync();
      else setOpen(true);
    });
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [user, revision]); // scope changes must discard the previous view

  const results = snapshot ? searchProducts(snapshot.items, { q: query, limit: 100 }).items : [];
  return <section className="mb-4 rounded-xl border border-border bg-surface-card p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status">{offline ? "Offline" : "Online"} · {busy ? "Saving products for offline use…" : snapshot ? `${snapshot.items.length} products saved · ${new Date(snapshot.savedAt).toLocaleString()}` : "No offline catalogue saved yet"}</p>
      <div className="flex gap-3">
        <button type="button" className="font-semibold text-primary" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide saved products" : "Browse saved products"}</button>
        <button type="button" disabled={offline || busy} className="font-semibold text-primary disabled:opacity-50" onClick={() => setRevision(v => v + 1)}>Sync products</button>
      </div>
    </div>
    {error && <p role="status" className="mt-2">{error}</p>}
    {(offline || open) && <p className="mt-2 text-foreground-muted">Saved prices and stock may have changed. Browse and search here without changing pages. Product edits and completing sales need internet. Keep this tab open for offline access.</p>}
    {open && <div className="mt-3 space-y-3">
      <input aria-label="Search saved products" className={inputCls} placeholder="Search saved products by name, barcode or SKU" value={query} onChange={e => setQuery(e.target.value)} />
      {!snapshot ? <p>Connect to the internet to save your catalogue on this device.</p> : results.length === 0 ? <p>No saved products match your search.</p> : <>
        <p className="text-xs text-foreground-muted">Showing up to 100 matches. Search to narrow the list.</p>
        <div className="max-h-96 overflow-auto divide-y divide-border">{results.map(product => <details key={product._id} className="py-3">
          <summary className="cursor-pointer">{product.name} · {product.basePricePaise == null ? "No price" : formatPaise(product.basePricePaise)} / {product.saleUnit}</summary>
          <div className="mt-2 space-y-1 text-foreground-muted">
            <p>SKU: {product.sku}{product.barcode ? ` · Barcode: ${product.barcode}` : ""}</p>
            <p>Last saved stock: {formatBaseQuantity(product.availableBase, product.saleUnit)} · {product.status}</p>
            <p>{product.organicStatus}{product.category ? ` · ${product.category}` : ""}</p>
            {product.description && <p>{product.description}</p>}
          </div>
        </details>)}</div>
      </>}
    </div>}
  </section>;
}
