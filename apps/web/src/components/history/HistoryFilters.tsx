import Link from 'next/link';
import type { LotterySummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { HELP_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, SELECT_CLASS } from '../form-styles';

export interface HistoryFilterValues {
  lotteryId?: string;
  from?: string;
  to?: string;
  drawCode?: string;
}

interface Props {
  locale: Locale;
  messages: Messages;
  lotteries: LotterySummary[];
  values: HistoryFilterValues;
}

/**
 * Plain GET form: the resulting URL is shareable and the page works without
 * JavaScript. Only lottery id, dates and a draw code ever appear here — never a
 * ticket number.
 */
export function HistoryFilters({ locale, messages, lotteries, values }: Props) {
  const m = messages.history;
  return (
    <form method="get" action={`/${locale}/history`} aria-labelledby="history-filters-title" data-testid="history-filters" className="card px-5 py-5 sm:px-7">
      <h2 id="history-filters-title" className="text-[1.25rem] font-bold leading-tight">
        {m.filtersTitle}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="history-lottery" className={LABEL_CLASS}>
            {m.lottery}
          </label>
          <select id="history-lottery" name="lottery" defaultValue={values.lotteryId ?? ''} className={SELECT_CLASS}>
            <option value="">{m.allLotteries}</option>
            {lotteries.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="history-from" className={LABEL_CLASS}>
            {m.from}
          </label>
          <input id="history-from" name="from" type="date" defaultValue={values.from ?? ''} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="history-to" className={LABEL_CLASS}>
            {m.to}
          </label>
          <input id="history-to" name="to" type="date" defaultValue={values.to ?? ''} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="history-code" className={LABEL_CLASS}>
            {m.drawCode}
          </label>
          <input id="history-code" name="code" type="text" defaultValue={values.drawCode ?? ''} maxLength={32} autoComplete="off" spellCheck={false} autoCapitalize="characters" aria-describedby="history-code-help" className={`${INPUT_CLASS} tabular uppercase`} />
          <p id="history-code-help" className={HELP_CLASS}>
            {m.drawCodeHelp}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" data-testid="history-apply" className={PRIMARY_BUTTON_CLASS}>
          {m.apply}
        </button>
        <Link href={`/${locale}/history`} data-testid="history-reset" className={SECONDARY_BUTTON_CLASS}>
          {m.reset}
        </Link>
      </div>
    </form>
  );
}
