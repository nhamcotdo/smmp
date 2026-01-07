import { MigrationInterface, QueryRunner } from 'typeorm'

export class IncreaseAvatarLength1704600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Increase avatar length in users table
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE varchar(2048)`)

    // Increase avatar length in social_accounts table
    await queryRunner.query(`ALTER TABLE "social_accounts" ALTER COLUMN "avatar" TYPE varchar(2048)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert avatar length in users table
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE varchar(500)`)

    // Revert avatar length in social_accounts table
    await queryRunner.query(`ALTER TABLE "social_accounts" ALTER COLUMN "avatar" TYPE varchar(255)`)
  }
}
