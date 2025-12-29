import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../types/auth'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return JWT_SECRET
}

export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  // Note: as any cast needed due to jsonwebtoken@9.x type definition issues with expiresIn
  return jwt.sign(payload, getSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'smmp',
    audience: 'smmp-api',
  } as any)
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as any)
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getSecret(), {
      issuer: 'smmp',
      audience: 'smmp-api',
    }) as JwtPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token')
    }
    throw error
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}
