import { getConnection } from '../db/connection'
import { User } from '../../database/entities/User.entity'

export async function verifyJwtToken(token: string) {
  const { verifyToken } = await import('./jwt')
  const payload = verifyToken(token)

  const dataSource = await getConnection()
  const userRepository = dataSource.getRepository(User)

  const user = await userRepository.findOne({
    where: { id: payload.sub, isActive: true },
    select: [
      'id',
      'email',
      'name',
      'role',
      'isActive',
      'emailVerified',
      'avatar',
      'createdAt',
      'updatedAt',
    ],
  })

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive')
  }

  return user
}
