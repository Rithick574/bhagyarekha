import Link from 'next/link';
import type { LotterySummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { HELP_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, SELECT_CLASS } from '../form-styles';

interface Props {
  locale: Locale;
  messages: Messages;
  lotteries: LotterySummary[];
  values: { lotteryId: string; from: string; to: string };
}

/** Plain GET form: lottery and inclusive IST dates only. Shareable, JS-free. */
export function StatisticsFilters({ locale, messages, lotteries, values }: Props) {
  const m = messages.statistics;
  return (
    <form method="get" action={`/${locale}/statistics`} aria-labelledby="stats-filters-title" data-testid="stats-filters" className="card px-5 py-5 sm:px-7">
      <h2 id="stats-filters-title" className="text-[1.25rem] font-bold leading-tight">
        {m.filtersTitle}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="stats-lottery" className={LABEL_CLASS}>
            {m.lottery}
          </label>
          <select id="stats-lottery" name="lottery" defaultValue={values.lotteryId} className={SELECT_CLASS}>
            {lotteries.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stats-from" className={LABEL_CLASS}>
            {m.from}
          </label>
          <input id="stats-from" name="from" type="date" defaultValue={values.from} required aria-describedby="stats-range-help" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="stats-to" className={LABEL_CLASS}>
            {m.to}
          </label>
          <input id="stats-to" name="to" type="date" defaultValue={values.to} required aria-describedby="stats-range-help" className={INPUT_CLASS} />
          <p id="stats-range-help" className={HELP_CLASS}>
            {m.rangeHelp}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" data-testid="stats-apply" className={PRIMARY_BUTTON_CLASS}>
          {m.apply}
        </button>
        <Link href={`/${locale}/statistics${values.lotteryId ? `?lottery=${encodeURIComponent(values.lotteryId)}` : ''}`} data-testid="stats-reset" className={SECONDARY_BUTTON_CLASS}>
          {m.reset}
        </Link>
      </div>
    </form>
  );
}
