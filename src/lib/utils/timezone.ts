/**
 * Timezone utilities for handling UTC+7 (Indochina Time) conversions
 *
 * The application uses UTC+7 as the user-facing timezone for scheduling.
 * All times are stored in UTC in the database.
 */

const UTC_PLUS_7_OFFSET_MS = 7 * 60 * 60 * 1000

/**
 * Convert UTC+7 datetime-local input string to UTC Date for storage
 * @param utcPlus7String - datetime-local input value (YYYY-MM-DDTHH:mm) in UTC+7
 * @returns UTC Date
 *
 * @example
 * utcPlus7ToUtc('2026-01-08T10:00') // Returns Date: 2026-01-08T03:00:00Z
 */
export function utcPlus7ToUtc(utcPlus7String: string): Date {
  const utcPlus7Date = new Date(utcPlus7String)
  // Subtract 7 hours to convert from UTC+7 to UTC
  return new Date(utcPlus7Date.getTime() - UTC_PLUS_7_OFFSET_MS)
}

/**
 * Convert UTC Date to UTC+7 datetime-local input string for display
 * @param utcDate - UTC Date or ISO string
 * @returns datetime-local input format (YYYY-MM-DDTHH:mm) in UTC+7
 *
 * @example
 * utcToUtcPlus7Input('2026-01-08T03:00:00Z') // Returns '2026-01-08T10:00'
 */
export function utcToUtcPlus7Input(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  // Add 7 hours to convert from UTC to UTC+7
  const utcPlus7 = new Date(date.getTime() + UTC_PLUS_7_OFFSET_MS)
  return utcPlus7.toISOString().slice(0, 16)
}

/**
 * Get current time in UTC+7 as datetime-local input string
 * @returns datetime-local input format (YYYY-MM-DDTHH:mm) in UTC+7
 *
 * @example
 * getNowUtcPlus7Input() // Returns '2026-01-08T10:30'
 */
export function getNowUtcPlus7Input(): string {
  const now = new Date()
  // Add 7 hours to convert from UTC to UTC+7
  const utcPlus7 = new Date(now.getTime() + UTC_PLUS_7_OFFSET_MS + now.getTimezoneOffset() * 60 * 1000)
  return utcPlus7.toISOString().slice(0, 16)
}

/**
 * Convert UTC Date to formatted UTC+7 string for display
 * @param utcDate - UTC Date or ISO string
 * @returns Formatted date string in UTC+7 timezone
 *
 * @example
 * utcToUtcPlus7Display('2026-01-08T03:00:00Z') // Returns '1/8/2026, 10:00:00 AM'
 */
export function utcToUtcPlus7Display(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  // Use toLocaleString with Asia/Ho_Chi_Minh timezone to properly convert UTC to UTC+7
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}
