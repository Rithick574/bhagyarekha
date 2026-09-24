import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:3001';

interface DrawSummaryLite {
  id: string;
  publicationStatus: 'NOT_PUBLISHED' | 'PARTIAL' | 'COMPLETE' | 'SUSPENDED' | 'CANCELLED';
  firstPrize: { entries: { series: string; number: string }[] } | null;
  currentRevision: { isCorrection: boolean } | null;
  lotteryName: { en: string; ml: string };
  drawCode: string;
}

/** Pulls the seeded draw list straight from the API so tests do not hard-code fixture IDs. */
export async function fetchDraws(request: APIRequestContext): Promise<DrawSummaryLite[]> {
  const items: DrawSummaryLite[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await request.get(`${API}/api/v1/draws?page=${page}&pageSize=100`);
    expect(res.ok(), `GET /draws page ${page}`).toBeTruthy();
    const body = (await res.json()) as { items: DrawSummaryLite[]; total: number };
    items.push(...body.items);
    if (items.length >= body.total) break;
  }
  return items;
}

export async function fetchLatest(request: APIRequestContext) {
  const res = await request.get(`${API}/api/v1/draws/latest`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { dataMode: 'demo' | 'live'; latestPublished: DrawSummaryLite | null; pendingDraw: DrawSummaryLite | null; asOfDate: string };
}

export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth);
}
