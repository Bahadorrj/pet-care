/**
 * Jalali date helpers — extracted from TaskFormScreen so QuickAddScreen can
 * share them without duplication. Logic is unchanged; only the location moved.
 *
 * Tehran offset is a fixed +03:30 (no DST in Iran).
 */

import { format, parse as parseJalali } from 'date-fns-jalali';

/**
 * Current Tehran calendar day as a Jalali string yyyy/MM/dd.
 * Builds a Date whose UTC fields represent the Tehran wall-clock time, then
 * reconstructs as a plain local-midnight Date so date-fns-jalali reads the
 * Tehran day correctly.
 */
export function tehranTodayJalali(): string {
  const tehranMs = Date.now() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  const tehranMidnight = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(tehranMidnight, 'yyyy/MM/dd');
}

/**
 * Convert a stored UTC ISO instant to the Jalali yyyy/MM/dd of its Tehran
 * calendar day (+03:30). Used to prefill edit-mode date fields. Slicing the
 * raw UTC date is wrong: a Tehran 00:00 instant is the prior UTC day.
 */
export function utcIsoToTehranJalali(isoUtc: string): string {
  try {
    const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
    const d = new Date(tehranMs);
    const tehranMidnight = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return format(tehranMidnight, 'yyyy/MM/dd');
  } catch {
    return '';
  }
}

/**
 * Parse a user-typed Jalali yyyy/MM/dd into a Gregorian YYYY-MM-DD string.
 * Returns null on invalid input — caller must reject with a validation error.
 */
export function jalaliToGregorian(jalaliStr: string): string | null {
  try {
    const parsed = parseJalali(jalaliStr, 'yyyy/MM/dd', new Date());
    if (isNaN(parsed.getTime())) return null;
    const yr = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, '0');
    const dy = String(parsed.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  } catch {
    return null;
  }
}

/** Latin digits → Persian digits, for display only (never feed back into parsers). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}
