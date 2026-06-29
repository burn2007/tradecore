import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      // Google Fonts — CacheFirst, 30 day expiration
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      // Next.js static assets — CacheFirst, 30 day expiration
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      // Authenticated API routes are intentionally excluded — serving
      // another user's cached response is a critical data-isolation bug.
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence the workspace-root warning caused by multiple lockfiles in parent dirs
  outputFileTracingRoot: process.cwd(),
  // Prevent webpack from bundling the Neon serverless driver.
  // When bundled it uses a browser-compat fetch shim that breaks in Node.js
  // and causes UND_ERR_CONNECT_TIMEOUT. Marking it external lets it run as
  // a native Node module using Node's built-in fetch instead.
  serverExternalPackages: ["@neondatabase/serverless"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default withPWA(nextConfig);
