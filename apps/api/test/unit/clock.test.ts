import { describe, expect, it } from 'vitest';
import { FixedClock, toKolkataDate } from '../../src/common/clock.js';

describe('toKolkataDate', () => {
  it('converts instants near midnight to the IST calendar date', () => {
    // 23:30 UTC on 23 Sep is 05:00 IST on 24 Sep.
    expect(toKolkataDate(new Date('2026-09-23T23:30:00Z'))).toBe('2026-09-24');
    // 18:00 UTC on 24 Sep is 23:30 IST on 24 Sep.
    expect(toKolkataDate(new Date('2026-09-24T18:00:00Z'))).toBe('2026-09-24');
    // 18:45 UTC on 24 Sep is 00:15 IST on 25 Sep.
    expect(toKolkataDate(new Date('2026-09-24T18:45:00Z'))).toBe('2026-09-25');
  });
  it('FixedClock reports the fixed date', () => {
    expect(new FixedClock(new Date('2026-09-24T12:00:00Z')).todayInKolkata()).toBe('2026-09-24');
  });
});
