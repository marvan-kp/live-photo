import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["sharp"],
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
  async headers() {
    return [
      {
        source: "/api/reels/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/api/photos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30, stale-while-revalidate=120",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
