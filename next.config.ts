import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg', 'pg-boss'],
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: {
    '*': [
      '.env',
      '.env.*',
      '.local/**',
      '.data/**',
      'tests/**',
      'e2e/**',
      'test-results/**',
      'playwright-report/**',
      'work/**',
      'docs/**',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com; base-uri 'self'; object-src 'none'`,
          },
        ],
      },
      ...['/order/:path*', '/payments/test/:path*', '/portal/:path*', '/admin/:path*'].map(
        (source) => ({
          source,
          headers: [
            { key: 'Referrer-Policy', value: 'no-referrer' },
            { key: 'Cache-Control', value: 'private, no-store' },
          ],
        }),
      ),
    ];
  },
};
export default config;
