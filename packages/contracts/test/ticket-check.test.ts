import { describe, expect, it } from 'vitest';
import { TicketCheckRequestSchema } from '../src/index.js';

const base = { lotteryId: 'a0000001-0000-4000-8000-000000000001', drawId: 'd0000001-0000-4000-8000-000000000039' };

describe('TicketCheckRequestSchema', () => {
  it('keeps the raw strings untouched (normalisation happens in the domain)', () => {
    const parsed = TicketCheckRequestSchema.parse({ ...base, series: ' ab ', number: ' 001234 ' });
    expect(parsed.series).toBe(' ab ');
    expect(parsed.number).toBe(' 001234 ');
  });
  it('bounds lengths and rejects unknown keys and numeric numbers', () => {
    expect(TicketCheckRequestSchema.safeParse({ ...base, series: 'AA', number: '1'.repeat(33) }).success).toBe(false);
    expect(TicketCheckRequestSchema.safeParse({ ...base, series: 'AA', number: '' }).success).toBe(false);
    expect(TicketCheckRequestSchema.safeParse({ ...base, series: 'AA', number: 1234 }).success).toBe(false);
    expect(TicketCheckRequestSchema.safeParse({ ...base, series: 'AA', number: '1234', extra: 1 }).success).toBe(false);
  });
});
