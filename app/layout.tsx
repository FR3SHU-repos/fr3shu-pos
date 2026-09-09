import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PosUserProvider } from "@/shared/context/PosUserContext";
import { SiteFooter, SiteHeader } from "@/shared/components/SiteChrome";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "KOMOLA Organic POS",
  description: "Seller-side Point of Sale for small organic sellers.",
  manifest: "/manifest.webmanifest",
  applicationName: "KOMOLA Organic POS",
  appleWebApp: { capable: true, title: "KOMOLA POS", statusBarStyle: "default" },
  icons: { icon: "/komola-logo.png", apple: "/komola-logo.png" },
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
