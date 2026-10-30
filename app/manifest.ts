import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KOMOLA — Agri-tech rewards",
    short_name: "KOMOLA",
    description:
      "Agri-tech POS for sellers and rewards for buyers of agricultural products.",
    start_url: "/pos",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0e0f11",
    theme_color: "#0e0f11",
    categories: ["business", "productivity", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
