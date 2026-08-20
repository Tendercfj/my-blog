-- Allow the approved R2 custom domain alongside checked-in /images assets.
-- Run once through DATABASE_URL_UNPOOLED after 0001_baseline.sql.

DO $migration$
BEGIN
    EXECUTE $ddl$
ALTER TABLE blog.author_profiles
    DROP CONSTRAINT author_profiles_avatar_src_ck
$ddl$;

    EXECUTE $ddl$
ALTER TABLE blog.author_profiles
    ADD CONSTRAINT author_profiles_avatar_src_ck CHECK (
        avatar_src ~ '^/images/'
        OR avatar_src ~ '^https://assets[.]tendercfj[.]cc[.]cd/.+'
    )
$ddl$;

    EXECUTE $ddl$
ALTER TABLE blog.posts
    DROP CONSTRAINT posts_cover_all_or_none_ck
$ddl$;

    EXECUTE $ddl$
ALTER TABLE blog.posts
    ADD CONSTRAINT posts_cover_all_or_none_ck CHECK (
        (cover_src IS NULL AND cover_alt IS NULL AND cover_width IS NULL AND cover_height IS NULL)
        OR
        (
            cover_src IS NOT NULL
            AND cover_alt IS NOT NULL
            AND cover_width IS NOT NULL
            AND cover_height IS NOT NULL
            AND (
                cover_src ~ '^/images/'
                OR cover_src ~ '^https://assets[.]tendercfj[.]cc[.]cd/.+'
            )
            AND btrim(cover_alt) <> ''
            AND cover_width > 0
            AND cover_height > 0
        )
    )
$ddl$;
END
$migration$;
