# Baselining Database - Khởi tạo Migration cho Database có sẵn

## Baselining là gì?

Baselining là quá trình khởi tạo migration history cho database:
- Đã tồn tại trước khi dùng Prisma Migrate
- Chứa data quan trọng (không thể reset như production)

Baselining giúp Prisma Migrate hiểu rằng các migration ban đầu **đã được apply rồi**.

## Khi nào cần Baselining?

- ✅ Database production đã có sẵn tables, data
- ✅ Muốn bắt đầu dùng Prisma Migrate với database hiện có
- ✅ Không thể reset database vì có data quan trọng

## Workflow Baselining

### Bước 1: Xóa migrations cũ (nếu có)

```bash
# Backup hoặc xóa migrations folder hiện tại
rm -rf prisma/migrations
```

### Bước 2: Tạo baseline migration

```bash
# Tạo migration folder với prefix 0_ (quan trọng)
mkdir -p prisma/migrations/0_init

# Generate migration SQL từ schema hiện tại
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

### Bước 3: Review migration SQL

```bash
# Xem nội dung migration
cat prisma/migrations/0_init/migration.sql
```

### Bước 4: Mark baseline migration as applied

```bash
# Báo cho Prisma rằng migration này đã apply rồi
npx prisma migrate resolve --applied 0_init
```

### Bước 5: Verify

```bash
# Check migration status
npx prisma migrate status

# Nên hiển thị:
# Schema is in sync with Prisma schema.
```

## Sau khi Baselining

### Development (Local)

```bash
# Create new migration
npx tsx scripts/create-migration.ts --name add_new_feature

# Apply to local database
npx prisma migrate dev
```

### Production Deployment

```bash
# Prisma sẽ:
# 1. Bỏ qua migration 0_init (được mark as applied)
# 2. Chỉ apply các migration mới sau baseline

npx prisma migrate deploy
```

## Ví dụ hoàn chỉnh

### Tình huống

Database production đã có:
- Tables: users, posts, comments
- Data: 1000 users, 5000 posts
- Muốn thêm migration để thêm field mới

### Thực hiện

```bash
# 1. Tạo baseline migration
mkdir -p prisma/migrations/0_init

# 2. Generate SQL từ database hiện tại
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Mark as applied
npx prisma migrate resolve --applied 0_init

# 4. Bây giờ có thể tạo migration mới bình thường
npx tsx scripts/create-migration.ts --name add_user_theme
```

### Migration history sẽ như sau

```
prisma/migrations/
├── 0_init/                    # Baseline (marked as applied)
│   └── migration.sql          # State of database BEFORE Prisma Migrate
├── 20250110_add_user_theme/   # New migration 1
│   └── migration.sql
└── 20250115_add_post_index/   # New migration 2
    └── migration.sql
```

Khi deploy:
- **Local/Dev**: Apply cả 3 migrations (0_init, 20250110_*, 20250115_*)
- **Production**: Chỉ apply 2 migrations mới (20250110_*, 20250115_*), bỏ qua 0_init

## So sánh: Có vs Không Baselining

### KHÔNG Baselining (Sai với Production)

```
Migration: 0_init
Action: CREATE TABLE users (...)
Production: ERROR! Table already exists ❌
```

### CÓ Baselining (Đúng)

```
Migration: 0_init
Status: Marked as applied ✓
Production: Bỏ qua migration này ✓

Migration: 20250110_add_theme
Action: ALTER TABLE users ADD COLUMN theme
Production: Apply thành công ✓
```

## Troubleshooting

### Lỗi: Migration failed - table already exists

**Nguyên nhân:** Chưa baselining, Prisma cố tạo tables đã tồn tại.

**Giải pháp:** Baselining database.

### Lỗi: Shadow database permission denied

**Giải pháp:** Dùng custom script thay vì `prisma migrate dev`:

```bash
# Tự tạo migration
npx tsx scripts/create-migration.ts --name my_change

# Apply thủ công
psql $DATABASE_URL -f prisma/migrations/*/migration.sql

# Mark as applied
npx prisma migrate resolve --applied migration_name
```

### Lỗi: Schema drift

```bash
# Pull schema từ database hiện tại
npx prisma db pull

# Kiểm tra khác biệt
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

## Best Practices

1. **Backup trước khi baselining**
   ```bash
   pg_dump $DATABASE_URL > pre_baselining_backup.sql
   ```

2. **Test baseline trên staging trước**
   ```bash
   # Test trên staging database
   STAGING_DB_URL=... npx prisma migrate resolve --applied 0_init
   ```

3. **Commit baseline migration**
   ```bash
   git add prisma/migrations/0_init
   git commit -m "chore: baseline database with existing schema"
   ```

4. **Documentation**
   ```sql
   -- Migration: 0_init
   -- This is a baseline migration representing the state
   -- of the database before we started using Prisma Migrate.
   -- DO NOT apply this migration to existing databases.
   ```

## Timeline

```
Past              Present              Future
─────────────────────────────────────────────────
                  │
                  ├─ Baselining (0_init)
                  │  - Snapshot current state
                  │  - Mark as applied
                  │
                  ├─ Development
                  │  - Create new migrations
                  │  - Apply to local
                  │
                  └─ Production Deploy
                     - Skip 0_init
                     - Apply new migrations only
```

## Resources

- [Prisma Baselining Docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
- [Prisma Migrate Overview](https://www.prisma.io/docs/concepts/components/prisma-migrate)
