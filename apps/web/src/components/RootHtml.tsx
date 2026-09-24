import type { ReactNode } from 'react';
import '@fontsource-variable/noto-sans';
import '@fontsource-variable/noto-sans-malayalam';
import '@/app/globals.css';

/**
 * Applies the saved text-size preference before first paint so the page does not
 * jump after hydration. Reads only a non-sensitive preference key.
 */
const TEXT_SIZE_BOOT = `try{var s=localStorage.getItem('br_text_size');if(s==='large'||s==='xlarge'){document.documentElement.setAttribute('data-text-size',s);}}catch(e){}`;

export function RootHtml({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang}>
      {/* App Router root layout: a literal <head> is correct here. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
