export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-border bg-surface-card p-5">
        <h1 className="text-lg font-semibold text-foreground-heading">KOMOLA POS is offline</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Reopen Point of Sale from this device after it has been prepared online. Saved products, register context, and pending offline sales are kept on this browser.
        </p>
        <a href="/pos" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Open POS
        </a>
      </div>
    </main>
  );
}
