import { PLATFORM_ICONS, STATUS_COLORS, MEDIA_ICONS } from '@/lib/constants'

/**
 * Get platform icon with case-insensitive lookup
 */
export function getPlatformIcon(platform: string): string {
  const platformUpper = platform.toUpperCase()
  return PLATFORM_ICONS[platformUpper as keyof typeof PLATFORM_ICONS] || PLATFORM_ICONS.DEFAULT
}

/**
 * Get status color classes with case-insensitive lookup
 */
export function getStatusColor(status: string): string {
  const statusUpper = status.toUpperCase()
  return STATUS_COLORS[statusUpper as keyof typeof STATUS_COLORS] || STATUS_COLORS.DEFAULT
}

/**
 * Get status badge component data with color styling
 */
export function getStatusBadge(status: string): { className: string; label: string } {
  const statusUpper = status.toUpperCase()
  const className = STATUS_COLORS[statusUpper as keyof typeof STATUS_COLORS] || STATUS_COLORS.DEFAULT
  const label = status.toLowerCase()
  return { className, label }
}

/**
 * Get media icon with case-insensitive lookup
 */
export function getMediaIcon(type: string): string {
  const typeUpper = type.toUpperCase()
  return MEDIA_ICONS[typeUpper as keyof typeof MEDIA_ICONS] || MEDIA_ICONS.DEFAULT
}