import { describe, expect, it } from 'vitest';
import { HistorySearchRequestSchema, StatisticsQuerySchema, spanDays } from '../src/index.js';

describe('history/statistics contracts', () => {
  it('bounds the statistics range to 366 days and orders dates', () => {
    expect(spanDays('2026-01-01', '2026-12-31')).toBe(365);
    expect(spanDays('2024-01-01', '2024-12-31')).toBe(366);
    expect(StatisticsQuerySchema.safeParse({ lotteryId: 'a0000001-0000-4000-8000-000000000001', from: '2024-01-01', to: '2024-12-31' }).success).toBe(true);
    expect(StatisticsQuerySchema.safeParse({ lotteryId: 'a0000001-0000-4000-8000-000000000001', from: '2024-01-01', to: '2025-01-01' }).success).toBe(false);
    expect(StatisticsQuerySchema.safeParse({ lotteryId: 'a0000001-0000-4000-8000-000000000001', from: '2026-02-01', to: '2026-01-01' }).success).toBe(false);
    expect(StatisticsQuerySchema.parse({ lotteryId: 'a0000001-0000-4000-8000-000000000001', from: '2026-01-01', to: '2026-01-31' }).metric).toBe('FIRST_PRIZE');
  });
  it('keeps searched numbers as digit strings and rejects junk', () => {
    expect(HistorySearchRequestSchema.parse({ searchType: 'SUFFIX', number: '0042' })).toMatchObject({ number: '0042', page: 1, pageSize: 20 });
    expect(HistorySearchRequestSchema.safeParse({ searchType: 'FULL', number: '12 34' }).success).toBe(false);
    expect(HistorySearchRequestSchema.safeParse({ searchType: 'EXACT', number: '1234' }).success).toBe(false);
  });
});
