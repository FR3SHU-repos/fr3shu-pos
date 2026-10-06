"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { identityApi } from "@/shared/lib/api";
import type { PrivacyRequest, PrivacyRequestType } from "@/shared/lib/api/identity";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

const requestTypes: Array<{ value: PrivacyRequestType; label: string }> = [
  { value: "access", label: "Access my data" },
  { value: "correction", label: "Correct my data" },
  { value: "erasure", label: "Erase my data" },
  { value: "nomination", label: "Nomination" },
  { value: "grievance", label: "Privacy grievance" },
];

const statusLabel: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  completed: "Completed",
  rejected: "Needs follow-up",
};

export default function PrivacyRequestsPage() {
  const [consents, setConsents] = useState({ market_intelligence: false, marketing: false });
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [consentResult, requestResult] = await Promise.all([identityApi.privacyConsents(), identityApi.privacyRequests()]);
    if (consentResult.success) {
      const next = { market_intelligence: false, marketing: false };
      for (const consent of consentResult.data?.items ?? []) {
        if (consent.purposeCode === "market_intelligence") next.market_intelligence = consent.granted;
        if (consent.purposeCode === "marketing") next.marketing = consent.granted;
      }
      setConsents(next);
    }
    if (requestResult.success) setRequests(requestResult.data?.items ?? []);
    else if (requestResult.status === 401) setError("Please sign in to manage privacy choices and requests.");
  }

  useEffect(() => { void load(); }, []);

  async function updateConsent(purposeCode: "market_intelligence" | "marketing", granted: boolean) {
    setError("");
    setMessage("");
    setConsents((current) => ({ ...current, [purposeCode]: granted }));
    const result = await identityApi.recordPrivacyConsent(purposeCode, granted);
    if (!result.success) {
      setConsents((current) => ({ ...current, [purposeCode]: !granted }));
      setError(result.message);
      return;
    }
    setMessage(`${purposeCode === "market_intelligence" ? "Market insights" : "Marketing"} choice updated.`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const trimmed = details.trim();
    if (trimmed.length < 10) return setError("Add at least 10 characters describing your request.");
    setBusy(true);
    const result = await identityApi.submitPrivacyRequest(requestType, trimmed);
    setBusy(false);
    if (!result.success) return setError(result.message);
    setDetails("");
    setMessage("Your privacy request was submitted.");
    await load();
  }

  async function downloadExport() {
    setError("");
    setMessage("");
    const result = await identityApi.privacyExport();
    if (!result.success || !result.data) return setError(result.message);
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "komola-privacy-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Your privacy export is ready.");
  }

  return <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/privacy" className="text-sm font-semibold text-primary hover:underline">← Back to privacy notice</Link>
      <section className={`${cardCls} space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">KOMOLA privacy centre</p><h1 className="mt-1 text-3xl font-black text-foreground-heading">Manage your privacy choices</h1><p className="mt-2 text-sm leading-6 text-foreground-muted">Optional choices can be changed at any time. Your service, receipt and reward access do not depend on marketing or market-intelligence consent.</p></div><button type="button" className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground-heading" onClick={() => void downloadExport()}>Download my data</button></div>
        <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-1 text-sm font-bold">Optional processing</legend>
          <label className="flex items-start gap-3 text-sm text-foreground-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={consents.market_intelligence} onChange={(event) => void updateConsent("market_intelligence", event.target.checked)} /><span><strong className="text-foreground-heading">Agricultural market insights</strong><br />Use pseudonymised purchase and location patterns to improve KOMOLA and understand product demand.</span></label>
          <label className="flex items-start gap-3 text-sm text-foreground-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={consents.marketing} onChange={(event) => void updateConsent("marketing", event.target.checked)} /><span><strong className="text-foreground-heading">Marketing messages</strong><br />Receive optional KOMOLA updates and offers.</span></label>
        </fieldset>
        {message ? <p role="status" className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</p> : null}
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </section>
      <section className={`${cardCls} space-y-5`}>
        <div><h2 className="text-xl font-black text-foreground-heading">Submit a privacy request</h2><p className="mt-1 text-sm text-foreground-muted">Requests are linked to your signed-in account so the KOMOLA team can verify and track them.</p></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-foreground-heading">Request type<select className={inputCls} value={requestType} onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)}>{requestTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="block text-sm font-semibold text-foreground-heading">Details<textarea className={`${inputCls} min-h-32`} value={details} onChange={(event) => setDetails(event.target.value.slice(0, 2000))} minLength={10} maxLength={2000} required placeholder="Tell us what you need help with." /></label>
          <button type="submit" className={`${primaryBtnCls} min-h-11`} disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
        </form>
      </section>
      <section className={`${cardCls}`}><h2 className="text-xl font-black text-foreground-heading">Your requests</h2>{requests.length === 0 ? <p className="mt-3 text-sm text-foreground-muted">No privacy requests submitted yet.</p> : <div className="mt-4 divide-y divide-border">{requests.map((request) => <article key={request.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-foreground-heading">{requestTypes.find((item) => item.value === request.requestType)?.label ?? request.requestType}</p><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{statusLabel[request.status] ?? request.status}</span></div><p className="mt-1 text-sm text-foreground-muted">{request.details}</p><p className="mt-2 text-xs text-foreground-muted">Submitted {new Date(request.createdAt).toLocaleString()}{request.dueAt ? ` · Target response ${new Date(request.dueAt).toLocaleDateString()}` : ""}</p>{request.responseNote ? <p className="mt-2 rounded-lg bg-surface p-3 text-sm text-foreground-muted">{request.responseNote}</p> : null}</article>)}</div>}</section>
    </div>
  </main>;
}
