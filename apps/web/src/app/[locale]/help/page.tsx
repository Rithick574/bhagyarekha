import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMessages, isLocale } from '@/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).help.title };
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale).help;
  const sections: { id: string; title: string; body: string }[] = [
    { id: 'select-draw', title: m.selectDrawTitle, body: m.selectDrawBody },
    { id: 'series', title: m.seriesTitle, body: m.seriesBody },
    { id: 'official', title: m.officialTitle, body: m.officialBody },
    { id: 'statistics', title: m.statsTitle, body: m.statsBody },
    { id: 'independent', title: m.independentTitle, body: m.independentBody },
    { id: 'report', title: m.reportTitle, body: m.reportBody },
    { id: 'privacy', title: m.privacyTitle, body: m.privacyBody },
  ];
  return (
    <article className="space-y-4">
      <header className="card px-5 py-6 sm:px-7">
        <h1 className="text-[1.75rem] font-bold leading-tight">{m.title}</h1>
        <p className="mt-3 text-ink-secondary">{m.intro}</p>
      </header>
      <nav aria-label={m.title} className="card px-5 py-4 sm:px-7">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="touch-target inline-flex items-center font-semibold text-primary underline decoration-2 underline-offset-4">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="card px-5 py-5 sm:px-7">
          <h2 id={`${s.id}-title`} className="text-[1.35rem] font-bold leading-tight">
            {s.title}
          </h2>
          <p className="mt-2 text-ink-secondary">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
