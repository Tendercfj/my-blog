-- Baseline schema for the single-owner blog.
-- Target: PostgreSQL on Neon. Run once against an empty database with a
-- migration/direct connection (DATABASE_URL_UNPOOLED), never from a browser.
-- The complete file is one top-level DO statement so it can be sent once via
-- neon().query(), sql.query(), or another prepared-statement Query API.
-- Every DDL command is executed separately inside the anonymous block. The DO
-- statement is atomic: if one command fails, PostgreSQL rolls back the whole
-- baseline. Do not prepend BEGIN or append COMMIT to the query text.
-- Runtime/migration role creation and real credentials are intentionally omitted.

DO $baseline$
BEGIN
    EXECUTE $ddl$
CREATE EXTENSION IF NOT EXISTS pgcrypto
$ddl$;

    EXECUTE $ddl$
CREATE EXTENSION IF NOT EXISTS pg_trgm
$ddl$;

    EXECUTE $ddl$
CREATE SCHEMA IF NOT EXISTS blog
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.owner_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key smallint NOT NULL DEFAULT 1,
    email text NOT NULL,
    password_hash text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    password_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT owner_accounts_singleton_key_ck CHECK (singleton_key = 1),
    CONSTRAINT owner_accounts_singleton_key_uq UNIQUE (singleton_key),
    CONSTRAINT owner_accounts_email_normalized_ck CHECK (
        email = lower(btrim(email))
        AND char_length(email) BETWEEN 3 AND 320
        AND position('@' IN email) > 1
    ),
    CONSTRAINT owner_accounts_password_hash_ck CHECK (char_length(password_hash) BETWEEN 20 AND 1024),
    CONSTRAINT owner_accounts_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON TABLE blog.owner_accounts IS
    'Exactly zero or one owner account. singleton_key=1 plus UNIQUE prevents a second account.'
$ddl$;
    EXECUTE $ddl$
