import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @CreateDateColumn({
    type: 'timestamp with time zone',
    precision: 3,
    name: 'created_at',
  })
  createdAt!: Date

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    precision: 3,
    name: 'updated_at',
  })
  updatedAt!: Date
}
