"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import {
  listSellerApplications,
  type SellerOrganization,
} from "@/shared/lib/api/sellerOrgs";
import { cardCls, SkeletonRows, StatusBadge } from "@/shared/components/ui";

export default function SellerApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SellerOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void listSellerApplications().then((result) => {
      if (result.success && result.data) setItems(result.data.items);
      else setError(result.status === 403 ? "Administrator access is required." : result.message);
      setLoading(false);
    });
  }, []);

  async function signOut() {
    await createAuthBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground-heading">Seller access</h1>
            <p className="text-sm text-foreground-muted">Platform administrator dashboard</p>
          </div>
          <button className="text-sm font-medium text-primary" onClick={signOut}>Sign out</button>
        </header>
        {loading ? <SkeletonRows rows={4} /> : error ? (
          <section className={cardCls}><p className="text-sm text-red-700">{error}</p></section>
        ) : (
          <section className={cardCls}>
            <ul className="divide-y divide-border">
              {items.map((org) => (
                <li key={org.id} className="flex items-center justify-between gap-4 py-3">
                  <div><p className="font-medium text-foreground-heading">{org.displayName}</p><p className="text-xs text-foreground-muted">{org.type}</p></div>
                  <StatusBadge status={org.status} />
                </li>
              ))}
              {items.length === 0 ? <li className="py-8 text-center text-sm text-foreground-muted">No seller organizations yet.</li> : null}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
