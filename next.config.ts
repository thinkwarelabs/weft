import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': ['./src/lib/pdf/fonts/**/*', './public/logo.png'],
  },
};

export default nextConfig;
