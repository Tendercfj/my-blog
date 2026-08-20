-- Execute only after both migrations on a disposable PostgreSQL database.
-- Every fixture and assertion is rolled back.

BEGIN;

DO $contract$
DECLARE
    owner_id uuid;
    category_id uuid;
    post_id uuid;
    original_version bigint;
    touched_version bigint;
BEGIN
    INSERT INTO blog.owner_accounts (email, password_hash)
    VALUES ('owner@example.test', repeat('x', 32))
    RETURNING id INTO owner_id;

    BEGIN
        INSERT INTO blog.owner_accounts (email, password_hash)
        VALUES ('second@example.test', repeat('x', 32));
        RAISE EXCEPTION 'single-owner constraint did not reject a second account';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    INSERT INTO blog.categories (slug, name)
    VALUES ('contract', 'Contract')
    RETURNING id INTO category_id;

    INSERT INTO blog.posts (
        owner_id,
        slug,
        title,
        excerpt,
        status,
        category_id,
        cover_src,
        cover_alt,
        cover_width,
        cover_height,
        body,
        published_at
    )
    VALUES (
        owner_id,
        'schema-contract',
        'Schema contract',
        'Disposable verification fixture',
        'published',
        category_id,
        '/images/brand/logo.svg',
        'Contract cover',
        96,
        96,
        '[{"type":"paragraph","children":[{"type":"text","value":"body"}]}]'::jsonb,
        clock_timestamp()
    )
    RETURNING id, version INTO post_id, original_version;

    IF NOT EXISTS (SELECT 1 FROM blog.public_posts WHERE id = post_id) THEN
        RAISE EXCEPTION 'public view omitted a published post';
    END IF;

    UPDATE blog.posts SET title = 'Schema contract updated' WHERE id = post_id;
    SELECT version INTO touched_version FROM blog.posts WHERE id = post_id;
    IF touched_version <> original_version + 1 THEN
        RAISE EXCEPTION 'post version trigger did not increment exactly once';
    END IF;

    BEGIN
        UPDATE blog.posts SET slug = 'changed-after-publish' WHERE id = post_id;
        RAISE EXCEPTION 'published slug immutability was not enforced';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE blog.posts SET status = 'invalid' WHERE id = post_id;
        RAISE EXCEPTION 'post status constraint accepted an invalid status';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO blog.posts (owner_id, slug, title)
        VALUES (owner_id, 'schema-contract', 'Duplicate slug');
        RAISE EXCEPTION 'post slug uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO blog.post_audit_events (
            actor_account_id,
            post_id,
            action,
            request_id
        )
        VALUES (owner_id, post_id, 'invalid', gen_random_uuid());
        RAISE EXCEPTION 'audit action constraint accepted an invalid action';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    UPDATE blog.posts
    SET status = 'draft', deleted_at = clock_timestamp()
    WHERE id = post_id;
    IF EXISTS (SELECT 1 FROM blog.public_posts WHERE id = post_id) THEN
        RAISE EXCEPTION 'public view exposed a deleted draft';
    END IF;
END
$contract$;

ROLLBACK;
