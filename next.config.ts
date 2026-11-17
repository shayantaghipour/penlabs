import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // IP کامپیوتر تو شبکه محلی (از ipconfig) برای تست از گوشی
  allowedDevOrigins: ["192.168.1.103"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;