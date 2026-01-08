import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import type { User } from './User.entity'
import type { PostPublication } from './PostPublication.entity'
import type { Post } from './Post.entity'
import { Platform, AccountStatus, AccountHealth } from './enums'

@Entity('social_accounts')
@Index('idx_social_accounts_user_id', ['userId'])
@Index('idx_social_accounts_platform', ['platform'])
@Index('idx_social_accounts_status', ['status'])
@Index('idx_social_accounts_health', ['health'])
@Index('idx_social_accounts_user_platform', ['userId', 'platform'])
@Index('idx_social_accounts_user_platform_unique', ['userId', 'platform', 'platformUserId'], { unique: true })
@Index('idx_social_accounts_expires_at', ['expiresAt'])
export class SocialAccount extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'user_id',
  })
  userId!: string

  @ManyToOne('User', 'socialAccounts', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({
    type: 'enum',
    enum: Platform,
    nullable: false,
  })
  platform!: Platform

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    name: 'platform_user_id',
  })
  platformUserId!: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    name: 'username',
  })
  username!: string

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'display_name',
  })
  displayName!: string

  @Column({
    type: 'varchar',
    length: 2048,
    nullable: true,
    name: 'avatar',
  })
  avatar!: string

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING,
    nullable: false,
  })
  status!: AccountStatus

  @Column({
    type: 'enum',
    enum: AccountHealth,
    default: AccountHealth.UNKNOWN,
    nullable: false,
    name: 'health',
  })
  health!: AccountHealth

  @Column({
    type: 'text',
    nullable: true,
    name: 'access_token',
    select: true,
  })
  accessToken!: string

  @Column({
    type: 'text',
    nullable: true,
    name: 'refresh_token',
    select: true,
  })
  refreshToken!: string

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'token_expires_at',
  })
  tokenExpiresAt!: Date

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'expires_at',
  })
  expiresAt!: Date

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'metadata',
  })
  metadata!: Record<string, unknown>

  @Column({
    type: 'integer',
    default: 0,
    name: 'followers_count',
  })
  followersCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'following_count',
  })
  followingCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'posts_count',
  })
  postsCount!: number

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_synced_at',
  })
  lastSyncedAt!: Date

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_posted_at',
  })
  lastPostedAt!: Date

  @OneToMany('PostPublication', 'socialAccount', {
    cascade: true,
  })
  publications!: PostPublication[]

  @OneToMany('Post', 'socialAccount')
  posts!: Post[]
}