COMMENT ON COLUMN blog.owner_accounts.password_hash IS
    'Algorithm-encoded password hash only; never plaintext or reversible ciphertext.'
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.author_profiles (
    account_id uuid PRIMARY KEY REFERENCES blog.owner_accounts(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text NOT NULL DEFAULT '',
    bio text NOT NULL DEFAULT '',
    avatar_src text NOT NULL,
    avatar_alt text NOT NULL,
    avatar_width integer NOT NULL,
    avatar_height integer NOT NULL,
    links jsonb NOT NULL DEFAULT '[]'::jsonb,
    about jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT author_profiles_name_ck CHECK (btrim(name) <> ''),
    CONSTRAINT author_profiles_avatar_src_ck CHECK (avatar_src ~ '^/images/'),
    CONSTRAINT author_profiles_avatar_alt_ck CHECK (btrim(avatar_alt) <> ''),
    CONSTRAINT author_profiles_avatar_size_ck CHECK (avatar_width > 0 AND avatar_height > 0),
    CONSTRAINT author_profiles_links_array_ck CHECK (
        CASE WHEN jsonb_typeof(links) = 'array' THEN true ELSE false END
    ),
    CONSTRAINT author_profiles_about_object_ck CHECK (
        CASE WHEN jsonb_typeof(about) = 'object' THEN true ELSE false END
    ),
    CONSTRAINT author_profiles_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.site_settings (
    singleton_key smallint PRIMARY KEY DEFAULT 1,
    name text NOT NULL,
    description text NOT NULL,
    site_url text NOT NULL,
    logo_src text NOT NULL,
    logo_alt text NOT NULL,
    logo_width integer NOT NULL,
    logo_height integer NOT NULL,
    announcement text NOT NULL DEFAULT '',
    navigation jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT site_settings_singleton_key_ck CHECK (singleton_key = 1),
    CONSTRAINT site_settings_name_ck CHECK (btrim(name) <> ''),
    CONSTRAINT site_settings_description_ck CHECK (btrim(description) <> ''),
    CONSTRAINT site_settings_url_ck CHECK (site_url ~ '^https?://'),
    CONSTRAINT site_settings_logo_src_ck CHECK (logo_src ~ '^/images/'),
    CONSTRAINT site_settings_logo_alt_ck CHECK (btrim(logo_alt) <> ''),
    CONSTRAINT site_settings_logo_size_ck CHECK (logo_width > 0 AND logo_height > 0),
    CONSTRAINT site_settings_navigation_array_ck CHECK (
        CASE WHEN jsonb_typeof(navigation) = 'array' THEN true ELSE false END
    ),
    CONSTRAINT site_settings_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON TABLE blog.site_settings IS 'Singleton site configuration; singleton_key must equal 1.'
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT categories_slug_uq UNIQUE (slug),
    CONSTRAINT categories_slug_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT categories_name_ck CHECK (btrim(name) <> ''),
    CONSTRAINT categories_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT tags_slug_uq UNIQUE (slug),
    CONSTRAINT tags_slug_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT tags_name_ck CHECK (btrim(name) <> ''),
    CONSTRAINT tags_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES blog.owner_accounts(id) ON DELETE RESTRICT,
    slug text,
    title text NOT NULL,
    excerpt text,
    status text NOT NULL DEFAULT 'draft',
    category_id uuid REFERENCES blog.categories(id) ON DELETE RESTRICT,
    cover_src text,
    cover_alt text,
    cover_width integer,
    cover_height integer,
    featured boolean NOT NULL DEFAULT false,
    body jsonb NOT NULL DEFAULT '[]'::jsonb,
    published_at timestamptz,
    content_updated_at timestamptz,
    archived_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    row_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT posts_title_ck CHECK (btrim(title) <> ''),
    CONSTRAINT posts_slug_ck CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT posts_status_ck CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT posts_body_array_ck CHECK (
        CASE WHEN jsonb_typeof(body) = 'array' THEN true ELSE false END
    ),
    CONSTRAINT posts_cover_all_or_none_ck CHECK (
        (cover_src IS NULL AND cover_alt IS NULL AND cover_width IS NULL AND cover_height IS NULL)
        OR
        (
            cover_src IS NOT NULL
            AND cover_alt IS NOT NULL
            AND cover_width IS NOT NULL
            AND cover_height IS NOT NULL
            AND cover_src ~ '^/images/'
            AND btrim(cover_alt) <> ''
            AND cover_width > 0
            AND cover_height > 0
        )
    ),
    CONSTRAINT posts_state_timestamps_ck CHECK (
        (status = 'draft' AND archived_at IS NULL)
        OR (status = 'published' AND published_at IS NOT NULL AND archived_at IS NULL)
        OR (status = 'archived' AND archived_at IS NOT NULL)
    ),
    CONSTRAINT posts_deleted_is_draft_ck CHECK (deleted_at IS NULL OR status = 'draft'),
    CONSTRAINT posts_content_updated_at_ck CHECK (
        published_at IS NULL OR content_updated_at IS NULL OR content_updated_at >= published_at
    ),
    CONSTRAINT posts_published_shape_ck CHECK (
        CASE
            WHEN status = 'published' AND jsonb_typeof(body) = 'array' THEN
                slug IS NOT NULL
                AND excerpt IS NOT NULL
                AND btrim(excerpt) <> ''
                AND category_id IS NOT NULL
                AND cover_src IS NOT NULL
                AND jsonb_array_length(body) > 0
            WHEN status = 'published' THEN false
            ELSE true
        END
    ),
    CONSTRAINT posts_version_ck CHECK (version > 0)
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON COLUMN blog.posts.published_at IS
    'First publication time. Retained across withdraw/re-publish to keep public chronology stable.'
$ddl$;
    EXECUTE $ddl$
COMMENT ON COLUMN blog.posts.content_updated_at IS
    'Optional public content modification timestamp; distinct from technical row_updated_at.'
$ddl$;
    EXECUTE $ddl$
COMMENT ON COLUMN blog.posts.body IS
    'Ordered ContentBlock[] JSON. SQL checks array/non-empty-on-publish; application validates the full discriminated union.'
$ddl$;
    EXECUTE $ddl$
COMMENT ON COLUMN blog.posts.deleted_at IS
    'Soft-delete marker. Application transitions a deleted post to draft before setting this value.'
$ddl$;

    EXECUTE $ddl$
CREATE UNIQUE INDEX posts_slug_uq
    ON blog.posts (slug)
    WHERE slug IS NOT NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_owner_active_idx
    ON blog.posts (owner_id, status, row_updated_at DESC, id DESC)
    WHERE deleted_at IS NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_owner_deleted_idx
    ON blog.posts (owner_id, deleted_at DESC, id DESC)
    WHERE deleted_at IS NOT NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_public_timeline_idx
    ON blog.posts (published_at DESC, id DESC)
    WHERE status = 'published' AND deleted_at IS NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_public_category_idx
    ON blog.posts (category_id, published_at DESC, id DESC)
    WHERE status = 'published' AND deleted_at IS NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_title_trgm_idx
    ON blog.posts USING gin (title gin_trgm_ops)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX posts_excerpt_trgm_idx
    ON blog.posts USING gin ((coalesce(excerpt, '')) gin_trgm_ops)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX categories_name_trgm_idx
    ON blog.categories USING gin (name gin_trgm_ops)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX tags_name_trgm_idx
    ON blog.tags USING gin (name gin_trgm_ops)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.post_tags (
    post_id uuid NOT NULL REFERENCES blog.posts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES blog.tags(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (post_id, tag_id)
)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX post_tags_tag_post_idx ON blog.post_tags (tag_id, post_id)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES blog.owner_accounts(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CONSTRAINT auth_sessions_token_hash_uq UNIQUE (token_hash),
    CONSTRAINT auth_sessions_token_hash_ck CHECK (octet_length(token_hash) = 32),
    CONSTRAINT auth_sessions_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT auth_sessions_last_seen_ck CHECK (last_seen_at >= created_at),
    CONSTRAINT auth_sessions_revoked_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at)
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON COLUMN blog.auth_sessions.token_hash IS
    'SHA-256 digest of the opaque session token. The plaintext token exists only in the secure Cookie.'
$ddl$;

    EXECUTE $ddl$
CREATE INDEX auth_sessions_account_active_idx
    ON blog.auth_sessions (account_id, expires_at DESC, id DESC)
    WHERE revoked_at IS NULL
$ddl$;

    EXECUTE $ddl$
CREATE INDEX auth_sessions_expiry_idx
    ON blog.auth_sessions (expires_at)
    WHERE revoked_at IS NULL
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.auth_rate_limits (
    key_kind text NOT NULL,
    key_hash bytea NOT NULL,
    window_started_at timestamptz NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    blocked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (key_kind, key_hash),
    CONSTRAINT auth_rate_limits_kind_ck CHECK (
        key_kind IN ('login_email', 'register_global')
    ),
    CONSTRAINT auth_rate_limits_key_hash_ck CHECK (octet_length(key_hash) = 32),
    CONSTRAINT auth_rate_limits_attempt_count_ck CHECK (attempt_count >= 0),
    CONSTRAINT auth_rate_limits_blocked_until_ck CHECK (
        blocked_until IS NULL OR blocked_until >= window_started_at
    )
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON COLUMN blog.auth_rate_limits.key_hash IS
    'Server-side HMAC digest of normalized email or the fixed registration scope; raw values are not stored.'
$ddl$;
    EXECUTE $ddl$
COMMENT ON COLUMN blog.auth_rate_limits.key_kind IS
    'Authentication budget kind. Login is scoped by normalized email; first-registration uses one global singleton budget.'
$ddl$;

    EXECUTE $ddl$
CREATE INDEX auth_rate_limits_blocked_idx
    ON blog.auth_rate_limits (blocked_until)
    WHERE blocked_until IS NOT NULL
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.idempotency_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES blog.owner_accounts(id) ON DELETE CASCADE,
    key_hash bytea NOT NULL,
    request_hash bytea NOT NULL,
    request_method text NOT NULL,
    request_path text NOT NULL,
    response_status integer,
    response_body jsonb,
    resource_id uuid,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT idempotency_keys_account_key_uq UNIQUE (account_id, key_hash),
    CONSTRAINT idempotency_keys_key_hash_ck CHECK (octet_length(key_hash) = 32),
    CONSTRAINT idempotency_keys_request_hash_ck CHECK (octet_length(request_hash) = 32),
    CONSTRAINT idempotency_keys_method_ck CHECK (request_method IN ('POST')),
    CONSTRAINT idempotency_keys_path_ck CHECK (request_path LIKE '/api/v1/%'),
    CONSTRAINT idempotency_keys_response_status_ck CHECK (
        response_status IS NULL OR response_status BETWEEN 200 AND 599
    ),
    CONSTRAINT idempotency_keys_response_pair_ck CHECK (
        (response_status IS NULL AND response_body IS NULL)
        OR (response_status IS NOT NULL AND response_body IS NOT NULL)
    ),
    CONSTRAINT idempotency_keys_expiry_ck CHECK (expires_at > created_at)
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON TABLE blog.idempotency_keys IS
    'Safe retry ledger. Store hashes rather than raw Idempotency-Key/request data.'
$ddl$;

    EXECUTE $ddl$
CREATE INDEX idempotency_keys_expiry_idx ON blog.idempotency_keys (expires_at)
$ddl$;

    EXECUTE $ddl$
CREATE TABLE blog.post_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_account_id uuid NOT NULL REFERENCES blog.owner_accounts(id) ON DELETE RESTRICT,
    post_id uuid REFERENCES blog.posts(id) ON DELETE SET NULL,
    action text NOT NULL,
    request_id uuid NOT NULL,
    changes jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT post_audit_events_action_ck CHECK (
        action IN (
            'create',
            'update',
            'publish',
            'withdraw',
            'archive',
            'unarchive',
            'soft_delete',
            'restore'
        )
    ),
    CONSTRAINT post_audit_events_changes_object_ck CHECK (
        CASE WHEN jsonb_typeof(changes) = 'object' THEN true ELSE false END
    )
)
$ddl$;

    EXECUTE $ddl$
COMMENT ON TABLE blog.post_audit_events IS
    'Append-only post write audit. Application inserts an event in the same transaction as each post mutation.'
$ddl$;

    EXECUTE $ddl$
CREATE INDEX post_audit_events_post_time_idx
    ON blog.post_audit_events (post_id, occurred_at DESC, id DESC)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX post_audit_events_actor_time_idx
    ON blog.post_audit_events (actor_account_id, occurred_at DESC, id DESC)
$ddl$;

    EXECUTE $ddl$
CREATE INDEX post_audit_events_request_idx
    ON blog.post_audit_events (request_id)
$ddl$;

    EXECUTE $ddl$
CREATE OR REPLACE FUNCTION blog.touch_versioned_row()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at := clock_timestamp();
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$function$
$ddl$;

    EXECUTE $ddl$
CREATE OR REPLACE FUNCTION blog.touch_post_row()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.published_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'post slug is immutable after first publication',
            CONSTRAINT = 'posts_slug_immutable_after_publish';
    END IF;

    NEW.row_updated_at := clock_timestamp();
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$function$
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER owner_accounts_touch_version
BEFORE UPDATE ON blog.owner_accounts
FOR EACH ROW EXECUTE FUNCTION blog.touch_versioned_row()
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER author_profiles_touch_version
BEFORE UPDATE ON blog.author_profiles
FOR EACH ROW EXECUTE FUNCTION blog.touch_versioned_row()
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER site_settings_touch_version
BEFORE UPDATE ON blog.site_settings
FOR EACH ROW EXECUTE FUNCTION blog.touch_versioned_row()
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER categories_touch_version
BEFORE UPDATE ON blog.categories
FOR EACH ROW EXECUTE FUNCTION blog.touch_versioned_row()
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER tags_touch_version
BEFORE UPDATE ON blog.tags
FOR EACH ROW EXECUTE FUNCTION blog.touch_versioned_row()
$ddl$;

    EXECUTE $ddl$
CREATE TRIGGER posts_touch_version
BEFORE UPDATE ON blog.posts
FOR EACH ROW EXECUTE FUNCTION blog.touch_post_row()
$ddl$;

    EXECUTE $ddl$
CREATE VIEW blog.public_posts AS
SELECT
    id,
    owner_id,
    slug,
    title,
    excerpt,
    category_id,
    cover_src,
    cover_alt,
    cover_width,
    cover_height,
    featured,
    body,
    published_at,
    content_updated_at,
    row_updated_at,
    version
FROM blog.posts
WHERE status = 'published'
  AND deleted_at IS NULL
$ddl$;

    EXECUTE $ddl$
COMMENT ON VIEW blog.public_posts IS
    'Canonical published-state filter. Authentication is enforced by the application before querying this view.'
$ddl$;

END
$baseline$;

-- Runtime grant template (execute separately after creating a least-privilege role):
-- GRANT USAGE ON SCHEMA blog TO blog_runtime;
-- GRANT SELECT ON blog.owner_accounts, blog.site_settings, blog.categories, blog.tags TO blog_runtime;
-- GRANT INSERT (email, password_hash) ON blog.owner_accounts TO blog_runtime;
-- GRANT UPDATE (password_hash, password_changed_at) ON blog.owner_accounts TO blog_runtime;
-- GRANT SELECT, UPDATE ON blog.author_profiles TO blog_runtime;
-- GRANT INSERT (
--     account_id, name, role, bio, avatar_src, avatar_alt,
--     avatar_width, avatar_height, links, about
-- ) ON blog.author_profiles TO blog_runtime;
-- GRANT INSERT (
--     singleton_key, name, description, site_url, logo_src, logo_alt,
--     logo_width, logo_height, announcement, navigation
-- ) ON blog.site_settings TO blog_runtime;
-- GRANT SELECT, INSERT, UPDATE ON blog.posts TO blog_runtime;
-- GRANT SELECT, INSERT, DELETE ON blog.post_tags TO blog_runtime;
-- GRANT SELECT, INSERT, UPDATE ON blog.auth_sessions TO blog_runtime;
-- GRANT SELECT, INSERT, UPDATE ON blog.auth_rate_limits TO blog_runtime;
-- GRANT SELECT, INSERT, UPDATE ON blog.idempotency_keys TO blog_runtime;
-- GRANT SELECT, INSERT ON blog.post_audit_events TO blog_runtime;
-- GRANT SELECT ON blog.public_posts TO blog_runtime;
-- Do not grant runtime DELETE on posts/audit/accounts, CREATE on schema blog, or migration ownership.
