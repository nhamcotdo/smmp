-- ============================================
-- REMOVE LOWERCASE ENUM VALUES FROM PRODUCTION
-- ============================================
--
-- ⚠️  PRODUCTION DATABASE - RUN WITH CAUTION
--
-- Prerequisites:
-- 1. ALL data must be converted to uppercase first
-- 2. Run verification queries below before proceeding
-- 3. Have a backup ready
--
-- Usage:
--   psql $DATABASE_URL -f scripts/remove-lowercase-enum-values.sql
-- ============================================

\echo '========================================'
\echo 'Step 1: VERIFY NO LOWERCASE DATA EXISTS'
\echo '========================================'

-- Check posts.status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM posts WHERE status = 'draft'::posts_status_enum LIMIT 1) THEN
    RAISE EXCEPTION 'posts.status still has lowercase values! Abort.';
  END IF;
  IF EXISTS (SELECT 1 FROM posts WHERE status = 'scheduled'::posts_status_enum LIMIT 1) THEN
    RAISE EXCEPTION 'posts.status still has lowercase values! Abort.';
  END IF;
  RAISE NOTICE '✓ posts.status - all uppercase';
END $$;

-- Check post_publications.status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM post_publications WHERE status = 'draft'::posts_status_enum LIMIT 1) THEN
    RAISE EXCEPTION 'post_publications.status still has lowercase values! Abort.';
  END IF;
  RAISE NOTICE '✓ post_publications.status - all uppercase';
END $$;

-- Check social_accounts.status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM social_accounts WHERE status = 'active'::social_accounts_status_enum LIMIT 1) THEN
    RAISE EXCEPTION 'social_accounts.status still has lowercase values! Abort.';
  END IF;
  RAISE NOTICE '✓ social_accounts.status - all uppercase';
END $$;

-- Check users.role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role = 'admin'::users_role_enum LIMIT 1) THEN
    RAISE EXCEPTION 'users.role still has lowercase values! Abort.';
  END IF;
  RAISE NOTICE '✓ users.role - all uppercase';
END $$;

\echo ''
\echo '========================================'
\echo 'Step 2: REMOVE LOWERCASE ENUM VALUES'
\echo '========================================'

-- Helper function to safely remove enum value
CREATE OR REPLACE FUNCTION remove_enum_value(enum_type TEXT, value_to_remove TEXT)
RETURNS VOID AS $$
DECLARE
  temp_type TEXT;
  column_record RECORD;
  old_default TEXT;
BEGIN
  temp_type := enum_type || '_old_' || substr(md5(random()::text), 1, 8);

  -- Create new enum type without the value (only uppercase)
  EXECUTE format(
    'CREATE TYPE %I AS ENUM (%s)',
    temp_type,
    (
      SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder)
      FROM pg_enum
      WHERE enumtypid = enum_type::regtype AND enumlabel != value_to_remove
    )
  );

  -- Find all columns using this enum type
  FOR column_record IN
    SELECT
      c.table_name,
      c.column_name,
      c.column_default
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    WHERE c.table_schema = 'public'
      AND t.typname = enum_type
      AND t.typtype = 'e'
  LOOP
    -- Store old default
    old_default := column_record.column_default;

    -- Drop default if exists
    IF old_default IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT',
        column_record.table_name,
        column_record.column_name
      );
    END IF;

    -- Convert column to new enum type
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE %I USING %I::text::%I',
      column_record.table_name,
      column_record.column_name,
      temp_type,
      column_record.column_name,
      temp_type
    );

    -- Restore default if it existed (converting to uppercase if needed)
    IF old_default IS NOT NULL THEN
      -- The default is already uppercase, just use it
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
        column_record.table_name,
        column_record.column_name,
        replace(old_default, '::' || enum_type, '::' || temp_type)
      );
    END IF;
  END LOOP;

  -- Drop old enum type
  EXECUTE format('DROP TYPE %I', enum_type);

  -- Rename new type to original name
  EXECUTE format('ALTER TYPE %I RENAME TO %I', temp_type, enum_type);

  RAISE NOTICE '✓ Removed % from %', value_to_remove, enum_type;
END;
$$ LANGUAGE plpgsql;

\echo ''
\echo 'Removing lowercase enum values...'

-- Remove lowercase from posts_status_enum
SELECT remove_enum_value('posts_status_enum', 'draft');
SELECT remove_enum_value('posts_status_enum', 'scheduled');
SELECT remove_enum_value('posts_status_enum', 'publishing');
SELECT remove_enum_value('posts_status_enum', 'published');
SELECT remove_enum_value('posts_status_enum', 'failed');
SELECT remove_enum_value('posts_status_enum', 'cancelled');

-- Remove lowercase from posts_content_type_enum
SELECT remove_enum_value('posts_content_type_enum', 'text');
SELECT remove_enum_value('posts_content_type_enum', 'image');
SELECT remove_enum_value('posts_content_type_enum', 'video');
SELECT remove_enum_value('posts_content_type_enum', 'carousel');
SELECT remove_enum_value('posts_content_type_enum', 'story');
SELECT remove_enum_value('posts_content_type_enum', 'reel');
SELECT remove_enum_value('posts_content_type_enum', 'mixed');

