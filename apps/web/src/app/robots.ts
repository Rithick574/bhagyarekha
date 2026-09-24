import type { MetadataRoute } from 'next';
import { getDataMode } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const mode = await getDataMode();
  // Demo deployments (and unknown state) must never be indexed as if they were results.
  if (mode !== 'live') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }] };
}
