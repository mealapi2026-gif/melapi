import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/appoli/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
