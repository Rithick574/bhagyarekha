import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { DrawDetail, DrawSummary } from '@bhagyarekha/contracts';
import { TicketChecker } from '@/components/check/TicketChecker';
import { Notice } from '@/components/Notices';
import { UnavailableState } from '@/components/States';
import { getMessages, isLocale } from '@/i18n';
import { getDraw, getLatest, listDraws, listLotteries } from '@/lib/api';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).check.title };
}

export default async function CheckPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ draw?: string | string[] }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const sp = await searchParams;
  const drawParam = Array.isArray(sp.draw) ? sp.draw[0] : sp.draw;
  // Only a draw identifier may arrive via the URL — never ticket data.
  const preselect = drawParam && UUID.test(drawParam) ? drawParam : undefined;

  const [lotteries, latest] = await Promise.all([listLotteries({ active: true }), getLatest()]);
  if (!lotteries.ok) {
    return (
      <div className="space-y-4">
        <h1 className="sr-only">{messages.check.title}</h1>
        <UnavailableState messages={messages} retryHref={`/${locale}/check`} />
      </div>
    );
  }

  let initialDraw: DrawDetail | null = null;
  let initialDraws: DrawSummary[] | undefined;
  if (preselect) {
    const detail = await getDraw(preselect);
    if (detail.ok) {
      initialDraw = detail.data;
      const draws = await listDraws({ lotteryId: detail.data.lotteryId, pageSize: 50 });
      initialDraws = draws.ok ? draws.data.items : [detail.data];
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{messages.check.title}</h1>
      <TicketChecker
        locale={locale}
        messages={messages}
        lotteries={lotteries.data.items}
        initialLotteryId={initialDraw?.lotteryId}
        initialDraws={initialDraws}
        initialDraw={initialDraw}
        asOfDate={latest.ok ? latest.data.asOfDate : undefined}
      />
      <Notice tone="info" iconTitle={messages.a11y.infoIcon}>
        {messages.help.officialBody}
      </Notice>
    </div>
  );
}
