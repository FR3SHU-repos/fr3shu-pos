import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://komola.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/admin",
        "/auth",
        "/buyer",
        "/dashboard",
        "/login",
        "/offline",
        "/pos",
        "/products",
        "/register",
        "/register-sessions",
        "/seller",
        "/settings",
        "/stock",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
