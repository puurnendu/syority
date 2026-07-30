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

  // M7.6F — Production Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
