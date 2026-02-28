/**
 * Utility functions for formatting values in the UI.
 */

/**
 * Format disk runtime hours into human-readable format.
 *
 * @param hours - Total power-on hours (e.g., 58954)
 * @param locale - 'he' for Hebrew format, 'en' for English (default)
 * @returns Formatted string like "6y 8m 26d" or "6ש 8ח 26י"
 *
 * @example
 * formatRuntime(58954, 'en') // "6y 8m 26d"
 * formatRuntime(58954, 'he') // "6ש 8ח 26י"
 * formatRuntime(720, 'en')   // "1m 0d"
 * formatRuntime(48, 'en')    // "2d"
 * formatRuntime(null)        // "-"
 */
export function formatRuntime(
  hours: number | null | undefined,
  locale: string = 'en'
): string {
  if (hours == null || hours < 0) {
    return '-';
  }

  // Constants for conversion
  const HOURS_PER_DAY = 24;
  const DAYS_PER_MONTH = 30; // Average month
  const DAYS_PER_YEAR = 365;

  // Calculate components
  const totalDays = Math.floor(hours / HOURS_PER_DAY);
  const years = Math.floor(totalDays / DAYS_PER_YEAR);
  const remainingDaysAfterYears = totalDays % DAYS_PER_YEAR;
  const months = Math.floor(remainingDaysAfterYears / DAYS_PER_MONTH);
  const days = remainingDaysAfterYears % DAYS_PER_MONTH;

  // Localized suffixes
  const suffixes = locale === 'he'
    ? { year: 'ש', month: 'ח', day: 'י' }  // שנים, חודשים, ימים
    : { year: 'y', month: 'm', day: 'd' };

  // Build parts array (only include non-zero values, except days which is always shown if there are years/months)
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years}${suffixes.year}`);
  }

  if (months > 0 || years > 0) {
    parts.push(`${months}${suffixes.month}`);
  }

  // Always show days if we have years or months, or if it's the only value
  if (days > 0 || parts.length > 0 || totalDays === 0) {
    parts.push(`${days}${suffixes.day}`);
  }

  // If less than 1 day, show hours
  if (totalDays === 0 && hours > 0) {
    const hourSuffix = locale === 'he' ? 'ש\'' : 'h';
    return `${hours}${hourSuffix}`;
  }

  return parts.join(' ');
}

/**
 * Format temperature value with unit.
 *
 * @param temp - Temperature in Celsius
 * @returns Formatted string like "40°C" or "-"
 */
export function formatTemperature(temp: number | null | undefined): string {
  if (temp == null) {
    return '-';
  }
  return `${temp}°C`;
}
