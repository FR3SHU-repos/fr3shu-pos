import Link from "next/link";

export const metadata = {
  title: "Privacy notice",
  description: "How KOMOLA processes buyer, seller, purchase and reward data.",
};

const sections = [
  ["What we collect", "Depending on how you use KOMOLA, we collect your name, email, mobile number, account identifiers, buyer code, location, address, purchases, receipts, reward activity, campaign claims, fulfillment details and choices about optional marketing or market-intelligence processing."],
  ["Why we use it", "We use this information to create and secure accounts, connect purchases to the correct buyer, issue receipts and Komola Coins, show location-based offers, verify and fulfill reward claims, prevent misuse, provide support, and improve agricultural products and services. Optional market-intelligence processing uses aggregated or pseudonymised purchase and location patterns."],
  ["Who may receive it", "Information may be shared with the seller or rewardor responsible for a sale or reward claim, and with service providers that help us operate authentication, hosting, storage, analytics, communications or payments. We limit access to what is needed for the stated purpose."],
  ["Your choices and rights", "You can update profile information and may request information about processing, correction, completion, updating, erasure where retention is not required, consent withdrawal, nomination and grievance redressal. Withdrawal does not undo processing that was lawful before withdrawal or records that must be retained for settlement, fraud prevention, accounting or another legal purpose."],
  ["Retention and security", "We retain information only for the account, receipt, reward, claim, support, security or analytics purpose for which it is needed, subject to legal retention requirements. KOMOLA uses authenticated API access and access controls; no online system can guarantee absolute security. Offline POS devices may temporarily store sale and customer details until synchronization or device cleanup."],
  ["Children", "KOMOLA is intended for adults unless a specific experience says otherwise. Do not provide a child’s personal data without the required parent or lawful-guardian process."],
];

export default function PrivacyPage() {
  return <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
    <Link href="/" className="text-sm font-semibold text-primary hover:underline">← Back to KOMOLA</Link>
    <article className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold text-primary">KOMOLA privacy notice</p>
      <h1 className="mt-2 text-3xl font-black text-foreground-heading">Your data, explained clearly</h1>
      <p className="mt-3 text-sm text-foreground-muted">Version 2026-10-06 · Last updated 6 October 2026</p>
      <p className="mt-6 leading-7 text-foreground-muted">This notice explains the main personal data KOMOLA processes across its buyer rewards and seller POS experiences. Specific screens may provide additional details when information is collected.</p>
      <div className="mt-8 space-y-7">{sections.map(([title, body]) => <section key={title}><h2 className="text-lg font-black text-foreground-heading">{title}</h2><p className="mt-2 leading-7 text-foreground-muted">{body}</p></section>)}</div>
      <section className="mt-8 rounded-xl bg-surface p-5">
        <h2 className="text-lg font-black text-foreground-heading">Questions or privacy requests</h2>
        <p className="mt-2 leading-7 text-foreground-muted">Contact the KOMOLA team through the support channel shown in your account or seller workspace. Include the account email or buyer code, the request you are making, and enough information for us to verify the request. We will publish the responsible privacy contact and request workflow as the service expands.</p>
      </section>
      <p className="mt-8 text-xs leading-6 text-foreground-muted">This notice is designed to support KOMOLA’s implementation of India’s Digital Personal Data Protection framework. It is not a substitute for legal advice and may be updated as the product, providers and applicable requirements change.</p>
    </article>
  </main>;
}
