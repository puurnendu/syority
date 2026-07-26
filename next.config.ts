import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Native / Node-only packages — do not bundle (pg needs util/types, etc.)
  serverExternalPackages: [
    "pdfjs-dist",
    "puppeteer",
    "canvas",
    "pg",
    "@prisma/client",
    "@prisma/adapter-pg",
    "xlsx",
  ],
  logging: process.env.NODE_ENV === "development" ? false : undefined,
  experimental: {
    optimizePackageImports: ["react-icons"],
    // Raise body size limit to handle large PDF uploads sent as base64
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
