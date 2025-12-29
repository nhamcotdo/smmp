import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import { PostPublication } from './PostPublication.entity'
import { Platform, MetricsPeriod } from './enums'

@Entity('analytics')
@Index('idx_analytics_post_publication_id', ['postPublicationId'])
@Index('idx_analytics_platform', ['platform'])
@Index('idx_analytics_period', ['period'])
@Index('idx_analytics_recorded_at', ['recordedAt'])
@Index('idx_analytics_publication_recorded', ['postPublicationId', 'recordedAt'])
export class Analytics extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: false,
    name: 'post_publication_id',
  })
  postPublicationId!: string

  @ManyToOne(() => PostPublication, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_publication_id' })
  postPublication!: PostPublication

  @Column({
    type: 'enum',
    enum: Platform,
    nullable: false,
  })
  platform!: Platform

  @Column({
    type: 'enum',
    enum: MetricsPeriod,
    default: MetricsPeriod.DAILY,
    nullable: false,
  })
  period!: MetricsPeriod

  @Column({
    type: 'timestamp with time zone',
    nullable: false,
    name: 'recorded_at',
  })
  recordedAt!: Date

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
    type: 'integer',
    default: 0,
    name: 'clicks_count',
  })
  clicksCount!: number

  @Column({
    type: 'integer',
    default: 0,
    name: 'saves_count',
  })
  savesCount!: number

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'engagement_rate',
  })
  engagementRate!: number

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'demographics',
  })
  demographics!: Record<string, unknown>

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'metrics_by_time',
  })
  metricsByTime!: Record<string, unknown>

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'raw_data',
  })
  rawData!: Record<string, unknown>
}
