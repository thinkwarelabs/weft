import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': ['./src/lib/pdf/fonts/**/*', './public/logo.png'],
    '/api/invoices/[id]/finalize': ['./src/lib/pdf/fonts/**/*', './public/logo.png'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
};

export default nextConfig;
