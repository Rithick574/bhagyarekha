import { ImportEntrySchema, type ImportEntry, type ImportRowError } from '@bhagyarekha/contracts';

export interface ParsedRows {
  rows: { row: number; entry: ImportEntry }[];
  errors: ImportRowError[];
  totalRows: number;
}

const CSV_HEADER = ['categoryCode', 'series', 'number'];

/**
 * Minimal RFC 4180 CSV parser for exactly three string columns. Values are
 * never trimmed of inner content or interpreted as numbers; a spreadsheet that
 * dropped leading zeros produces a WRONG_LENGTH error later, never a guess.
 */
export function parseCsvRows(text: string, maxEntries: number): ParsedRows {
  const errors: ImportRowError[] = [];
  const rows: ParsedRows['rows'] = [];
  const lines = splitCsvLines(text);
  if (lines.length === 0) return { rows, errors: [{ row: 0, path: 'csv', code: 'EMPTY', message: 'The file has no rows' }], totalRows: 0 };
  const header = parseCsvLine(lines[0] as string).map((h) => h.trim());
  if (header.length !== 3 || header.some((h, i) => h !== CSV_HEADER[i])) {
    return { rows, errors: [{ row: 1, path: 'csv', code: 'BAD_HEADER', message: `Header must be exactly: ${CSV_HEADER.join(',')}` }], totalRows: 0 };
  }
  const dataLines = lines.slice(1).filter((l) => l.trim() !== '');
  if (dataLines.length > maxEntries) {
    return { rows, errors: [{ row: 0, path: 'csv', code: 'TOO_MANY_ROWS', message: `At most ${maxEntries} entries per import; got ${dataLines.length}` }], totalRows: dataLines.length };
  }
  dataLines.forEach((line, i) => {
    const row = i + 2; // 1-based, header is row 1
    const cells = parseCsvLine(line);
    if (cells.length !== 3) {
      errors.push({ row, path: 'csv', code: 'WRONG_COLUMN_COUNT', message: `Expected 3 columns, found ${cells.length}` });
      return;
    }
    validateEntry(row, { categoryCode: cells[0]?.trim() ?? '', series: (cells[1] ?? '').trim().toUpperCase(), number: (cells[2] ?? '').trim() }, rows, errors);
  });
  return { rows, errors, totalRows: dataLines.length };
}

export function parseJsonRows(entries: unknown[], maxEntries: number): ParsedRows {
  const errors: ImportRowError[] = [];
  const rows: ParsedRows['rows'] = [];
  if (entries.length > maxEntries) {
    return { rows, errors: [{ row: 0, path: 'entries', code: 'TOO_MANY_ROWS', message: `At most ${maxEntries} entries per import; got ${entries.length}` }], totalRows: entries.length };
  }
  entries.forEach((raw, i) => {
    const row = i + 1;
    if (typeof raw !== 'object' || raw === null) {
      errors.push({ row, path: 'entries', code: 'NOT_AN_OBJECT', message: 'Entry must be an object' });
      return;
    }
    const r = raw as Record<string, unknown>;
    for (const key of ['categoryCode', 'series', 'number']) {
      if (key in r && typeof r[key] !== 'string') {
        errors.push({ row, path: key, code: 'STRING_REQUIRED', message: `${key} must be a string (numbers lose leading zeros)` });
        return;
      }
    }
    validateEntry(row, { categoryCode: String(r.categoryCode ?? '').trim(), series: String(r.series ?? '').trim().toUpperCase(), number: String(r.number ?? '').trim() }, rows, errors);
  });
  return { rows, errors, totalRows: entries.length };
}

function validateEntry(row: number, candidate: { categoryCode: string; series: string; number: string }, rows: ParsedRows['rows'], errors: ImportRowError[]): void {
  const parsed = ImportEntrySchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? 'row');
      errors.push({ row, path, code: path === 'number' ? 'DIGITS_REQUIRED' : path === 'series' ? 'LETTERS_REQUIRED' : 'INVALID', message: `${path}: ${issue.message}` });
    }
    return;
  }
  rows.push({ row, entry: parsed.data });
}

function splitCsvLines(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) out.push(current);
  return out.filter((l, idx) => !(idx === 0 && l.charCodeAt(0) === 0xfeff && l.length === 0)).map((l, idx) => (idx === 0 ? l.replace(/^﻿/, '') : l));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}
