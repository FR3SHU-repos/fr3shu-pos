import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PosUserProvider } from "@/shared/context/PosUserContext";
import { SiteFooter, SiteHeader } from "@/shared/components/SiteChrome";
import { Toaster } from "react-hot-toast";
import { ServiceWorkerRegistration } from "@/shared/components/ServiceWorkerRegistration";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://komola.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KOMOLA | Agri-tech POS and rewards platform",
    template: "%s | KOMOLA",
  },
  description:
    "KOMOLA is an agri-tech platform for agricultural sellers and buyers: sell agri products, issue digital receipts, earn rewards, and build better purchase intelligence.",
  keywords: [
    "agri-tech",
    "agri tech startup",
    "agriculture technology",
    "agri rewards",
    "agri purchase rewards",
    "agricultural products marketplace",
    "agri POS",
    "farm produce sales",
    "agri market intelligence",
    "agriculture market intelligence",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "KOMOLA",
    title: "KOMOLA | Agri-tech POS and rewards platform",
    description:
      "A rewards-based agri purchase platform connecting agricultural sellers and buyers through POS, digital receipts, and Komola Coins.",
    locale: "en_IN",
    images: [
      {
        url: "/komola-logo.png",
        width: 1100,
        height: 1094,
        alt: "KOMOLA agri-tech rewards platform",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "KOMOLA | Agri-tech POS and rewards platform",
    description:
      "Agri-tech tools for sellers and rewards for buyers of agricultural products.",
    images: ["/komola-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: "/manifest.webmanifest",
  applicationName: "KOMOLA",
  appleWebApp: { capable: true, title: "KOMOLA", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.ico?v=komola-20260909", type: "image/x-icon", sizes: "64x64" }],
    shortcut: "/favicon.ico?v=komola-20260909",
    apple: "/komola-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff5733",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PosUserProvider>
          <ServiceWorkerRegistration />
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="min-h-0 flex-1">{children}</div>
            <SiteFooter />
          </div>
        </PosUserProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#fff",
              color: "#1c1917",
              border: "1px solid #f4c8bb",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#15803d", secondary: "#fff" } },
            error: { iconTheme: { primary: "#b91c1c", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
