"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { registersApi } from "@/shared/lib/api";
import { usePosUser } from "@/shared/context/PosUserContext";
import type { RegisterDTO, SessionDTO } from "@/shared/lib/api/registers";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise, rupeesToPaise } from "@/shared/lib/money";
import { listOfflineSales, type OfflineSaleRecord, type OfflineScope } from "@/shared/lib/offline/sales";
import { expectedCashWithOffline, pendingOfflineCashTotal } from "@/shared/lib/offline/session-summary";

export default function RegisterSessionsPage() {
  const PAGE_SIZE = 15;
  const { user } = usePosUser();
  const [registers, setRegisters] = useState<RegisterDTO[]>([]);
  const [current, setCurrent] = useState<SessionDTO | null>(null);
  const [recent, setRecent] = useState<SessionDTO[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recentPage, setRecentPage] = useState(1);

  const [registerId, setRegisterId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const scope: OfflineScope | null = user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null;
    const [res, local] = await Promise.all([
      registersApi.overview(),
      scope ? listOfflineSales(scope) : Promise.resolve([]),
    ]);
    if (res.success && res.data) {
      setRegisters(res.data.registers);
      setCurrent(res.data.currentSession);
      setRecent(res.data.recentSessions);
      if (!registerId && res.data.registers[0]) setRegisterId(res.data.registers[0]._id);
    }
    setOfflineSales(local);
    setLoading(false);
  }, [registerId, user]);

  useEffect(() => {
    void load();
    const onOfflineSalesChanged = () => void load();
    window.addEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
    return () => window.removeEventListener("komola:offline-sales-changed", onOfflineSalesChanged);
  }, [load]);

  async function openRegister(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await registersApi.open({
      registerId,
      openingCashPaise: rupeesToPaise(Number(openingCash || 0)),
    });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success("Register opened");
    setOpeningCash("");
    void load();
  }

  async function closeRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!current || busy) return;
    setBusy(true);
    const res = await registersApi.close(current.registerId, {
      countedCashPaise: rupeesToPaise(Number(countedCash || 0)),
      varianceNote: note.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success("Register closed");
    setCountedCash("");
    setNote("");
    void load();
  }

  const t = current?.totals;
  const { amountPaise: pendingOfflineCashPaise, count: pendingOfflineCount } = useMemo(() => pendingOfflineCashTotal(offlineSales), [offlineSales]);
  const { serverExpectedPaise: serverExpectedCashPaise, combinedExpectedPaise: combinedExpectedCashPaise } = current
    ? expectedCashWithOffline({
        openingCashPaise: current.openingCashPaise,
        serverCashSalesPaise: t?.cashSalesPaise ?? 0,
        refundsPaise: t?.refundsPaise ?? 0,
        pendingOfflineCashPaise,
      })
    : { serverExpectedPaise: 0, combinedExpectedPaise: 0 };
  const countedCashPaise = rupeesToPaise(Number(countedCash || 0));
  const combinedVariancePaise = countedCash ? countedCashPaise - combinedExpectedCashPaise : null;
  const recentPages = Math.max(1, Math.ceil(recent.length / PAGE_SIZE));
  const visibleRecent = recent.slice((recentPage - 1) * PAGE_SIZE, recentPage * PAGE_SIZE);
  useEffect(() => { setRecentPage((page) => Math.min(page, recentPages)); }, [recentPages]);

  if (loading) return <SkeletonRows rows={4} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground-heading">Register sessions</h1>

      {current ? (
        <section className={cardCls}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-heading">Open session</h2>
            <StatusBadge status="open" />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Field label="Opening cash" value={formatPaise(current.openingCashPaise)} />
            <Field label="Server cash sales" value={formatPaise(t?.cashSalesPaise ?? 0)} />
            <Field label="Pending offline cash" value={`${formatPaise(pendingOfflineCashPaise)} · ${pendingOfflineCount} sale${pendingOfflineCount === 1 ? "" : "s"}`} />
            <Field label="UPI sales" value={formatPaise(t?.upiSalesPaise ?? 0)} />
            <Field label="Server sale count" value={String(t?.saleCount ?? 0)} />
            <Field label="Server expected cash" value={formatPaise(serverExpectedCashPaise)} />
            <Field label="Expected cash with offline" value={formatPaise(combinedExpectedCashPaise)} />
          </dl>

          {pendingOfflineCount > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{pendingOfflineCount} offline cash sale{pendingOfflineCount === 1 ? "" : "s"} still pending sync.</p>
              <p className="mt-1">Physical drawer should include {formatPaise(pendingOfflineCashPaise)} extra cash. The backend close calculation will only know this amount after sync.</p>
            </div>
          ) : null}

          <form onSubmit={closeRegister} className="mt-4 space-y-3 border-t border-border pt-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                Counted cash (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className={inputCls}
              />
              {combinedVariancePaise !== null ? (
                <p className="mt-1 text-xs text-foreground-muted">
                  Variance using expected cash with offline: {formatPaise(combinedVariancePaise)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                Variance note (required if variance is large)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={busy} className={primaryBtnCls}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Close register
            </button>
          </form>
        </section>
      ) : (
        <section className={cardCls}>
          <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Open a register</h2>
          {registers.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No registers configured for your location. Ask an Owner to add one (seeded by
              default).
            </p>
          ) : (
            <form onSubmit={openRegister} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-body">
                  Register
                </label>
                <select
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                  className={inputCls}
                >
                  {registers.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-body">
                  Opening cash (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button type="submit" disabled={busy} className={primaryBtnCls}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Open register
              </button>
            </form>
          )}
        </section>
      )}

      <section className={cardCls}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-heading">Recent closed sessions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-foreground-muted">No closed sessions yet.</p>
        ) : (
          <>
          <ul className="divide-y divide-border text-sm">
            {visibleRecent.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-foreground-muted">
                  {s.closedAt ? new Date(s.closedAt).toLocaleString("en-IN") : "—"}
                </span>
                <span>Expected {formatPaise(s.expectedCashPaise ?? 0)}</span>
                <span>Counted {formatPaise(s.countedCashPaise ?? 0)}</span>
                <span
                  className={
                    (s.cashVariancePaise ?? 0) === 0
                      ? "font-medium text-status-success"
                      : "font-medium text-status-warning"
                  }
                >
                  Variance {formatPaise(s.cashVariancePaise ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          {recentPages > 1 ? <Pagination page={recentPage} pages={recentPages} onPageChange={setRecentPage} /> : null}
          </>
        )}
      </section>

      <a href="/pos" className={ghostBtnCls}>
        Go to POS
      </a>
    </div>
  );
}

function Pagination({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (page: number) => void }) {
  return <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
    <button type="button" className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
    <span className="text-foreground-muted">Page {page} of {pages}</span>
    <button type="button" className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
  </div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="font-semibold text-foreground-heading">{value}</dd>
    </div>
  );
}
