/** Formats integer cents into a decimal string, e.g. 125050 -> "1,250.50". */
export function formatMoney(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length > 10 ? iso : iso + "T00:00:00Z");
  return d.toLocaleDateString("en-ZA");
}
