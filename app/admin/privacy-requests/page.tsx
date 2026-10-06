"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/shared/lib/api";
import {
  listAdminPrivacyRequests,
  updateAdminPrivacyRequest,
  type AdminPrivacyRequest,
  type PrivacyOpsStatus,
} from "@/shared/lib/api/privacy";
import { cardCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";

const statusOptions: Array<{ value: "" | PrivacyOpsStatus; label: string }> = [
  { value: "", label: "All requests" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const typeLabel: Record<string, string> = {
  access: "Access my data",
  correction: "Correct my data",
  erasure: "Erase my data",
  nomination: "Nomination",
  grievance: "Privacy grievance",
};

export default function PrivacyRequestsAdminPage() {
  const [items, setItems] = useState<AdminPrivacyRequest[]>([]);
  const [status, setStatus] = useState<"" | PrivacyOpsStatus>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const result = await listAdminPrivacyRequests(status, page);
    if (result.success && result.data) {
      setItems(result.data.items);
      setTotalPages(Math.max(1, result.data.meta.totalPages));
      setError("");
    } else {
      setError(result.status === 403 ? "Platform administrator access is required." : result.message);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [page, status]);

  async function update(id: string, body: Parameters<typeof updateAdminPrivacyRequest>[1]) {
    setBusyId(id);
    setError("");
    const result = await updateAdminPrivacyRequest(id, body);
    setBusyId("");
    if (!result.success) {
      setError(result.message);
      return;
    }
    setNotes((current) => ({ ...current, [id]: "" }));
    await load();
  }

  async function signOut() {
    await authApi.logout();
    window.location.replace("/login");
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">KOMOLA privacy operations</p>
            <h1 className="text-2xl font-black text-foreground-heading">Privacy requests</h1>
            <p className="text-sm text-foreground-muted">Verify, assign and resolve customer privacy requests.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a className="font-semibold text-primary hover:underline" href="/admin/seller-applications">Seller access</a>
            <button className="font-medium text-primary" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <section className={cardCls}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="m-0 text-lg font-black text-foreground-heading">Operations queue</h2><p className="m-0 mt-1 text-sm text-foreground-muted">Complete identity verification before resolving a request.</p></div>
            <select className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </section>
        {loading ? <SkeletonRows rows={4} /> : error ? <section className={cardCls}><p className="text-sm font-semibold text-red-700">{error}</p></section> : (
          <section className={`${cardCls} overflow-hidden p-0`}>
            {items.length === 0 ? <p className="p-8 text-center text-sm text-foreground-muted">No privacy requests in this queue.</p> : <div className="divide-y divide-border">
              {items.map((item) => {
                const terminal = item.status === "completed" || item.status === "rejected";
                const note = notes[item.id] ?? item.responseNote ?? "";
                return <article key={item.id} className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-lg font-black text-foreground-heading">{typeLabel[item.requestType] ?? item.requestType}</h3><StatusBadge status={item.status.replace("_", " ")} /></div><p className="m-0 mt-1 text-xs text-foreground-muted">{new Date(item.createdAt).toLocaleString("en-IN")} · Request {item.id.slice(0, 8)}</p></div>
                    <div className="text-right text-sm"><p className="m-0 font-bold text-foreground-heading">{item.person.displayName || "Unnamed account"}</p><p className="m-0 text-foreground-muted">{item.person.email || item.person.phone || "No contact on file"}</p></div>
                  </div>
                  <p className="m-0 rounded-xl bg-surface p-4 text-sm leading-6 text-foreground-muted">{item.details}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground-muted"><span>Phone: {item.person.phone || "Not available"}</span><span>{item.identityVerifiedAt ? "Identity verified" : "Identity not verified"}</span><span>{item.assignedTo ? "Assigned" : "Unassigned"}</span></div>
                  {!terminal ? <>
                    <textarea className="min-h-20 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none" value={note} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value.slice(0, 2000) }))} placeholder="Optional response note shown to the requester" />
                    <div className="flex flex-wrap gap-2">
                      {item.status === "submitted" ? <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50" disabled={busyId === item.id} onClick={() => void update(item.id, { status: "in_review", responseNote: note })}>Claim for review</button> : null}
                      {!item.identityVerifiedAt ? <button className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground-heading disabled:opacity-50" disabled={busyId === item.id} onClick={() => void update(item.id, { identityVerified: true, responseNote: note })}>Verify identity</button> : null}
                      {item.status === "in_review" ? <><button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50" disabled={busyId === item.id || !item.identityVerifiedAt} onClick={() => void update(item.id, { status: "completed", responseNote: note })}>Complete request</button><button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50" disabled={busyId === item.id} onClick={() => void update(item.id, { status: "rejected", responseNote: note })}>Reject</button></> : null}
                    </div>
                  </> : item.responseNote ? <p className="m-0 rounded-xl bg-surface p-3 text-sm text-foreground-muted">Response: {item.responseNote}</p> : null}
                </article>;
              })}
            </div>}
            {totalPages > 1 ? <div className="flex items-center justify-between border-t border-border p-4 text-sm"><button className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span className="text-foreground-muted">Page {page} of {totalPages}</span><button className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
          </section>
        )}
      </div>
    </main>
  );
}
