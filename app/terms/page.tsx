import Link from "next/link";

export const metadata = {
  title: "Terms of service",
  description: "Terms for using KOMOLA seller POS and buyer services.",
};

const sections = [
  ["About KOMOLA", "KOMOLA provides software for seller point-of-sale operations, buyer receipts and rewards, and related support services. These terms describe the general use of those services; a seller's commercial relationship with its customers remains the seller's responsibility."],
  ["Accounts and access", "Keep your account information accurate and protect your password and verification links. Seller POS access depends on an authorized organization, location, register, and role. Do not share an account, bypass access controls, or use another seller's workspace."],
  ["Seller operations", "KOMOLA records sales, receipts, register activity, stock and payment-tender information through the authorized seller workflow. The Go API is authoritative for prices, tax, stock, totals, authorization, and receipt identity. A tender recorded in the POS is not automatically proof that a payment provider captured funds."],
  ["Acceptable use", "Do not use KOMOLA to impersonate another person, submit false customer details, interfere with service availability, upload unlawful or infringing material, probe private systems, or misuse customer, seller, reward, or support information."],
  ["Privacy and deletion", "Our Privacy Notice explains the personal data we process, why we process it, and how to submit access, correction, erasure, nomination, and grievance requests. Account deletion is handled as a reviewed erasure or anonymization request so legally required transaction and audit records can be retained where necessary."],
  ["Service availability and changes", "We may improve, suspend, or change features to maintain security, reliability, legal compliance, or the service. We will not represent a pending, offline, or uncertain operation as a confirmed server transaction. Service-specific messages and release notes may provide additional information."],
  ["Support and contact", "For help, use the KOMOLA support page or email varma.v.business@gmail.com. Do not send passwords, one-time codes, payment secrets, or unnecessary customer personal data in a support request."],
];

export default function TermsPage() {
  return <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
    <Link href="/" className="text-sm font-semibold text-primary hover:underline">← Back to KOMOLA</Link>
    <article className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold text-primary">KOMOLA terms of service</p>
      <h1 className="mt-2 text-3xl font-black text-foreground-heading">Use KOMOLA safely and clearly</h1>
      <p className="mt-3 text-sm text-foreground-muted">Version 1.0.0 · Last updated 26 October 2026</p>
      <p className="mt-6 leading-7 text-foreground-muted">These terms are a product-facing summary for the current KOMOLA services. The operator should review and approve the final legal wording before App Store submission.</p>
      <div className="mt-8 space-y-7">{sections.map(([title, body]) => <section key={title}><h2 className="text-lg font-black text-foreground-heading">{title}</h2><p className="mt-2 leading-7 text-foreground-muted">{body}</p></section>)}</div>
      <section className="mt-8 rounded-xl bg-surface p-5">
        <h2 className="text-lg font-black text-foreground-heading">Related information</h2>
        <div className="mt-4 flex flex-wrap gap-4"><Link href="/privacy" className="font-bold text-primary hover:underline">Privacy notice →</Link><Link href="/privacy/requests" className="font-bold text-primary hover:underline">Privacy request centre →</Link><Link href="/support" className="font-bold text-primary hover:underline">Support →</Link></div>
      </section>
      <p className="mt-8 text-xs leading-6 text-foreground-muted">If these terms conflict with a signed seller agreement or a legally required notice, the applicable agreement or notice controls for that subject.</p>
    </article>
  </main>;
}
