# Quick Reference - Migration Commands

## 🚀 Quick Start

```bash
# 1. Tạo migration
npx tsx scripts/create-migration.ts --name your_migration_name

# 2. Edit SQL file
vim prisma/migrations/$(date +%Y%m%d)_your_migration_name/migration.sql

# 3. Test trên LOCAL
psql $DATABASE_URL -f prisma/migrations/$(date +%Y%m%d)_your_migration_name/migration.sql

# 4. Backup PRODUCTION
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 5. Apply lên PRODUCTION (CHỈ KHI ĐÃ TEST)
psql $DATABASE_URL -f prisma/migrations/$(date +%Y%m%d)_your_migration_name/migration.sql

# 6. Mark as applied
npx prisma migrate resolve --applied $(date +%Y%m%d)_your_migration_name
```

## 📝 Common SQL Patterns

### Add Column
```sql
ALTER TABLE users ADD COLUMN "new_field" VARCHAR(255);
```

### Add Index
```sql
CREATE INDEX idx_users_new_field ON users("new_field");
```

### Rename Column
```sql
ALTER TABLE users RENAME COLUMN "old_name" TO "new_name";
```

### Add Foreign Key
```sql
ALTER TABLE posts
ADD CONSTRAINT "posts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
```

### Drop Column (CẨN THẂN)
```sql
ALTER TABLE users DROP COLUMN "old_field";
```

## 🔍 Verify Commands

```bash
# Check table structure
psql $DATABASE_URL -c "\d users"

# Check indexes
psql $DATABASE_URL -c "\di"

# Check all tables
psql $DATABASE_URL -c "\dt"

# Check specific data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

## 🆘 Troubleshooting

```bash
# Migration failed - check error
psql $DATABASE_URL -f migration.sql

# Rollback - chạy SQL ngược
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN new_field;"

# Mark as rolled-back
npx prisma migrate resolve --rolled-back migration_name

# Reset everything (LOCAL ONLY - SẼ XÓA DỮ LIỆU)
npx prisma migrate reset
```

## ⚠️ REMEMBER

1. **TEST LOCAL FIRST** - Luôn test local trước
2. **BACKUP PRODUCTION** - Backup trước khi run prod
3. **NEVER AUTO-COMMIT** - Không tự commit migration code
4. **VERIFY AFTER APPLY** - Verify sau khi apply
