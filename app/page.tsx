import {
  createSupabaseServerClient,
  supabaseAuthConfigured,
} from "@/shared/lib/supabase/server";
import { Landing } from "@/shared/components/landing/Landing";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://komola.in";

// Public landing page. Auth-based redirects for the app itself live in
// `middleware.ts`; `/` is intentionally allowed through so anyone can see this.
export default async function Home() {
  let user = null;
  if (supabaseAuthConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser();
    user = authenticatedUser;
  }
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "KOMOLA",
      url: siteUrl,
      logo: `${siteUrl}/komola-logo.png`,
      description:
        "KOMOLA connects agricultural sellers and buyers through agri-tech POS, digital receipts, and purchase rewards.",
      areaServed: "IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "KOMOLA",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Agri-tech POS and rewards software for agricultural sellers and buyers.",
      featureList: [
        "Agri-tech point of sale",
        "Agricultural product sales by weight or piece",
        "Digital purchase receipts",
        "Rewards for agri purchases",
        "Purchase data for agricultural market intelligence",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "KOMOLA",
      url: siteUrl,
      description:
        "A rewards-based platform for buying and selling agricultural products.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Landing signedIn={Boolean(user)} />
    </>
  );
}
