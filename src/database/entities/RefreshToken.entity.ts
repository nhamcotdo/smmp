import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from './User.entity'

export enum RefreshTokenStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Entity('refresh_tokens')
@Index('idx_refresh_tokens_user_id', ['userId'])
@Index('idx_refresh_tokens_token', ['token'])
@Index('idx_refresh_tokens_expires_at', ['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id' })
  userId!: string

  @ManyToOne('User', 'refreshTokens', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({ unique: true })
  token!: string

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt!: Date

  @Column({
    type: 'enum',
    enum: RefreshTokenStatus,
    default: RefreshTokenStatus.ACTIVE,
  })
  status!: RefreshTokenStatus

  @Column({ type: 'boolean', default: false, name: 'is_remember_me' })
  isRememberMe!: boolean

  @Column({ type: 'timestamp', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null = null

  @Column({ type: 'varchar', nullable: true, name: 'revoked_ip' })
  revokedIp: string | null = null

  @Column({ type: 'timestamp', name: 'created_at' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @Column({ type: 'timestamp', name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
