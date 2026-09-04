import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FR3SHU Organic POS",
    short_name: "FR3SHU POS",
    description: "Seller-side Point of Sale for verified organic products.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f8faf5",
    theme_color: "#065f46",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
