# Current State Evidence

## Repository facts

- Next.js `16.3.0`, React `19.2.8`, App Router, TypeScript and Tailwind CSS 4.
- Current business pages: `/`, `/archives`, `/tags`, `/tags/[slug]`, `/categories`, `/categories/[slug]`, `/about`, `/posts/[slug]`, `/account`.
- Current anonymous page: `/login`.
- Current Route Handlers: auth register/login/logout/me and media upload.
- Current content pages import the stable functions in `lib/content/repository.ts`; that module still derives everything from `content/site.ts` and `content/posts.ts` at module load.
- `app/(protected)/layout.tsx` is the authoritative page session boundary. Route Handlers must still authenticate independently.
- Current API response helpers already provide request IDs, the `{data, meta}` success envelope, the `{error}` envelope and `private, no-store`.
- Current database runtime exposes parameterized `queryRows`; no committed baseline migration or test runner exists yet.
- `components/blog/post-body.tsx` already owns exhaustive rendering for all current `ContentBlock` variants and should be reused for editor preview.
- `lib/media/client.ts` and `/api/v1/media` already provide the browser-to-R2 upload boundary.

## Existing contracts to reuse

- `.trellis/tasks/08-18-neon-api-database-docs/api.md`
- `.trellis/tasks/08-18-neon-api-database-docs/schema.sql`
- `.trellis/tasks/08-18-neon-api-database-docs/design.md`
- `.trellis/tasks/08-18-neon-api-database-docs/research/neon-contracts.md`

The earlier API contract covers content reads, auth/session operations, profile, owner post workflow and audit events. This task must add the missing owner site-settings write contract and taxonomy creation contract required by the approved management UI.

## Installed Next.js 16.3 guidance consulted

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`

Relevant conclusions:

- Route Handlers are uncached by default and do not participate in layouts.
- Server Components can query the database directly and should remain the default for page shells and initial data.
- Client Components should be limited to the editor, browser form state, uploads, dialogs and navigation guards.
- Client Component props must be serializable.
- `React.cache` is request-scoped and can deduplicate repeated authenticated reads without creating cross-request cache leakage.
- The project does not enable Cache Components; the authenticated product contract also requires `private, no-store`, so cross-request Next.js content caching is not part of this task.

## Confirmed user decisions

- Production forces Neon; development/test may explicitly select the local adapter. Database failures never automatically fall back.
- The editor directly edits structured `ContentBlock[]`; it has add/edit/move/copy/delete controls and no drag-and-drop or Markdown conversion.
- Drafts are saved manually. Unsaved navigation/refresh/close must warn the user.
- Audit events have a complete API and article-local recent history UI, but no standalone audit center in MVP.
- Local content import is an explicit CLI: dry-run by default, `--apply` writes in one transaction, refuses a target with articles and never overwrites the owner account.
