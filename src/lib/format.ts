import { CURRENCY } from "./constants";

/** Format an amount as "1,234.50 Birr" (no trailing .00 when whole). */
export function money(amount: number | undefined | null): string {
  const n = Number(amount ?? 0);
  const rounded = Math.round(n * 100) / 100;
  const str = Number.isInteger(rounded)
    ? rounded.toLocaleString("en-US")
    : rounded.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `${str} ${CURRENCY}`;
}

/** Short relative-ish time for history lists. */
export function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function fullName(first: string, last?: string | null): string {
  return last ? `${first} ${last}` : first;
}
