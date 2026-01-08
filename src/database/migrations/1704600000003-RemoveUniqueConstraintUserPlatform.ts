import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveUniqueConstraintUserPlatform1704600000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique constraint index on (user_id, platform)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_social_accounts_user_platform"`)

    // Recreate the index without unique constraint for query performance
    await queryRunner.query(`
      CREATE INDEX "idx_social_accounts_user_platform" ON "social_accounts"("user_id", "platform")
    `)

    // Create new unique constraint on (user_id, platform, platform_user_id)
    // This allows multiple accounts per platform but prevents duplicate accounts
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_social_accounts_user_platform_unique"
      ON "social_accounts"("user_id", "platform", "platform_user_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new unique constraint
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_social_accounts_user_platform_unique"`)

    // Drop the non-unique index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_social_accounts_user_platform"`)

    // Recreate the old unique constraint (only one account per platform per user)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_social_accounts_user_platform" ON "social_accounts"("user_id", "platform")
    `)
  }
}
