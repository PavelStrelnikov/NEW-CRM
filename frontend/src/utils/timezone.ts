/**
 * Timezone utilities for Israel timezone (Asia/Jerusalem).
 * All user-facing dates should use these functions.
 */
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

/**
 * Format a date/time in Israel timezone.
 * @param date - ISO date string or Date object
 * @param pattern - date-fns format pattern (default: 'dd/MM/yyyy HH:mm')
 */
export function formatIsraelTime(
  date: string | Date | null | undefined,
  pattern: string = 'dd/MM/yyyy HH:mm'
): string {
  if (!date) return '-';
  try {
    return formatInTimeZone(new Date(date), ISRAEL_TIMEZONE, pattern);
  } catch {
    return '-';
  }
}

/**
 * Format date only in Israel timezone.
 */
export function formatIsraelDate(date: string | Date | null | undefined): string {
  return formatIsraelTime(date, 'dd/MM/yyyy');
}

/**
 * Format time only in Israel timezone.
 */
export function formatIsraelTimeOnly(date: string | Date | null | undefined): string {
  return formatIsraelTime(date, 'HH:mm');
}

/**
 * Get zoned Date object for Israel timezone.
 */
export function toIsraelTime(date: string | Date): Date {
  return toZonedTime(new Date(date), ISRAEL_TIMEZONE);
}
