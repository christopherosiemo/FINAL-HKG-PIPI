import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/portal', '/admin', '/api', '/order', '/activate', '/reset-password', '/start'],
    },
    sitemap: `${process.env.BETTER_AUTH_URL || 'https://hkgpipi.com'}/sitemap.xml`,
  };
}
