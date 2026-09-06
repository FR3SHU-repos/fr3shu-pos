import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOMOLA Organic POS",
    short_name: "KOMOLA POS",
    description: "Seller-side Point of Sale for verified organic products.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f8faf5",
    theme_color: "#ff5733",
    icons: [{ src: "/komola-logo.png", sizes: "1100x1094", type: "image/png", purpose: "any" }],
  };
}
