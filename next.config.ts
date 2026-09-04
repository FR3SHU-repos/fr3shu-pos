import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mongoose keeps long-lived connections and uses dynamic requires — keep it out of the bundle.
  serverExternalPackages: ["mongoose"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
