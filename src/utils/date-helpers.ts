// =============================================================================
// Date Helper Utilities
// SAM.gov uses MM/dd/yyyy, USASpending uses YYYY-MM-DD
// =============================================================================

/**
 * Convert ISO date (YYYY-MM-DD) to SAM.gov format (MM/dd/yyyy)
 */
export function isoToSamDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

/**
 * Convert SAM.gov date (MM/dd/yyyy) to ISO format (YYYY-MM-DD)
 */
export function samDateToIso(samDate: string): string {
  const [month, day, year] = samDate.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Calculate days from now to a given date string (YYYY-MM-DD or ISO 8601).
 * Positive = future, negative = past.
 */
export function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Get a date N months ago as YYYY-MM-DD string.
 */
export function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

/**
 * Get a date N months from now as YYYY-MM-DD string.
 */
export function monthsFromNowIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/**
 * Get a date N days ago in SAM.gov format (MM/dd/yyyy).
 */
export function daysAgoSamFormat(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoToSamDate(d.toISOString().split("T")[0]);
}

/**
 * Get today's date in SAM.gov format (MM/dd/yyyy).
 */
export function todaySamFormat(): string {
  return isoToSamDate(new Date().toISOString().split("T")[0]);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get current ISO 8601 timestamp.
 */
export function nowIso8601(): string {
  return new Date().toISOString();
}

/**
 * Parse amount that may come as string (SAM.gov) or number (USASpending).
 * Returns 0 for null/undefined/NaN.
 */
export function parseAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(num) ? 0 : num;
}
