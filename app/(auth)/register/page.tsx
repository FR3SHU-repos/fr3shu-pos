import Link from "next/link";
import { UserPlus } from "lucide-react";
import { cardCls, primaryBtnCls } from "@/shared/components/ui";

// POS staff accounts (Cashier / Store Manager / Store Owner) are provisioned by
// an administrator — they carry an org + store scope that must not be
// self-assigned. There is no self-service POS registration.
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm text-center`}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <UserPlus className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-foreground-heading">
          Accounts are invite-only
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Ask your store owner or administrator to create your POS account. Once
          it exists, sign in with the email and password you receive.
        </p>
        <Link href="/login" className={`${primaryBtnCls} mt-5 inline-flex w-full justify-center`}>
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
