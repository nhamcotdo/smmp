import {
  Entity,
  Column,
  OneToMany,
  Index,
  Unique,
} from 'typeorm'
import { BaseEntity } from './base.entity'
import { SocialAccount } from './SocialAccount.entity'
import { Post } from './Post.entity'
import { UserRole } from './enums'

@Entity('users')
@Unique(['email'])
@Index('idx_users_email', ['email'])
@Index('idx_users_role', ['role'])
@Index('idx_users_created_at', ['createdAt'])
export class User extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name!: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  email!: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    select: false,
  })
  password!: string

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
    nullable: false,
  })
  role!: UserRole

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatar!: string

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
  })
  isActive!: boolean

  @Column({
    type: 'boolean',
    default: false,
    name: 'email_verified',
  })
  emailVerified!: boolean

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_login_at',
  })
  lastLoginAt!: Date

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'preferences',
  })
  preferences!: Record<string, unknown>

  @OneToMany(() => SocialAccount, (account) => account.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  socialAccounts!: SocialAccount[]

  @OneToMany(() => Post, (post) => post.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  posts!: Post[]
}
