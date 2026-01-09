import { JWT_EXPIRY } from '@/lib/constants'

/**
 * JWT utility functions
 */

/**
 * Parse JWT_EXPIRES_IN or JWT_REFRESH_EXPIRES_IN to milliseconds
 *
 * Supported formats: "15m", "1h", "7d", "30s"
 * Defaults: 15 minutes for access tokens, 7 days for refresh tokens
 *
 * @param envVar - The environment variable value (e.g., "15m", "1h", "7d")
 * @param defaultMs - Default milliseconds to return if parsing fails (optional)
 * @returns Milliseconds
 */
export function parseExpiresIn(envVar: string | undefined, defaultMs?: number): number {
  if (!envVar) {
    return defaultMs ?? JWT_EXPIRY.DEFAULT_ACCESS
  }

  const match = envVar.match(/(\d+)([dhms])/i)
  if (match) {
    const value = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()
    const multipliers: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 }
    return value * (multipliers[unit] || 1) * 1000
  }

  // Use provided default or fallback based on context
  if (defaultMs !== undefined) {
    return defaultMs
  }

  // Fallback defaults
  if (envVar.includes('refresh')) return JWT_EXPIRY.DEFAULT_REFRESH
  return JWT_EXPIRY.DEFAULT_ACCESS
}
