import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostParentRelation1704600000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add parent_post_id column to posts table for self-referential parent-child relationship
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN "parent_post_id" uuid NULL
    `)

    // Add comment_delay_minutes column for scheduled comments
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN "comment_delay_minutes" integer NULL
    `)

    // Add foreign key constraint (self-referential)
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD CONSTRAINT "fk_posts_parent_post"
      FOREIGN KEY ("parent_post_id")
      REFERENCES "posts"("id")
      ON DELETE CASCADE
    `)

    // Create index for parent_post_id lookup
    await queryRunner.query(`
      CREATE INDEX "idx_posts_parent_post_id" ON "posts"("parent_post_id")
    `)

    // Create composite index for efficient scheduled comment queries
    await queryRunner.query(`
      CREATE INDEX "idx_posts_parent_status_scheduled" ON "posts"("parent_post_id", "status", "scheduled_at")
    `)
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
