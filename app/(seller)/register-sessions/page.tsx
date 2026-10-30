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
  const PAGE_SIZE = 10;
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
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">Register</h1>
        <p className="max-w-xl text-sm text-foreground-muted">Cash in the drawer and online (UPI) money, counted separately.</p>
      </header>

      {current ? (
        <section className={cardCls}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-heading">Open session</h2>
            <StatusBadge status="open" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-surface-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Cash in drawer</p>
              <p className="mt-2 text-3xl font-bold text-foreground-heading">{formatPaise(combinedExpectedCashPaise)}</p>
              <dl className="mt-3 space-y-1 text-xs text-foreground-muted">
                <div className="flex justify-between"><dt>Opening cash</dt><dd>{formatPaise(current.openingCashPaise)}</dd></div>
                <div className="flex justify-between"><dt>Cash sales (server)</dt><dd>{formatPaise(t?.cashSalesPaise ?? 0)}</dd></div>
                <div className="flex justify-between"><dt>Offline cash pending ({pendingOfflineCount})</dt><dd>{formatPaise(pendingOfflineCashPaise)}</dd></div>
                <div className="flex justify-between"><dt>Server expected</dt><dd>{formatPaise(serverExpectedCashPaise)}</dd></div>
              </dl>
            </div>
            <div className="rounded-3xl bg-surface-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Online (UPI)</p>
              <p className="mt-2 text-3xl font-bold text-foreground-heading">{formatPaise(t?.upiSalesPaise ?? 0)}</p>
              <dl className="mt-3 space-y-1 text-xs text-foreground-muted">
                <div className="flex justify-between"><dt>Sales this session</dt><dd>{t?.saleCount ?? 0}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-foreground-muted">Not counted in the drawer.</p>
            </div>
          </div>

          {pendingOfflineCount > 0 ? (
            <div className="mt-4 rounded-2xl bg-status-warning-surface p-4 text-sm text-status-warning">
              <p className="font-semibold">{pendingOfflineCount} offline cash sale{pendingOfflineCount === 1 ? "" : "s"} still pending sync.</p>
              <p className="mt-1">Physical drawer should include {formatPaise(pendingOfflineCashPaise)} extra cash. The backend close calculation will only know this amount after sync.</p>
            </div>
          ) : null}

          <form onSubmit={closeRegister} className="mt-5 space-y-4">
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
                <p className="mt-2 flex items-center gap-2 text-xs text-foreground-muted">
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      combinedVariancePaise === 0
                        ? "bg-status-success-surface text-status-success"
                        : combinedVariancePaise > 0
                          ? "bg-status-info-surface text-status-info"
                          : "bg-status-danger-surface text-status-danger"
                    }`}
                  >
                    {combinedVariancePaise === 0 ? "Balanced" : combinedVariancePaise > 0 ? "Over" : "Short"}
                  </span>
                  Variance vs expected cash with offline: {formatPaise(combinedVariancePaise)}
                </p>
              ) : null}
              <NoteCounter onTotal={(rupees) => setCountedCash(rupees > 0 ? String(rupees) : "")} />
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Recent closed sessions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-foreground-muted">No closed sessions yet.</p>
        ) : (
          <>
          <ul className="space-y-2 text-sm">
            {visibleRecent.map((s) => {
              const v = s.cashVariancePaise ?? 0;
              return (
                <li key={s._id} className="rounded-2xl bg-surface-muted p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground-heading">{s.closedAt ? new Date(s.closedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v === 0 ? "bg-status-success-surface text-status-success" : v > 0 ? "bg-status-info-surface text-status-info" : "bg-status-danger-surface text-status-danger"}`}>
                      {v === 0 ? "Balanced" : `${v > 0 ? "Over" : "Short"} ${formatPaise(Math.abs(v))}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">Expected {formatPaise(s.expectedCashPaise ?? 0)} · Counted {formatPaise(s.countedCashPaise ?? 0)}</p>
                </li>
              );
            })}
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
  return <div className="mt-3 flex items-center justify-between pt-1 text-sm">
    <button type="button" className="min-h-11 rounded-full bg-surface-muted px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
    <span className="text-foreground-muted">Page {page} of {pages}</span>
    <button type="button" className="min-h-11 rounded-full bg-surface-muted px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
  </div>;
}

const NOTE_DENOMINATIONS = [500, 200, 100, 50, 20, 10] as const;

/** Count-by-notes helper: sums note counts into the counted-cash field. The server still validates the close. */
function NoteCounter({ onTotal }: { onTotal: (rupees: number) => void }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  function change(d: number, delta: number) {
    const next = { ...counts, [d]: Math.max(0, (counts[d] ?? 0) + delta) };
    setCounts(next);
    onTotal(NOTE_DENOMINATIONS.reduce((sum, n) => sum + n * (next[n] ?? 0), 0));
  }
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-semibold text-primary">
        {open ? "Hide note counter" : "Count by notes"}
      </button>
      {open ? (
        <ul className="mt-3 space-y-2 rounded-3xl bg-surface-muted p-3">
          {NOTE_DENOMINATIONS.map((d) => (
            <li key={d} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground-heading">₹{d}</span>
              <div className="flex items-center gap-3">
                <button type="button" aria-label={`Fewer ₹${d} notes`} onClick={() => change(d, -1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-card text-lg">−</button>
                <span className="w-8 text-center text-sm font-bold">{counts[d] ?? 0}</span>
                <button type="button" aria-label={`More ₹${d} notes`} onClick={() => change(d, 1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-card text-lg">+</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
