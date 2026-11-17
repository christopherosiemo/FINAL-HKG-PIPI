import type { MetadataRoute } from 'next';
import { pageTitles } from '@/lib/content';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.BETTER_AUTH_URL || 'https://hkgpipi.com';
  return ['', ...Object.keys(pageTitles)]
    .filter((x) => x !== 'checkout-policies')
    .map((x) => ({
      url: `${base}/${x}`,
      changeFrequency: 'monthly',
      priority: x === '' ? 1 : 0.7,
    }));
}
