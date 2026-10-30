import Link from "next/link";

export const metadata = {
  title: "Terms of service",
  description: "Terms for using KOMOLA seller point-of-sale services.",
};

const operator = {
  name: "Varmtech",
  address: "Door No 405, Revenue Ward 5, Narayana Sanidhi, Madhurawada, Visakhapatnam, India",
  email: "varma.v.business@gmail.com",
};

const sections = [
  [
    "About KOMOLA",
    "KOMOLA provides seller point-of-sale software for authorized organizations, locations, registers, catalogue management, stock, sales, receipts, payment-tender recording, and related support. KOMOLA is not the seller of the goods recorded in the POS and does not replace a seller's commercial, tax, payment-provider, or customer-service responsibilities.",
  ],
  [
    "Operator and acceptance",
    `KOMOLA is operated by ${operator.name}. By creating an account, accessing a seller workspace, or using KOMOLA, you agree to these Terms, the Privacy Notice, and any seller agreement or service-specific notice that applies to your use. If you use KOMOLA for an organization, you confirm that you are authorized to accept these Terms for that organization.`,
  ],
  [
    "Accounts and workspace access",
    "Provide accurate account and organization information, protect your password and verification links, and keep your device and session secure. Seller access depends on an approved organization, location, register, and role. Do not share accounts, bypass access controls, impersonate another person, or access another seller's workspace. You are responsible for activity performed through credentials assigned to you, subject to applicable law and our security obligations.",
  ],
  [
    "Seller responsibilities",
    "Sellers must keep product names, descriptions, prices, taxes, units, stock, availability, seller identity, and customer-facing receipt information accurate and lawful. Sellers are responsible for obtaining any registrations, licences, permissions, consents, and records required for the goods and transactions they conduct. Product, organic, natural, certification, health, origin, or similar claims must be truthful and supported by appropriate records.",
  ],
  [
    "Catalogue content and product images",
    "You retain ownership of product photos, logos, descriptions, product names, and other material you submit or connect to KOMOLA, subject to the rights of any third party. You grant KOMOLA a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, resize, format, display, and transmit that material as reasonably necessary to operate the seller catalogue, POS, receipts, support, backups, and related KOMOLA services. You confirm that you have the rights and permissions needed for this licence and that the material does not infringe, mislead, or contain unlawful or harmful content. KOMOLA may remove, restrict, or reformat catalogue content that is inaccurate, unsafe, unlawful, infringing, or incompatible with the service. This licence does not transfer ownership of your content to KOMOLA.",
  ],
  [
    "Sales, stock, payments, and offline operations",
    "KOMOLA may use the Go API as the authoritative source for authorization, prices, tax, stock, totals, register state, and receipt identity. A payment method or tender recorded in the POS is not by itself proof that a bank, card network, UPI provider, or other payment provider captured funds. Offline or pending operations may remain on a device until synchronization and must not be represented as confirmed server transactions until the service confirms them. Sellers remain responsible for reconciliation and responding to uncertain, failed, duplicated, or rejected operations.",
  ],
  [
    "Acceptable use",
    "Do not use KOMOLA to submit false sales or customer information, manipulate stock or receipts, interfere with service availability, probe private systems, upload unlawful or infringing material, distribute malware, misuse personal data, evade seller authorization, or violate applicable law. Do not send passwords, one-time codes, payment secrets, or unnecessary customer personal data through support channels.",
  ],
  [
    "Privacy, deletion, and retention",
    "The Privacy Notice explains the personal data KOMOLA processes, why it is processed, who may receive it, and how to submit access, correction, erasure, nomination, or grievance requests. Account deletion is handled as a reviewed erasure or anonymization request. Transaction, accounting, fraud-prevention, security, and audit records may need to be retained or anonymized where required for legitimate and legal purposes. The privacy request centre provides request references and status where available.",
  ],
  [
    "Intellectual property",
    "KOMOLA, its software, interface, documentation, trademarks, logos, and service content are owned by or licensed to KOMOLA or its licensors. These Terms give you a limited right to use the service for your authorized seller operations; they do not transfer KOMOLA intellectual-property rights to you. Feedback may be used to improve the service without creating an ownership interest for you.",
  ],
  [
    "Availability, changes, and third-party services",
    "We may change, suspend, or discontinue features to maintain security, reliability, legal compliance, or the service. KOMOLA may depend on hosting, authentication, storage, network, payment, messaging, or other third-party services. We will communicate material service information through the product or applicable support channels where reasonably practicable, but no online service is guaranteed to be continuously available.",
  ],
  [
    "Suspension and termination",
    "KOMOLA or an authorized organization may suspend or end access where necessary to protect users, investigate misuse, comply with law, or enforce these Terms. Suspension does not by itself erase transaction, accounting, or legally required records. On termination, your right to use the service ends, while provisions concerning content rights, privacy, retention, intellectual property, liability, and disputes may continue to apply.",
  ],
  [
    "Disclaimers and liability",
    "KOMOLA is provided for authorized seller operations and does not guarantee the availability, quality, legality, or saleability of goods listed by a seller. To the fullest extent permitted by law, KOMOLA is not responsible for indirect, incidental, consequential, or punitive loss arising from use of the service. Nothing in these Terms excludes liability that cannot legally be excluded or limits rights that applicable law gives you.",
  ],
  [
    "Governing law and contact",
    `These Terms are governed by the laws of India. Subject to mandatory applicable law, disputes are subject to the courts of Visakhapatnam, Andhra Pradesh. For legal, account, seller, or service questions, contact ${operator.name} at ${operator.email}. Registered office: ${operator.address}.`,
  ],
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-primary hover:underline">
        ← Back to KOMOLA
      </Link>
      <article className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-primary">KOMOLA terms of service</p>
        <h1 className="mt-2 text-3xl font-black text-foreground-heading">
          Seller operations, clearly defined
        </h1>
        <p className="mt-3 text-sm text-foreground-muted">
          Version 1.0.0 · Last updated 26 October 2026
        </p>
        <p className="mt-6 leading-7 text-foreground-muted">
          These Terms govern access to KOMOLA seller POS, catalogue, stock, register, sales,
          receipt, and support features. Please review them with the Privacy Notice before using the
          service.
        </p>
        <div className="mt-8 space-y-7">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-black text-foreground-heading">{title}</h2>
              <p className="mt-2 leading-7 text-foreground-muted">{body}</p>
            </section>
          ))}
        </div>
        <section className="mt-8 rounded-xl bg-surface p-5">
          <h2 className="text-lg font-black text-foreground-heading">Related information</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/privacy" className="font-bold text-primary hover:underline">
              Privacy notice →
            </Link>
            <Link href="/privacy/requests" className="font-bold text-primary hover:underline">
              Privacy request centre →
            </Link>
            <Link href="/support" className="font-bold text-primary hover:underline">
              Support →
            </Link>
          </div>
        </section>
        <p className="mt-8 text-xs leading-6 text-foreground-muted">
          If these Terms conflict with a signed seller agreement or a legally required notice, the
          applicable agreement or notice controls for that subject.
        </p>
      </article>
    </main>
  );
}
