import { describe, expect, it } from 'vitest';
import { flattenMessages, switchLocalePath, t } from './index';
import { en } from './messages/en';
import { ml } from './messages/ml';

describe('message catalogues', () => {
  const flatEn = flattenMessages(en);
  const flatMl = flattenMessages(ml as unknown as Record<string, unknown>);

  it('ml defines exactly the same keys as en', () => {
    expect(Object.keys(flatMl).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('has no empty strings in either language', () => {
    for (const [key, value] of Object.entries(flatEn)) expect(value.trim(), key).not.toBe('');
    for (const [key, value] of Object.entries(flatMl)) expect(value.trim(), key).not.toBe('');
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatMl[key] ?? ''), key).toEqual(placeholders(flatEn[key] ?? ''));
    }
  });
});

describe('t', () => {
  it('interpolates placeholders and leaves unknown ones visible', () => {
    expect(t('Draw {code}', { code: 'DA-14' })).toBe('Draw DA-14');
    expect(t('Page {page} of {pages}', { page: 2 })).toBe('Page 2 of {pages}');
  });
});

describe('switchLocalePath', () => {
  it('swaps the locale segment', () => {
    expect(switchLocalePath('/en/results/abc', 'ml')).toBe('/ml/results/abc');
    expect(switchLocalePath('/ml', 'en')).toBe('/en');
    expect(switchLocalePath('/', 'ml')).toBe('/ml/');
  });
});
