"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { registersApi } from "@/shared/lib/api";
import type { RegisterDTO, SessionDTO } from "@/shared/lib/api/registers";
import { cardCls, ghostBtnCls, inputCls, primaryBtnCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";
import { formatPaise, rupeesToPaise } from "@/shared/lib/money";

export default function RegisterSessionsPage() {
  const [registers, setRegisters] = useState<RegisterDTO[]>([]);
  const [current, setCurrent] = useState<SessionDTO | null>(null);
  const [recent, setRecent] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [registerId, setRegisterId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await registersApi.overview();
    if (res.success && res.data) {
      setRegisters(res.data.registers);
      setCurrent(res.data.currentSession);
      setRecent(res.data.recentSessions);
      if (!registerId && res.data.registers[0]) setRegisterId(res.data.registers[0]._id);
    }
    setLoading(false);
  }, [registerId]);

  useEffect(() => {
    void load();
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

  if (loading) return <SkeletonRows rows={4} />;

  const t = current?.totals;

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
            <Field label="Cash sales" value={formatPaise(t?.cashSalesPaise ?? 0)} />
            <Field label="UPI sales" value={formatPaise(t?.upiSalesPaise ?? 0)} />
            <Field label="Sales count" value={String(t?.saleCount ?? 0)} />
            <Field
              label="Expected cash"
              value={formatPaise(
                current.openingCashPaise + (t?.cashSalesPaise ?? 0) - (t?.refundsPaise ?? 0),
              )}
            />
          </dl>

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
          <ul className="divide-y divide-border text-sm">
            {recent.map((s) => (
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
        )}
      </section>

      <a href="/pos" className={ghostBtnCls}>
        Go to POS
      </a>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="font-semibold text-foreground-heading">{value}</dd>
    </div>
  );
}
