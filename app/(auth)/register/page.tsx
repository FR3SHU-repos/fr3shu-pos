import Link from "next/link";
import { ShoppingBag, Store } from "lucide-react";
import { cardCls } from "@/shared/components/ui";

export default function RegisterChoicePage() {
  return <main className="flex min-h-screen items-center justify-center bg-surface p-4">
    <section className={`${cardCls} w-full max-w-md`}>
      <h1 className="text-center text-2xl font-semibold text-foreground-heading">Create a KOMOLA account</h1>
      <p className="mt-2 text-center text-sm text-foreground-muted">Choose the account you want to create.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PortalLink href="/register/buyer" icon={<ShoppingBag className="h-7 w-7"/>} title="Buyer" description="Earn rewards and keep receipts" />
        <PortalLink href="/register/seller" icon={<Store className="h-7 w-7"/>} title="Seller" description="Set up your point of sale" />
      </div>
      <p className="mt-6 text-center text-sm text-foreground-muted">Already registered? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </section>
  </main>;
}

function PortalLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return <Link href={href} className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-border p-5 text-center transition hover:border-primary hover:bg-primary/5">
    <span className="text-primary">{icon}</span><span className="mt-3 text-lg font-semibold">{title}</span><span className="mt-1 text-sm text-foreground-muted">{description}</span>
  </Link>;
}
