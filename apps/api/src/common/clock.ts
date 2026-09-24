import { Injectable } from '@nestjs/common';

export const KOLKATA_TIME_ZONE = 'Asia/Kolkata';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOLKATA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Formats an instant as the IST calendar date `YYYY-MM-DD`. */
export function toKolkataDate(instant: Date): string {
  return ymdFormatter.format(instant);
}

/** Injectable time source so tests can fix "today" (LLD §6: pending-draw selection). */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
  todayInKolkata(): string {
    return toKolkataDate(this.now());
  }
}

export class FixedClock extends Clock {
  constructor(private readonly fixed: Date) {
    super();
  }
  override now(): Date {
    return this.fixed;
  }
}
