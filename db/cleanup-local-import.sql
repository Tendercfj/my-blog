-- 清理 scripts/import-local-content.mjs 写入的演示数据。
-- 执行前请先在同一连接中审阅目标集合；本脚本不会删除 owner、密码或 session。
BEGIN;

CREATE TEMP TABLE cleanup_local_import_posts ON COMMIT DROP AS
SELECT DISTINCT p.id, p.owner_id
FROM blog.posts AS p
JOIN blog.post_audit_events AS audit ON audit.post_id = p.id
JOIN blog.owner_accounts AS owner ON owner.id = p.owner_id AND owner.singleton_key = 1
WHERE audit.action = 'create'
  AND audit.changes->>'source' = 'local-import';

-- 只删除带有 local-import 来源审计的文章及其关系/审计。
DELETE FROM blog.post_tags
WHERE post_id IN (SELECT id FROM cleanup_local_import_posts);

DELETE FROM blog.post_audit_events
WHERE post_id IN (SELECT id FROM cleanup_local_import_posts)
   OR (
     action = 'create'
     AND changes->>'source' = 'local-import'
     AND actor_account_id IN (SELECT owner_id FROM cleanup_local_import_posts)
   );

DELETE FROM blog.posts
WHERE id IN (SELECT id FROM cleanup_local_import_posts);

-- 导入脚本使用的 taxonomy 只有在没有其他文章引用时才删除。
DELETE FROM blog.categories AS c
WHERE c.slug IN ('frontend', 'backend', 'design', 'tools', 'life')
  AND NOT EXISTS (SELECT 1 FROM blog.posts AS p WHERE p.category_id = c.id);

DELETE FROM blog.tags AS t
WHERE t.slug IN ('nextjs', 'typescript', 'react', 'css', 'accessibility', 'architecture', 'workflow', 'reading', 'photography', 'reflection')
  AND NOT EXISTS (SELECT 1 FROM blog.post_tags AS pt WHERE pt.tag_id = t.id);

-- 仅清掉导入的演示站点 singleton；owner/profile/session 保留。
DELETE FROM blog.site_settings
WHERE singleton_key = 1
  AND name = '棱镜手记'
  AND description = '记录设计、代码与日常观察的独立博客。'
  AND logo_src = '/images/brand/logo.svg'
  AND logo_alt = '棱镜手记标志';

UPDATE blog.author_profiles AS profile
SET name = split_part(owner.email, '@', 1),
    role = CASE WHEN profile.role = '独立博客站长' THEN '' ELSE profile.role END,
    bio = CASE WHEN profile.bio = '' THEN '' ELSE profile.bio END
FROM blog.owner_accounts AS owner
WHERE profile.account_id = owner.id
  AND owner.singleton_key = 1
  AND profile.name = '林屿';

-- 验证 owner/session 仍存在后提交；出现任何异常请 ROLLBACK。
SELECT id, email FROM blog.owner_accounts WHERE singleton_key = 1;
SELECT count(*) AS active_sessions FROM blog.auth_sessions WHERE revoked_at IS NULL;

COMMIT;
