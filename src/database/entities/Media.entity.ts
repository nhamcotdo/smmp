import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import type { Post } from './Post.entity'
import { MediaType } from './enums'

@Entity('media')
@Index('idx_media_post_id', ['postId'])
@Index('idx_media_type', ['type'])
@Index('idx_media_mimetype', ['mimeType'])
@Index('idx_media_post_order', ['postId', 'order'])
export class Media extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'post_id',
  })
  postId!: string

  @ManyToOne('Post', 'media', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post!: Post

  @Column({
    type: 'enum',
    enum: MediaType,
    nullable: false,
  })
  type!: MediaType

  @Column({
    type: 'varchar',
    length: 2083,
    nullable: false,
  })
  url!: string

  @Column({
    type: 'varchar',
    length: 2083,
    nullable: true,
    name: 'thumbnail_url',
  })
  thumbnailUrl!: string

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    name: 'mime_type',
  })
  mimeType!: string

  @Column({
    type: 'bigint',
    nullable: true,
    name: 'file_size',
  })
  fileSize!: number

  @Column({
    type: 'integer',
    nullable: true,
    name: 'width',
  })
  width!: number

  @Column({
    type: 'integer',
    nullable: true,
    name: 'height',
  })
  height!: number

  @Column({
    type: 'integer',
    nullable: true,
    name: 'duration',
  })
  duration!: number

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'alt_text',
  })
  altText!: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title!: string

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string

  @Column({
    type: 'integer',
    default: 0,
    name: 'order',
  })
  order!: number

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'metadata',
  })
  metadata!: Record<string, unknown>

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'provider',
  })
  provider!: string

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'provider_key',
  })
  providerKey!: string
}
