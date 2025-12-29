import bcrypt from 'bcrypt'

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10)

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword)
}

export function isPasswordStrong(password: string): boolean {
  if (password.length < 8) {
    return false
  }
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasUpperCase && hasLowerCase && hasNumber
}
