import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Contracts package ships compiled JS; nothing to transpile.
  // Do not auto-generate AGENTS.md / CLAUDE.md inside apps/web; the repo root CLAUDE.md is authoritative.
  agentRules: false,
  /**
   * Same-origin API for the browser: client components call the relative
   * `/api/v1/*` path and Next proxies it to the private API address. This keeps
   * ticket-check requests first-party (no CORS, no cross-site cookies).
   */
  async rewrites() {
    const api = (process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    return [{ source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