-- Remove lowercase from social_accounts_status_enum
SELECT remove_enum_value('social_accounts_status_enum', 'active');
SELECT remove_enum_value('social_accounts_status_enum', 'expired');
SELECT remove_enum_value('social_accounts_status_enum', 'revoked');
SELECT remove_enum_value('social_accounts_status_enum', 'error');
SELECT remove_enum_value('social_accounts_status_enum', 'pending');

-- Remove lowercase from social_accounts_health_enum
SELECT remove_enum_value('social_accounts_health_enum', 'healthy');
SELECT remove_enum_value('social_accounts_health_enum', 'degraded');
SELECT remove_enum_value('social_accounts_health_enum', 'unhealthy');
SELECT remove_enum_value('social_accounts_health_enum', 'unknown');

-- Remove lowercase from social_accounts_platform_enum
SELECT remove_enum_value('social_accounts_platform_enum', 'threads');
SELECT remove_enum_value('social_accounts_platform_enum', 'instagram');
SELECT remove_enum_value('social_accounts_platform_enum', 'twitter');
SELECT remove_enum_value('social_accounts_platform_enum', 'facebook');
SELECT remove_enum_value('social_accounts_platform_enum', 'linkedin');
SELECT remove_enum_value('social_accounts_platform_enum', 'tiktok');

-- Remove lowercase from post_publications_platform_enum
SELECT remove_enum_value('post_publications_platform_enum', 'threads');
SELECT remove_enum_value('post_publications_platform_enum', 'instagram');
SELECT remove_enum_value('post_publications_platform_enum', 'twitter');
SELECT remove_enum_value('post_publications_platform_enum', 'facebook');
SELECT remove_enum_value('post_publications_platform_enum', 'linkedin');
SELECT remove_enum_value('post_publications_platform_enum', 'tiktok');

-- Remove lowercase from analytics_platform_enum
SELECT remove_enum_value('analytics_platform_enum', 'threads');
SELECT remove_enum_value('analytics_platform_enum', 'instagram');
SELECT remove_enum_value('analytics_platform_enum', 'twitter');
SELECT remove_enum_value('analytics_platform_enum', 'facebook');
SELECT remove_enum_value('analytics_platform_enum', 'linkedin');
SELECT remove_enum_value('analytics_platform_enum', 'tiktok');

-- Remove lowercase from media_type_enum
SELECT remove_enum_value('media_type_enum', 'image');
SELECT remove_enum_value('media_type_enum', 'video');
SELECT remove_enum_value('media_type_enum', 'gif');
SELECT remove_enum_value('media_type_enum', 'document');
SELECT remove_enum_value('media_type_enum', 'audio');

-- Remove lowercase from uploaded_media_type_enum
SELECT remove_enum_value('uploaded_media_type_enum', 'image');
SELECT remove_enum_value('uploaded_media_type_enum', 'video');
SELECT remove_enum_value('uploaded_media_type_enum', 'gif');
SELECT remove_enum_value('uploaded_media_type_enum', 'document');
SELECT remove_enum_value('uploaded_media_type_enum', 'audio');

-- Remove lowercase from uploaded_media_status_enum
SELECT remove_enum_value('uploaded_media_status_enum', 'active');
SELECT remove_enum_value('uploaded_media_status_enum', 'deleted');
SELECT remove_enum_value('uploaded_media_status_enum', 'expired');

-- Remove lowercase from analytics_period_enum
SELECT remove_enum_value('analytics_period_enum', 'hourly');
SELECT remove_enum_value('analytics_period_enum', 'daily');
SELECT remove_enum_value('analytics_period_enum', 'weekly');
SELECT remove_enum_value('analytics_period_enum', 'monthly');

-- Remove lowercase from users_role_enum
SELECT remove_enum_value('users_role_enum', 'admin');
SELECT remove_enum_value('users_role_enum', 'user');
SELECT remove_enum_value('users_role_enum', 'viewer');

-- Remove lowercase from refresh_tokens_status_enum
SELECT remove_enum_value('refresh_tokens_status_enum', 'active');
SELECT remove_enum_value('refresh_tokens_status_enum', 'revoked');
SELECT remove_enum_value('refresh_tokens_status_enum', 'expired');

\echo ''
\echo '========================================'
\echo 'Step 3: CLEANUP HELPER FUNCTION'
\echo '========================================'

DROP FUNCTION remove_enum_value(TEXT, TEXT);

\echo ''
\echo '========================================'
\echo '✅ LOWERCASE ENUM VALUES REMOVED'
\echo '========================================'
\echo 'Verify enum types:'
\echo ''

-- Display all enum types and their values
DO $$
DECLARE
  enum_record RECORD;
  value_record RECORD;
  value_list TEXT;
BEGIN
  FOR enum_record IN
    SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
  LOOP
    value_list := '';
    FOR value_record IN
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = enum_record.typname::regtype
      ORDER BY enumsortorder
    LOOP
      IF value_list = '' THEN
        value_list := value_record.enumlabel;
      ELSE
        value_list := value_list || ', ' || value_record.enumlabel;
      END IF;
    END LOOP;
    RAISE NOTICE '%: %', enum_record.typname, value_list;
  END LOOP;
END $$;
