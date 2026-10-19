import type { Db } from "../db/index.js";
import { conflict } from "./errors.js";

/**
 * Allocates the next number from a number series (future AL "No. Series"
 * learning exercise). Must be called inside an open transaction.
 * Format: <PREFIX>-00001 (5-digit zero padded, year-less for simplicity).
 */
export function nextNumber(db: Db, seriesKey: string): string {
  const row = db
    .prepare("SELECT prefix, current_value FROM number_series WHERE key = ?")
    .get(seriesKey) as { prefix: string; current_value: number } | undefined;
  if (!row) throw conflict(`Unknown number series '${seriesKey}'`);
  const nextValue = row.current_value + 1;
  db.prepare("UPDATE number_series SET current_value = ? WHERE key = ?").run(nextValue, seriesKey);
  return `${row.prefix}-${String(nextValue).padStart(5, "0")}`;
}

export function peekNumber(db: Db, seriesKey: string): string {
  const row = db.prepare("SELECT prefix, current_value FROM number_series WHERE key = ?").get(seriesKey) as
    | { prefix: string; current_value: number }
    | undefined;
  if (!row) throw conflict(`Unknown number series '${seriesKey}'`);
  return `${row.prefix}-${String(row.current_value + 1).padStart(5, "0")}`;
}
