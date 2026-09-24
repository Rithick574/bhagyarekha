import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BhagyaRekha — Kerala Lottery Results & Insights',
    short_name: 'BhagyaRekha',
    description: 'Independent Kerala lottery results and historical statistics. Not an official government application.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F8FA',
    theme_color: '#087F75',
    lang: 'en',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
