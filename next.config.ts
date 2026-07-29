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
    "ioredis",         // M7.5.1: prevent Redis bundling during build
    "bullmq",          // M7.5.1: prevent BullMQ bundling during build
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
