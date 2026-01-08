import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSocialAccountIdToPosts1704600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const table = await queryRunner.getTable('posts')
    const hasSocialAccountId = table?.findColumnByName('social_account_id')

    // Add social_account_id column to posts table if it doesn't exist
    if (!hasSocialAccountId) {
      await queryRunner.query(`
        ALTER TABLE "posts"
        ADD COLUMN "social_account_id" uuid NULL
      `)
    }

    // Check if foreign key constraint exists before adding
    const foreignKeys = table?.foreignKeys ?? []
    const hasForeignKey = foreignKeys.some(
      fk => fk.columnNames.includes('social_account_id') && fk.referencedTableName === 'social_accounts'
    )

    if (!hasForeignKey) {
      // Add foreign key constraint
      await queryRunner.query(`
        ALTER TABLE "posts"
        ADD CONSTRAINT "fk_posts_social_account"
        FOREIGN KEY ("social_account_id")
        REFERENCES "social_accounts"("id")
        ON DELETE SET NULL
      `)
    }

    // Check if index exists before creating
    const indices = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'posts' AND indexname = 'idx_posts_social_account_id'
    `)

    if (indices.length === 0) {
      // Create index for social_account_id
      await queryRunner.query(`
        CREATE INDEX "idx_posts_social_account_id" ON "posts"("social_account_id")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_social_account_id"`)

    // Drop foreign key constraint
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "fk_posts_social_account"`)

    // Drop column
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "social_account_id"`)
  }
}
