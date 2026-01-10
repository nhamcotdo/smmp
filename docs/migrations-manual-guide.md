# Hướng dẫn chạy Migration thủ công

## ⚠️ QUAN TRỌNG
- **KHÔNG TỰ ĐỘNG COMMIT CODE** migration
- **ĐỌC KĨ tài liệu** trước khi chạy
- **BACKUP DATABASE** trước khi chạy migration

## Workflow

### 1. Tạo Migration File

```bash
# Tạo migration folder
npx tsx scripts/create-migration.ts --name ten_migration

# Ví dụ:
npx tsx scripts/create-migration.ts --name add_user_preferences_column
```

Sau khi chạy sẽ tạo:
```
prisma/migrations/20250110_ten_migration/
└── migration.sql
```

### 2. Viết SQL Migration

Edit file `prisma/migrations/20250110_ten_migration/migration.sql`:

```sql
-- Migration: ten_migration
-- Created: 2025-01-10
--
-- Description: Mô tả thay đổi
--
-- Rollback: Cách rollback

-- Viết SQL ở đây
ALTER TABLE users ADD COLUMN preferences JSONB;
```

### 3. Review Migration

```bash
# Xem nội dung migration
cat prisma/migrations/20250110_ten_migration/migration.sql

# Check migration status
npx prisma migrate status
```

### 4. TEST TRÊN LOCAL ĐẦU TIÊN

```bash
# Apply migration lên local database
psql $DATABASE_URL -f prisma/migrations/20250110_ten_migration/migration.sql

# Hoặc dùng Prisma (nếu có shadow database)
npm run db:migrate:dev
```

### 5. Verify

```bash
# Kiểm tra database
psql $DATABASE_URL -c "\d table_name"

# Test application
npm run dev
```

### 6. Apply lên PRODUCTION (SAU KHI TEST)

```bash
# ⚠️ CHỈ CHẠY SAU KHI ĐÃ TEST LOCAL

# 1. BACKUP DATABASE
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
psql $DATABASE_URL -f prisma/migrations/20250110_ten_migration/migration.sql

# 3. Verify production
psql $DATABASE_URL -c "\d table_name"
```

### 7. Mark Migration as Applied

```bash
# Sau khi apply thành công
npx prisma migrate resolve --applied 20250110_ten_migration
```

### 8. Commit (CHỈ SAU KHI MIGERATION THÀNH CÔNG)

```bash
git add prisma/migrations/20250110_ten_migration/
git commit -m "feat: ten_migration"
git push
```

## Các ví dụ Migration

### Thêm Column

```sql
-- Add nullable column
ALTER TABLE users ADD COLUMN "theme" VARCHAR(50);

-- Add column with default
ALTER TABLE users ADD COLUMN "is_verified" BOOLEAN DEFAULT false;

-- Add column NOT NULL (chỉ khi table rỗng hoặc có default)
ALTER TABLE users ADD COLUMN "created_at" TIMESTAMPTZ(3) DEFAULT NOW();
```

### Thêm Index

```sql
-- Single column index
CREATE INDEX idx_posts_user_id ON posts("user_id");

-- Unique index
CREATE UNIQUE INDEX idx_users_email ON users("email");

-- Composite index
CREATE INDEX idx_posts_user_status ON posts("user_id", "status");

-- Partial index (chỉ index một số rows)
CREATE INDEX idx_posts_published ON posts("published_at")
WHERE "status" = 'PUBLISHED';
```

### Đổi kiểu Column

```sql
-- String -> Integer
ALTER TABLE posts ALTER COLUMN "views" TYPE INTEGER USING "views"::INTEGER;

-- Text -> Text with limit
ALTER TABLE users ALTER COLUMN "bio" TYPE VARCHAR(500);

-- String -> Enum (đã có sẵn values)
ALTER TABLE users ALTER COLUMN "role" TYPE "users_role_enum"
USING "role"::text::users_role_enum;
```

### Rename Column

```sql
ALTER TABLE users RENAME COLUMN "name" TO "full_name";
```

### Drop Column

```sql
-- Drop column (CẨN THẬN - SẼ MẤT DỮ LIỆU)
ALTER TABLE users DROP COLUMN "old_column";

-- Drop column nếu tồn tại (AN TOÀN HƠN)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'old_column'
  ) THEN
    ALTER TABLE users DROP COLUMN "old_column";
  END IF;
END $$;
```

### Thêm Foreign Key

```sql
-- Add foreign key
ALTER TABLE posts
ADD CONSTRAINT "posts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE;

-- Add foreign key với SET NULL
ALTER TABLE posts
ADD CONSTRAINT "posts_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE SET NULL;
```

## Rollback Migration

Nếu migration có vấn đề, rollback:

```sql
-- Rollback: Drop column
ALTER TABLE users DROP COLUMN "new_column";

-- Rollback: Drop index
DROP INDEX IF EXISTS idx_users_new_column;

-- Rollback: Drop table
DROP TABLE IF EXISTS new_table;

-- Rollback: Drop enum (KHÓ - cần recreate type)
```

## Troubleshooting

### Migration bị lỗi

```bash
# Check error details
psql $DATABASE_URL -f prisma/migrations/20250110_ten_migration/migration.sql

# Rollback thủ công
# Viết SQL ngược lại và chạy
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN new_column;"
```

### Schema drift

```bash
# So sánh schema Prisma vs Database
npx prisma migrate diff --from-empty --to-schema-datasource prisma/schema.prisma

# Pull schema từ database
npx prisma db pull
```

### Mark migration as rolled-back

```bash
npx prisma migrate resolve --rolled-back 20250110_ten_migration
```

## Checklist

Trước khi apply lên PRODUCTION:

- [ ] Đã test trên LOCAL database
- [ ] Đã BACKUP production database
- [ ] Review SQL migration kỹ lưỡng
- [ ] Có rollback plan
- [ ] Verify data integrity sau migration
- [ ] Test application sau migration

## Lệnh hữu ích

```bash
# Connect vào database
psql $DATABASE_URL

# List all tables
\dt

# Describe table structure
\d table_name

# List all indexes
\di

# Exit psql
\q

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('smmp'));"

# Check table size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_total_relation_size('users'));"
```

## NÊN TRÁNH

❌ KHÔNG nên:
- Migration mà không test
- Migration mà không backup
- Commit migration mà chưa apply
- Drop table/column mà không kiểm tra foreign keys
- Change enum type trên production (phức tạp)
- Migration data lớn trong transaction (timeout)

## NÊN LÀM

✅ NÊN:
- Test migration trên local/staging trước
- Backup trước khi migration
- Write rollback SQL trong comments
- Dùng transaction cho multiple changes
- Add indexes sau khi add columns
- Monitor log khi chạy migration production
