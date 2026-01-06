import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import type { User } from './User.entity'
import { MediaType } from './enums'

@Entity('uploaded_media')
@Index('idx_uploaded_media_user_id', ['userId'])
@Index('idx_uploaded_media_type', ['type'])
@Index('idx_uploaded_media_status', ['status'])
export class UploadedMedia extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'user_id',
  })
  userId!: string

  @ManyToOne('User', 'uploadedMedia', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({
    type: 'enum',
    enum: MediaType,
    nullable: false,
  })
  type!: MediaType

  @Column({
    type: 'varchar',
    length: 500,
    nullable: false,
    name: 'filename',
  })
  filename!: string

  @Column({
    type: 'varchar',
    length: 2083,
    nullable: false,
  })
  url!: string

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'r2_key',
  })
  r2Key!: string

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    name: 'mime_type',
  })
  mimeType!: string

  @Column({
    type: 'bigint',
    nullable: false,
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
    type: 'enum',
    enum: ['active', 'deleted', 'expired'],
    default: 'active',
    nullable: false,
    name: 'status',
  })
  status!: 'active' | 'deleted' | 'expired'

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'deleted_at',
  })
  deletedAt!: Date

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'post_id',
  })
  postId!: string

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata!: Record<string, unknown>
}
