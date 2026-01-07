import { NextRequest } from 'next/server'

/**
 * Get the base URL from the request headers
 * Uses the Host header to construct the correct URL for the current environment
 *
 * @param request - The Next.js request object
 * @returns The base URL (protocol + host)
 *
 * @example
 * const baseUrl = getBaseUrl(request)
 * // On localhost: "http://localhost:3000"
 * // On production: "https://yourdomain.com"
 */
export function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}
