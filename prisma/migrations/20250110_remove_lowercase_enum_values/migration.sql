-- Migration 2: Remove lowercase enum values (AFTER data conversion)
--
-- ⚠️  WARNING: ONLY RUN THIS AFTER:
-- 1. Migration 1 is applied (uppercase values added)
-- 2. Data conversion script has run successfully
-- 3. All data has been verified to be uppercase
--
-- Run with: psql $DATABASE_URL -f prisma/migrations/20250110_remove_lowercase_enum_values/migration.sql
-- Or use: npm run migrate:remove:lowercase
--
-- ⚠️  This will FAIL if any rows still have lowercase enum values!

-- ============================================
-- Helper function to safely remove enum value
-- ============================================

CREATE OR REPLACE FUNCTION remove_enum_value(enum_type TEXT, value_to_remove TEXT)
RETURNS VOID AS $$
DECLARE
  temp_type TEXT;
  column_record RECORD;
  fk_record RECORD;
BEGIN
  -- Create a temporary enum type name
  temp_type := enum_type || '_temp';

  -- Create new enum type without the value
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
      table_name,
      column_name,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND udt_name::regtype = enum_type::regtype
  LOOP
    -- Temporarily drop default if exists
    IF column_record.column_default IS NOT NULL THEN
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

    -- Restore default if it existed
    IF column_record.column_default IS NOT NULL THEN
      -- Convert default value to uppercase and use temp type
      DECLARE
        new_default TEXT;
        default_value TEXT;
      BEGIN
        new_default := column_record.column_default;

        -- Replace lowercase value with uppercase
        new_default := replace(new_default, value_to_remove, upper(value_to_remove));

        -- Replace original enum type with temporary type in the default
        new_default := replace(new_default, '::' || enum_type, '::' || temp_type);

        -- Handle defaults without explicit type casting
        -- If no ::type in default, extract the value and add temp type casting
        IF new_default !~ '::' THEN
          -- Extract quoted value from default (e.g., 'USER' from 'USER'::text)
          default_value := substring(new_default FROM '''([^'']+)''');
          IF default_value IS NOT NULL AND default_value != '' THEN
            new_default := quote_literal(default_value) || '::' || temp_type;
          END IF;
        END IF;

        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s',
          column_record.table_name,
          column_record.column_name,
          new_default
        );
      END;
    END IF;
  END LOOP;

  -- Drop old enum type
  EXECUTE format('DROP TYPE %I', enum_type);

  -- Rename new type to original name
  EXECUTE format('ALTER TYPE %I RENAME TO %I', temp_type, enum_type);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Remove lowercase enum values
-- ============================================

-- PostStatus - posts
SELECT remove_enum_value('posts_status_enum', 'draft');
SELECT remove_enum_value('posts_status_enum', 'scheduled');
SELECT remove_enum_value('posts_status_enum', 'publishing');
SELECT remove_enum_value('posts_status_enum', 'published');
SELECT remove_enum_value('posts_status_enum', 'failed');
SELECT remove_enum_value('posts_status_enum', 'cancelled');

-- PostStatus - post_publications (separate type)
SELECT remove_enum_value('post_publications_status_enum', 'draft');
SELECT remove_enum_value('post_publications_status_enum', 'scheduled');
SELECT remove_enum_value('post_publications_status_enum', 'publishing');
SELECT remove_enum_value('post_publications_status_enum', 'published');
SELECT remove_enum_value('post_publications_status_enum', 'failed');
SELECT remove_enum_value('post_publications_status_enum', 'cancelled');

-- ContentType
SELECT remove_enum_value('posts_content_type_enum', 'text');
SELECT remove_enum_value('posts_content_type_enum', 'image');
SELECT remove_enum_value('posts_content_type_enum', 'video');
SELECT remove_enum_value('posts_content_type_enum', 'carousel');
SELECT remove_enum_value('posts_content_type_enum', 'story');
SELECT remove_enum_value('posts_content_type_enum', 'reel');
SELECT remove_enum_value('posts_content_type_enum', 'mixed');

