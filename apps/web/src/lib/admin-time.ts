/**
 * Pure helpers for the admin forms. Draw instants are entered as Asia/Kolkata
 * wall-clock values and stored as UTC ISO strings; the database additionally
 * checks that an instant agrees with its local date in IST.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** `YYYY-MM-DDTHH:mm` (datetime-local, interpreted as IST) → UTC ISO string, or null when malformed. */
export function istLocalToUtcIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? '0')) - IST_OFFSET_MINUTES * 60_000;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible calendar values that Date.UTC silently rolls over.
  if (date.getUTCFullYear() < 1900) return null;
  const back = utcIsoToIstLocal(date.toISOString());
  return back?.startsWith(`${y}-${mo}-${d}T${h}:${mi}`) ? date.toISOString() : null;
}

/** UTC ISO string → `YYYY-MM-DDTHH:mm` in IST for a datetime-local input. */
export function utcIsoToIstLocal(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** IST calendar date (`YYYY-MM-DD`) of a UTC ISO instant. */
export function utcIsoToIstDate(iso: string): string | null {
  return utcIsoToIstLocal(iso)?.slice(0, 10) ?? null;
}

/**
 * Rupees typed by an operator ("1,00,000", "1000.50") → integer paise string, or
 * null when not a valid amount. Never uses floating-point arithmetic.
 */
export function rupeesToMinor(input: string): string | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = match[1] as string;
  const paise = (match[2] ?? '').padEnd(2, '0');
  const combined = `${rupees}${paise}`.replace(/^0+(?=\d)/, '');
  return combined.length > 18 ? null : combined;
}

/** Integer paise string → rupees text for an input field ("10000000" → "100000"). */
export function minorToRupeesInput(minor: string | null): string {
  if (minor === null || !/^\d+$/.test(minor)) return '';
  const padded = minor.padStart(3, '0');
  const rupees = padded.slice(0, -2);
  const paise = padded.slice(-2);
  return paise === '00' ? rupees : `${rupees}.${paise}`;
}

export interface ParsedEntryLine {
  series: string;
  number: string;
}

/**
 * Parses operator-typed entry lines for a correction: `AC 000321` or `0321`
 * (no series). Whitespace-separated; nothing is padded or stripped. Returns the
 * 1-based line numbers that could not be parsed.
 */
export function parseEntryLines(text: string): { entries: ParsedEntryLine[]; badLines: number[] } {
  const entries: ParsedEntryLine[] = [];
  const badLines: number[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const parts = line.split(/\s+/);
    if (parts.length === 1 && /^[0-9]{1,12}$/.test(parts[0] as string)) {
      entries.push({ series: '', number: parts[0] as string });
    } else if (parts.length === 2 && /^[A-Za-z]{1,8}$/.test(parts[0] as string) && /^[0-9]{1,12}$/.test(parts[1] as string)) {
      entries.push({ series: (parts[0] as string).toUpperCase(), number: parts[1] as string });
    } else {
      badLines.push(index + 1);
    }
  });
  return { entries, badLines };
}
