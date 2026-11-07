import type { NextConfig } from 'next';

// Baseline browser protections for every route. Framing is limited to our own
// origin because the design and email previews render same-origin iframes.
// A script-src CSP is deliberately not set here: it needs per-request nonces
// for Next.js inline scripts and should be introduced and tested on its own.
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  experimental: {
    // Two 5 MB site images may upload in one action so Cloudinary work can run in parallel.
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
