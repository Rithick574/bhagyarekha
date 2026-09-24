import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/messages/en';
import { describeMatch, filterEntries, statusKeyFor } from './status';

describe('statusKeyFor', () => {
  const base = { displayDate: '2026-09-24' } as const;
  it('distinguishes scheduled from awaiting using the server as-of date', () => {
    expect(statusKeyFor({ ...base, publicationStatus: 'NOT_PUBLISHED', phase: 'SCHEDULED', displayDate: '2026-10-01' }, '2026-09-24')).toBe('scheduled');
    expect(statusKeyFor({ ...base, publicationStatus: 'NOT_PUBLISHED', phase: 'SCHEDULED', displayDate: '2026-09-20' }, '2026-09-24')).toBe('awaiting');
    expect(statusKeyFor({ ...base, publicationStatus: 'NOT_PUBLISHED', phase: 'HELD', displayDate: '2026-09-30' }, '2026-09-24')).toBe('awaiting');
    expect(statusKeyFor({ ...base, publicationStatus: 'NOT_PUBLISHED', phase: 'SCHEDULED' })).toBe('awaiting');
  });
  it('maps the remaining statuses one to one', () => {
    expect(statusKeyFor({ ...base, publicationStatus: 'PARTIAL', phase: 'HELD' })).toBe('partial');
    expect(statusKeyFor({ ...base, publicationStatus: 'COMPLETE', phase: 'HELD' })).toBe('published');
    expect(statusKeyFor({ ...base, publicationStatus: 'SUSPENDED', phase: 'HELD' })).toBe('suspended');
    expect(statusKeyFor({ ...base, publicationStatus: 'CANCELLED', phase: 'CANCELLED' })).toBe('cancelled');
  });
});

describe('describeMatch', () => {
  it('explains each configured match kind in plain words', () => {
    expect(describeMatch(en, { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, 6)).toBe('Series and the full 6-digit number must match.');
    expect(describeMatch(en, { kind: 'FULL_NUMBER', seriesPolicy: 'EXCEPT_ENTRY' }, 6)).toContain('other than the winning series');
    expect(describeMatch(en, { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 }, 6)).toBe('The last 4 digits of the number must match, in any allowed series.');
  });
});

describe('filterEntries', () => {
  const entries = [
    { series: 'AA', number: '001234' },
    { series: 'AB', number: '991234' },
    { series: '', number: '0042' },
  ];
  it('matches exact numbers and endings, preserving leading zeros', () => {
    expect(filterEntries(entries, '001234')).toEqual([entries[0]]);
    expect(filterEntries(entries, '1234')).toEqual([entries[0], entries[1]]);
    expect(filterEntries(entries, '0042')).toEqual([entries[2]]);
    expect(filterEntries(entries, '42')).toEqual([entries[2]]);
  });
  it('returns everything for blank input and nothing for non-digits', () => {
    expect(filterEntries(entries, '  ')).toHaveLength(3);
    expect(filterEntries(entries, '12a')).toEqual([]);
    expect(filterEntries(entries, '1 234')).toEqual([]);
  });
});