-- AccountStatus
SELECT remove_enum_value('social_accounts_status_enum', 'active');
SELECT remove_enum_value('social_accounts_status_enum', 'expired');
SELECT remove_enum_value('social_accounts_status_enum', 'revoked');
SELECT remove_enum_value('social_accounts_status_enum', 'error');
SELECT remove_enum_value('social_accounts_status_enum', 'pending');

-- AccountHealth
SELECT remove_enum_value('social_accounts_health_enum', 'healthy');
SELECT remove_enum_value('social_accounts_health_enum', 'degraded');
SELECT remove_enum_value('social_accounts_health_enum', 'unhealthy');
SELECT remove_enum_value('social_accounts_health_enum', 'unknown');

-- SocialAccountPlatform
SELECT remove_enum_value('social_accounts_platform_enum', 'threads');
SELECT remove_enum_value('social_accounts_platform_enum', 'instagram');
SELECT remove_enum_value('social_accounts_platform_enum', 'twitter');
SELECT remove_enum_value('social_accounts_platform_enum', 'facebook');
SELECT remove_enum_value('social_accounts_platform_enum', 'linkedin');
SELECT remove_enum_value('social_accounts_platform_enum', 'tiktok');

-- PostPublicationPlatform
SELECT remove_enum_value('post_publications_platform_enum', 'threads');
SELECT remove_enum_value('post_publications_platform_enum', 'instagram');
SELECT remove_enum_value('post_publications_platform_enum', 'twitter');
SELECT remove_enum_value('post_publications_platform_enum', 'facebook');
SELECT remove_enum_value('post_publications_platform_enum', 'linkedin');
SELECT remove_enum_value('post_publications_platform_enum', 'tiktok');

-- AnalyticsPlatform
SELECT remove_enum_value('analytics_platform_enum', 'threads');
SELECT remove_enum_value('analytics_platform_enum', 'instagram');
SELECT remove_enum_value('analytics_platform_enum', 'twitter');
SELECT remove_enum_value('analytics_platform_enum', 'facebook');
SELECT remove_enum_value('analytics_platform_enum', 'linkedin');
SELECT remove_enum_value('analytics_platform_enum', 'tiktok');

-- MediaType
SELECT remove_enum_value('media_type_enum', 'image');
SELECT remove_enum_value('media_type_enum', 'video');
SELECT remove_enum_value('media_type_enum', 'gif');
SELECT remove_enum_value('media_type_enum', 'document');
SELECT remove_enum_value('media_type_enum', 'audio');

-- UploadedMediaType
SELECT remove_enum_value('uploaded_media_type_enum', 'image');
SELECT remove_enum_value('uploaded_media_type_enum', 'video');
SELECT remove_enum_value('uploaded_media_type_enum', 'gif');
SELECT remove_enum_value('uploaded_media_type_enum', 'document');
SELECT remove_enum_value('uploaded_media_type_enum', 'audio');

-- UploadedMediaStatus
SELECT remove_enum_value('uploaded_media_status_enum', 'active');
SELECT remove_enum_value('uploaded_media_status_enum', 'deleted');
SELECT remove_enum_value('uploaded_media_status_enum', 'expired');

-- MetricsPeriod
SELECT remove_enum_value('analytics_period_enum', 'hourly');
SELECT remove_enum_value('analytics_period_enum', 'daily');
SELECT remove_enum_value('analytics_period_enum', 'weekly');
SELECT remove_enum_value('analytics_period_enum', 'monthly');

-- UserRole
SELECT remove_enum_value('users_role_enum', 'admin');
SELECT remove_enum_value('users_role_enum', 'user');
SELECT remove_enum_value('users_role_enum', 'viewer');

-- RefreshTokenStatus
SELECT remove_enum_value('refresh_tokens_status_enum', 'active');
SELECT remove_enum_value('refresh_tokens_status_enum', 'revoked');
SELECT remove_enum_value('refresh_tokens_status_enum', 'expired');

-- ============================================
-- Cleanup: Drop helper function
-- ============================================

DROP FUNCTION remove_enum_value(TEXT, TEXT);
