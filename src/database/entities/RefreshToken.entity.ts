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
import type { User } from './User.entity'

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

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string

  @ManyToOne('User', 'refreshTokens', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({ type: 'varchar', length: 1000, unique: true })
  token!: string

  @Column({ type: 'timestamp with time zone', name: 'expires_at' })
  expiresAt!: Date

  @Column({
    type: 'enum',
    enum: RefreshTokenStatus,
    default: RefreshTokenStatus.ACTIVE,
  })
  status!: RefreshTokenStatus

  @Column({ type: 'boolean', default: false, name: 'is_remember_me' })
  isRememberMe!: boolean

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null = null

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'revoked_ip' })
  revokedIp: string | null = null

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date
}
