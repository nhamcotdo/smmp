import { NextRequest } from 'next/server'

/**
 * Get the base URL for the application
 *
 * Priority order:
 * 1. APP_BASE_URL environment variable (highest priority)
 * 2. x-forwarded-proto + host headers (for reverse proxy)
 * 3. fallback to localhost
 *
 * @param request - The Next.js request object (optional if APP_BASE_URL is set)
 * @returns The base URL (protocol + host)
 *
 * @example
 * // In .env file:
 * APP_BASE_URL=https://yourdomain.com
 *
 * // In code:
 * const baseUrl = getBaseUrl(request)
 * // Returns: "https://yourdomain.com"
 */
export function getBaseUrl(request?: NextRequest): string {
  // Check environment variable first
  const envBaseUrl = process.env.APP_BASE_URL
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  // Fallback to request headers if request is available
  if (request) {
    const host = request.headers.get('host') ?? 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  // Final fallback to localhost
  return 'http://localhost:3000'
}

