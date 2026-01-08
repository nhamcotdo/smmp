import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostParentRelation1704600000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('posts')

    // Check and add parent_post_id column
    const hasParentPostId = table?.findColumnByName('parent_post_id')
    if (!hasParentPostId) {
      await queryRunner.query(`
        ALTER TABLE "posts"
        ADD COLUMN "parent_post_id" uuid NULL
      `)
    }

    // Check and add comment_delay_minutes column
    const hasCommentDelayMinutes = table?.findColumnByName('comment_delay_minutes')
    if (!hasCommentDelayMinutes) {
      await queryRunner.query(`
        ALTER TABLE "posts"
        ADD COLUMN "comment_delay_minutes" integer NULL
      `)
    }

    // Check if foreign key constraint exists
    const foreignKeys = table?.foreignKeys ?? []
    const hasParentForeignKey = foreignKeys.some(
      fk => fk.columnNames.includes('parent_post_id') && fk.referencedTableName === 'posts'
    )

    if (!hasParentForeignKey) {
      // Add foreign key constraint (self-referential)
      await queryRunner.query(`
        ALTER TABLE "posts"
        ADD CONSTRAINT "fk_posts_parent_post"
        FOREIGN KEY ("parent_post_id")
        REFERENCES "posts"("id")
        ON DELETE CASCADE
      `)
    }

    // Check and create index for parent_post_id lookup
    const parentIndexResult = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'posts' AND indexname = 'idx_posts_parent_post_id'
    `)
    if (parentIndexResult.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "idx_posts_parent_post_id" ON "posts"("parent_post_id")
      `)
    }

    // Check and create composite index for efficient scheduled comment queries
    const compositeIndexResult = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'posts' AND indexname = 'idx_posts_parent_status_scheduled'
    `)
    if (compositeIndexResult.length === 0) {
      await queryRunner.query(`
        CREATE INDEX "idx_posts_parent_status_scheduled" ON "posts"("parent_post_id", "status", "scheduled_at")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_parent_status_scheduled"`)

    // Drop parent_post_id index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_parent_post_id"`)

    // Drop foreign key constraint
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "fk_posts_parent_post"`)

    // Drop comment_delay_minutes column
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "comment_delay_minutes"`)

    // Drop parent_post_id column
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "parent_post_id"`)
  }
}
