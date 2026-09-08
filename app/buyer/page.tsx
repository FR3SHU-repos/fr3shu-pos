"use client";

import { useEffect, useState } from "react";
import { identityApi } from "@/shared/lib/api";
import type { PersonProfile } from "@/shared/lib/api/identity";
import { cardCls } from "@/shared/components/ui";

export default function BuyerDashboardPage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void identityApi.profile().then(result => result.success ? setProfile(result.data) : setError(result.message)); }, []);
  return <main className="mx-auto min-h-screen max-w-3xl bg-surface p-4 sm:p-8">
    <header className="mb-6"><p className="font-semibold text-primary">KOMOLA Buyer</p><h1 className="text-3xl font-bold">{profile?.displayName ? `Hello, ${profile.displayName}` : "Your purchases"}</h1></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Reward points">
      <div className={cardCls}><p className="text-foreground-muted">Available points</p><p className="mt-2 text-4xl font-bold">0</p></div>
      <div className={cardCls}><p className="text-foreground-muted">Pending points</p><p className="mt-2 text-4xl font-bold">0</p></div>
    </section>
    <section className={`${cardCls} mt-4`}><h2 className="text-xl font-semibold">Verified contact methods</h2><ul className="mt-3 space-y-2">{profile?.contacts.map(contact=><li key={contact.id} className="flex min-h-12 items-center justify-between rounded-lg border px-3"><span>{contact.value}</span><span className="text-sm font-medium text-green-700">Verified {contact.type}</span></li>)}</ul>{profile && profile.contacts.length===0 && <p className="mt-2 text-foreground-muted">No verified contact method yet.</p>}</section>
  </main>;
}
