/**
 * OAuth State Management Service
 * Stores and validates OAuth state tokens to prevent CSRF attacks
 *
 * TODO: For production, use Redis or database with TTL instead of in-memory Map
 */

interface OAuthState {
  userId: string
  expiresAt: number
}

const stateStore = new Map<string, OAuthState>()

/**
 * Generate a cryptographically secure state token
 */
function generateStateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create and store a state token for a user
 * @param userId - The user ID initiating the OAuth flow
 * @param expiresIn - Time until token expires (default: 10 minutes)
 * @returns The state token
 */
export function createState(userId: string, expiresIn: number = 10 * 60 * 1000): string {
  const state = generateStateToken()
  const expiresAt = Date.now() + expiresIn

  stateStore.set(state, { userId, expiresAt })

  // Clean up expired states
  cleanupExpiredStates()

  return state
}

/**
 * Validate and consume a state token
 * @param state - The state token to validate
 * @returns The user ID if valid, null otherwise
 */
export function validateState(state: string): string | null {
  const stateData = stateStore.get(state)

  if (!stateData) {
    return null
  }

  // Check if expired
  if (Date.now() > stateData.expiresAt) {
    stateStore.delete(state)
    return null
  }

  // Consume the state (one-time use)
  stateStore.delete(state)

  return stateData.userId
}

/**
 * Clean up expired state tokens
 */
function cleanupExpiredStates(): void {
  const now = Date.now()
  for (const [state, data] of stateStore.entries()) {
    if (now > data.expiresAt) {
      stateStore.delete(state)
    }
  }
}
