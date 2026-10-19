/**
 * Small RFC-4180-compatible CSV reader/writer (no external dependency).
 * Handles quoted fields, escaped quotes (""), commas and newlines inside quotes.
 */

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  // Normalise line endings; strip a possible UTF-8 BOM.
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < t.length) {
    const ch = t[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop trailing fully-empty rows.
  while (rows.length && rows[rows.length - 1]!.every((c) => c.trim() === "")) rows.pop();
  return rows;
}

export function rowsToObjects(rows: string[][]): CsvRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: CsvRow = {};
    headers.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").trim()));
    return obj;
  });
}

export function toCsv(headers: string[], objects: Record<string, unknown>[]): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const obj of objects) {
    lines.push(headers.map((h) => esc(obj[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function isInt(value: string): boolean {
  return /^\d+$/.test(value) && value.length < 16;
}
