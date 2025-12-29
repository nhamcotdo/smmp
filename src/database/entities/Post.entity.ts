import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import { User } from './User.entity'
import { PostPublication } from './PostPublication.entity'
import { Media } from './Media.entity'
import { PostStatus, ContentType } from './enums'

@Entity('posts')
@Index('idx_posts_user_id', ['userId'])
@Index('idx_posts_status', ['status'])
@Index('idx_posts_scheduled_at', ['scheduledAt'])
@Index('idx_posts_published_at', ['publishedAt'])
@Index('idx_posts_content_type', ['contentType'])
@Index('idx_posts_user_status', ['userId', 'status'])
@Index('idx_posts_scheduled_status', ['status', 'scheduledAt'])
export class Post extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'user_id',
  })
  userId!: string

  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({
    type: 'text',
    nullable: false,
  })
  content!: string

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
    nullable: false,
  })
  status!: PostStatus

  @Column({
    type: 'enum',
    enum: ContentType,
    default: ContentType.TEXT,
    nullable: false,
    name: 'content_type',
  })
  contentType!: ContentType

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'scheduled_at',
  })
  scheduledAt!: Date

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'published_at',
  })
  publishedAt!: Date

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title!: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'slug',
  })
  slug!: string

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'metadata',
  })
  metadata!: Record<string, unknown>

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'hashtags',
  })
  hashtags!: string[]

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'mentions',
  })
  mentions!: string[]

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'analytics',
  })
  analytics!: {
    totalLikes: number
    totalComments: number
    totalShares: number
    totalImpressions: number
    totalReach: number
  }

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_scheduled',
  })
  isScheduled!: boolean

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'failed_at',
  })
  failedAt!: Date

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_message',
  })
  errorMessage!: string

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

  @OneToMany(() => PostPublication, (publication) => publication.post, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  publications!: PostPublication[]

  @OneToMany(() => Media, (media) => media.post, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  media!: Media[]
}
