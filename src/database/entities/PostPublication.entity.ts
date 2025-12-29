import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import { Post } from './Post.entity'
import { SocialAccount } from './SocialAccount.entity'
import { Platform, PostStatus } from './enums'

@Entity('post_publications')
@Index('idx_post_publications_post_id', ['postId'])
@Index('idx_post_publications_social_account_id', ['socialAccountId'])
@Index('idx_post_publications_platform', ['platform'])
@Index('idx_post_publications_status', ['status'])
@Index('idx_post_publications_post_status', ['postId', 'status'])
@Index('idx_post_publications_published_at', ['publishedAt'])
@Index(
  'idx_post_publications_post_platform',
  ['postId', 'platform'],
  { unique: true }
)
export class PostPublication extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'post_id',
  })
  postId!: string

  @ManyToOne(() => Post, (post) => post.publications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post!: Post

  @Column({
    type: 'uuid',
    nullable: false,
    name: 'social_account_id',
  })
  socialAccountId!: string

  @ManyToOne(() => SocialAccount, (account) => account.publications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'social_account_id' })
  socialAccount!: SocialAccount

  @Column({
    type: 'enum',
    enum: Platform,
    nullable: false,
  })
  platform!: Platform

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
    nullable: false,
  })
  status!: PostStatus

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'platform_post_id',
  })
  platformPostId!: string

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'platform_post_url',
  })
  platformPostUrl!: string

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'scheduled_for',
  })
  scheduledFor!: Date

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'published_at',
  })
  publishedAt!: Date

  @Column({
    type: 'integer',
    default: 0,
    name: 'likes_count',
  })
  likesCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'comments_count',
  })
  commentsCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'shares_count',
  })
  sharesCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'impressions_count',
  })
  impressionsCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'reach_count',
  })
  reachCount!: number

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'analytics',
  })
  analytics!: Record<string, unknown>

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_synced_at',
  })
  lastSyncedAt!: Date

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_message',
  })
  errorMessage!: string

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'failed_at',
  })
  failedAt!: Date

  @Column({
    type: 'integer',
    default: 0,
    name: 'retry_count',
  })
  retryCount!: number

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_retry_at',
  })
  lastRetryAt!: Date

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'metadata',
  })
  metadata!: Record<string, unknown>
}
