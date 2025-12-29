import type { UserRole } from '../../database/entities/enums'

export interface RegisterRequest {
  email: string
  password: string
  name: string
  role?: UserRole
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: UserResponse
  token: string
  refreshToken?: string
  expiresIn: number
}

export interface UserResponse {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  avatar?: string
  createdAt: string
  updatedAt: string
}

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  iat?: number
  exp?: number
}
