"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { salesApi } from "@/shared/lib/api";
import { usePosUser } from "@/shared/context/PosUserContext";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { cardCls, EmptyState, inputCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { listOfflineSales, type OfflineSaleRecord, type OfflineScope } from "@/shared/lib/offline/sales";
import { mergeSalesWithOffline } from "@/shared/lib/offline/session-summary";

export default function SalesHistoryPage() {
  const { user } = usePosUser();
  const [items, setItems] = useState<SaleDTO[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRecord[]>([]);
  const [receiptNo, setReceiptNo] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      const scope: OfflineScope | null = user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null;
      const [res, local] = await Promise.all([
        salesApi.list({
          limit: 50,
          receiptNo: receiptNo.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
        scope ? listOfflineSales(scope) : Promise.resolve([]),
      ]);
      if (!alive) return;
      if (res.success && res.data) setItems(res.data.items);
      setOfflineSales(local);
      setLoading(false);
    };
    const timer = setTimeout(() => void load(), 250);
    const onOfflineSalesChanged = () => void load(false);
    window.addEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    };
  }, [receiptNo, phone, user]);

  const visibleItems = useMemo(() => {
    const receiptQuery = receiptNo.trim().toLowerCase();
    const phoneQuery = phone.trim();
    const filteredOffline = offlineSales
      .filter((sale) => !receiptQuery || sale.receiptNo.toLowerCase().includes(receiptQuery) || sale.serverReceiptNo?.toLowerCase().includes(receiptQuery))
      .filter((sale) => !phoneQuery || sale.customerPhone?.includes(phoneQuery));
    return mergeSalesWithOffline(items, filteredOffline, new Date().toISOString().slice(0, 10));
  }, [items, offlineSales, phone, receiptNo]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-foreground-heading">Sales history</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="Receipt number"
            className={`${inputCls} pl-9`}
          />
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Customer phone"
          className={inputCls}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : visibleItems.length === 0 ? (
        <EmptyState title="No sales found" description="Completed and locally saved offline sales will appear here." />
      ) : (
        <div className={cardCls}>
          <ul className="divide-y divide-border">
            {visibleItems.map(({ sale: s, local, state, serverSaleId, serverReceiptNo }) => (
              <li key={`${local ? "local" : "server"}:${s._id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  {local && !serverSaleId ? (
                    <span className="font-medium text-foreground-heading">{s.receiptNo}</span>
                  ) : (
                    <Link href={`/pos/history/${serverSaleId ?? s._id}`} className="font-medium text-brand">
                      {s.receiptNo}
                    </Link>
                  )}
                  {local ? <p className="text-xs text-foreground-muted">{serverReceiptNo ? `Server receipt ${serverReceiptNo}` : "local offline sale"}</p> : null}
                </div>
                <span className="text-foreground-muted">
                  {new Date(s.soldAt).toLocaleString("en-IN")}
                </span>
                <span className="text-foreground-muted">{s.items.length} item(s)</span>
                <StatusBadge status={local ? state : s.status} />
                <span className="font-semibold text-foreground-heading">
                  {formatPaise(s.totalPaise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
