import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSocialAccountIdToPosts1704600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add social_account_id column to posts table
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN "social_account_id" uuid NULL
    `)

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD CONSTRAINT "fk_posts_social_account"
      FOREIGN KEY ("social_account_id")
      REFERENCES "social_accounts"("id")
      ON DELETE SET NULL
    `)

    // Create index for social_account_id
    await queryRunner.query(`
      CREATE INDEX "idx_posts_social_account_id" ON "posts"("social_account_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_social_account_id"`)

    // Drop foreign key constraint
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "fk_posts_social_account"`)

    // Drop column
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "social_account_id"`)
  }
}
