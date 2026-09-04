import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PosUserProvider } from "@/shared/context/PosUserContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "FR3SHU Organic POS",
  description: "Seller-side Point of Sale for verified organic products.",
  manifest: "/manifest.webmanifest",
  applicationName: "FR3SHU Organic POS",
  appleWebApp: { capable: true, title: "FR3SHU POS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#065f46",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PosUserProvider>{children}</PosUserProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#fff",
              color: "#1c1917",
              border: "1px solid #d1ead9",
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
