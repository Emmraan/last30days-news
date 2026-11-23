# PROGRESS

Phase-by-phase record of `context/PLAN.md`. One entry per merged phase, newest
at the bottom. Each entry names the commit, the gate result, the deviations
from the plan, and any finding accepted as a known limitation.

`main` only moves by `--no-ff` merge, so every phase has two commits: the work
and its merge.

## Status

| Phase | Status | Branch | Work | Merge |
| --- | --- | --- | --- | --- |
| P0 Bootstrap | done | `phase-0-bootstrap` | `d990d77` | `d990d77` (fast-forward, branch kept) |
| P1 Database | done | `phase-1-database` | `15f8c49` | `1ee6b1a` |
| P1 review | done | — | `827acda` | direct, on `main` |
| P2 Auth | done | `phase-2-auth` | `55f99c1` | `9be19aa` |
| P3 Sources and fetch | done | `phase-3-sources` | `9b418d8` | `a4fbce6` |
| Docs: skill lookup rule | done | `docs-skill-lookup-rule` | `1a0b6b8` | `42d32ac` |
| P4 Ingest | done | `phase-4-ingest` | `2c6ecd5` | `e945c70` |
| P5 Feed API | done | `phase-5-feed-api` | `10c7f91` | `ba496be` |
| P6 Summaries | done | `phase-6-summaries` | `918808f` | `7a70e3b` |

## P0 — Bootstrap

Toolchain pinned exact: Node `26.13.0`, pnpm `12.16.1`. Gates green, `audit`
0 findings.

Deviations:

- `typescript` pinned `6.0.3`, not `7.0.2`. SvelteKit 3.4.0 rejects 7 with
  `typescript_compiler_api_missing`.
- SvelteKit 3 dropped `svelte.config.js`. The adapter is chosen inside
  `sveltekit({ adapter })` in `vite.config.ts`; `VERCEL === '1'` picks
  `adapter-vercel`, otherwise `adapter-node`.
- `$lib` is gone in SvelteKit 3. Subpath imports `#lib/*` in `package.json`,
  mirrored by `paths` in `tsconfig.json`. `tsconfig.json` extends
  `$app/tsconfig`.
- pnpm 12.16.1 ignores the `pnpm` field in `package.json`, so
  `allowBuilds: { esbuild: true }` lives in `pnpm-workspace.yaml`.
- `bin/last30days.js` deferred to P14.
- `pnpm audit` is pnpm's built-in command and cannot be shadowed by a script.
  The gate is `pnpm audit:gate` (`node scripts/audit.mjs`): it prints severity
  counts and exits 1 only on critical or high.

## P1 — Database

`createDb()` is async and runs migrations itself. Migrations are embedded at
build time with `import.meta.glob('../../../../drizzle/*.sql', { query: '?raw',
eager: true })`; a `__migration` table tracks applied names; each file runs in
its own `client.transaction('write')` with `executeMultiple()` so trigger bodies
survive, and the row is inserted inside the same transaction.

7 tests. Gates green; `audit` critical 0 / high 0 / moderate 1 / low 0.

Deviations:

- The plan's "delete `db.sqlite` and boot again" test is not in the suite.
  Windows keeps the libSQL file handle about 29 s after `close()`, so the file
  cannot be deleted. Replaced with "reopens the same file without losing data",
  which covers the same property.

## P1 — review

One defect fixed: `applyMigrations` sorted with `localeCompare`, so the order
depended on the host's collation. Now byte order, with a test asserting
`__migration` insertion order is sorted.

Accepted as known limitations, reasons in `827acda`:

- No `busy_timeout`; `@libsql/client` already defaults to 5000 ms.
- The data dir is created `0700` but the mode is a no-op on Windows.
- Two processes booting one file could race a pending migration. Single
  instance desktop app; the lock file is P14.
- No backup before migrating. Each file's transaction rolls back.
- No index on `session.expires_at` or `item_source.source_id`.
- `TURSO_DATABASE_URL` without `TURSO_AUTH_TOKEN` fails at the first query.
- `item_fts` has no rebuild step.

## P2 — Auth

scrypt N=2^15 r=8 p=1, 32-byte key, 16-byte salt, stored
`scrypt$N$r$p$<salt-b64>$<hash-b64>`. AES-256-GCM vault keyed by
`scrypt(password, crypto.salt)`, per-secret 12-byte IV. DB-backed lockout, 5
failures per 15 min, doubling to 24 h. Session cookie `l30_session`, HttpOnly,
SameSite=Lax, 30 days, rotated on login and password change.

29 tests across `tests/auth-routes.test.ts` and `tests/hooks.test.ts`. Gates
green; `audit` moderate 1.

Fixed after the pen-tester pass:

1. **High.** `reset` was not transactional: a crash between deleting
   `auth.password` and writing the new hash left no password, so the public
   default `last30` logged in again. Now one `db.transaction`, with a test that
   raises from a real SQLite trigger and asserts the old password still works.
2. **Medium.** `mustChangePassword` was computed but never enforced. Every
   `/api/*` except password, session and logout now answers 403
   `password_change_required`.
3. **Medium.** Auth JSON was cacheable. `/api/*` responses carry
   `cache-control: no-store`.

Accepted as known limitations:

- The password route is unthrottled. The caller already holds a session, and a
  per-IP lock would let one client freeze the owner out.
- `readJson` has no body cap. `adapter-node` caps at 512 KB; Vercel needs one,
  added in P5.
- Password change drops secrets that fail to decrypt rather than carrying an
  unreadable blob forward.
- `pruneSessions` / `pruneAttempts` exist but are called from the P3 pass.
- An unknown peer address shares one lockout bucket. Failing open is worse.
- Session ids are stored raw, as §S9 specifies.

Deviations:

- `deriveKey` is synchronous (`scryptSync`) so tests call it without `await`.
- Both `password.ts` and `secret.ts` pass `maxmem: 64 MiB`. Node's 32 MiB
  default is exactly `128*N*r` and rejects the specified params.
- `Handle` moved to `@sveltejs/kit/hooks` in SvelteKit 3.
- `svelte/no-navigation-without-resolve` needs `resolve()` from `$app/paths`,
  but `?next=` is a runtime path, so that one call carries a disable comment
  with the reason.

## P3 — Sources and the fetch pass

Three adapters (`rss`, `hn`, `json`) return one `RawItem` shape. `runPass`
takes the due sources, four in flight, 10 s timeout, retries at 500 ms then
1500 ms jittered, 200 items per source, writes status and error, disables a
source after three consecutive failures, and prunes after the pass. Routes:
`GET /api/sources`, `PATCH /api/sources/[id]` (`{enabled}` only),
`POST /api/refresh` (SSE locally, `{batch:true}` for one batch on Vercel).

40 new tests across `tests/{sources,pass,sources-routes}.test.ts` and
`src/lib/util/url.test.ts`. All from `fixtures/`, no socket opened. Gates
green; `audit` moderate 1.

Fixed after the pen-tester pass:

1. **High.** Unbounded feed body. `readText` now caps the decompressed stream
   at 5 MiB and cancels past it, so a zip bomb is caught too.
2. **High.** SSRF. `safeFetch` allows http(s) only, rejects loopback, private,
   link-local and `.internal` hosts, follows at most three redirects with
   `redirect: 'manual'`, and re-validates every `location`.
3. **Medium.** A 50k-item feed allocated 50k objects before the 200 cap. The
   slice now happens before mapping.
4. **Medium.** A disconnected SSE client aborted the pass. `emit` is wrapped;
   the remaining sources still get fetched.

Accepted as known limitations:

- DNS rebinding is not defended: the literal host is checked, the resolved IP
  is not pinned.
- No in-flight guard on `/api/refresh`, so two passes can overlap. Each is
  capped at four fetches.
- `lastError` echoes the feed URL and the HTTP status. Neither is a secret.
- Titles are stored raw. Svelte escapes them on render; the client-side clamp
  is P8.
- `rss-parser 3.13.0` added: Node has no XML parser, and hand-rolling one over
  hostile feeds is worse.

## P4 — Ingest

`util/url.ts` was already in place from P3; P4 added `util/dedup.ts`
(`titleKey`, `jaccard`), `util/rank.ts` (`compareRank`) and the §S7 dedup in
`ingest/insert.ts`: canonical URL, identical normalised title, or Jaccard
≥ 0.72 within 48h, all same-category. A match keeps the existing row and only
adds `item_source`, bumping `source_count` when the link is new. Excerpts are
HTML-stripped and capped at 800, missing dates become `published_estimated`,
and language is a script heuristic (BCP-47, §S20).

29 new tests across `src/lib/util/{dedup,rank}.test.ts` and
`tests/ingest.test.ts`. Gates green (155 tests, build); `audit` critical 0 /
high 0 / moderate 1 / low 0.

Fixed before the merge:

- `rss-parser` was the one floating specifier (`^3.13.0`); pinned to `3.13.0`
  as §S1 requires. The lockfile change is the specifier only.

Deviations:

- The ranking comparator lives in `util/rank.ts`, which §1 does not list.
  §S23 wants one unit per file next to the source and P4 requires the
  comparator; P5's feed query imports it.

Accepted as known limitations:

- Jaccard compares every candidate inside the 48h window: O(200 incoming ×
  window size), with titles sampled to 64 tokens. An inverted index waits
  until P5 measures the real feed.
- Two sources inserting different URLs for the same story concurrently can
  create two rows. Canonical-URL duplicates are protected by the item primary
  key; the title/Jaccard read-then-write window is not.
- A canonical URL that appears in two categories keeps whichever category
  inserted first, not "first source in seed order". Enforcing seed order needs
  a source priority column and a rewrite of the existing row, which
  contradicts "cross-category is never merged".
- Item and `item_source` are two statements, not one transaction. A crash
  between them leaves an item with no attribution; the pass would have to fail
  at exactly that point.

## P5 — Feed API

`feed/query.ts` holds the read path: parameter parsing, the §S7 keyset
cursor, and one Drizzle query. The cursor is base64url of
`[source_count, published_at, id]`, validated strictly and compared with the
same tuple the SQL sorts by. `limit` is 1–100 (default 50) and always
required internally, so no caller can run an unbounded feed query. Time
filters use the effective date (§S3): `published_at`, or `fetched_at` when
`published_estimated`. `q` is a multi-token, case-insensitive literal `LIKE`
over title and excerpt, with `%`, `_` and `\` escaped and caps of 200 chars /
12 tokens; P10 replaces it with FTS5 and bm25. `GET /api/feed` returns
`{items,nextCursor}`. `GET /api/items/[id]` returns `{item,sources,summary}`
with source names but no feed URLs, and the newest cached summary or null.

57 new tests: 29 unit in `feed/query.test.ts` (cursor round-trip and forgery,
parameter edges), 9 integration in `tests/feed.test.ts`, 14 route cases in
`tests/feed-routes.test.ts`, 5 in `tests/api.test.ts`. The 20k-row test walks
400 pages at `limit=50`, asserts every id exactly once, and measures p95
24 ms against the 120 ms budget. `readJson` now caps bodies at 256 KiB while
reading, closing the P2 deferral; oversized bodies are 413 `body_too_large`.
Full suite 212 tests. Gates green; `audit:gate` critical 0 / high 0 /
moderate 1 / low 0. No new dependency and no migration.

Pen-tester pass: no critical or high findings. Verified auth (the hook's
existing 401 and `password_change_required` tests already cover `/api/feed`),
inert FTS/SQL metacharacters in `q` and `category`, forged and overseized
cursors, `limit=100000`, the 2-char search minimum, JSON bodies over the cap,
`no-store` on API responses, and no disabled feed URL in the detail payload.
Two low findings are accepted:

1. **Low — the rank key is mutable mid-scroll.** Reproduction: page once,
   then let a fetch pass add a second source to a row below the cursor; its
   `source_count` 1→2 moves it above the cursor, so the rest of that scroll
   skips it until refresh. The smallest fix is to sort by an immutable
   `(published_at,id)` and use `source_count` only as a badge, which changes
   §S7's locked rank. The row is never lost, so it waits for a rank redesign.
2. **Low — titles cross the wire verbatim.** A hostile feed can store a
   100k-char title, and the feed payload carries it 50 times. The smallest
   fix truncates the wire projection, but that hides the full title the detail
   pane promises to wrap. P8's render clamp and the P15 payload budget are the
   planned defence; this continues P4's decision to store titles raw.

Deviations:

- `src/lib/types.ts` is the §S1 shared shape file, first needed by the feed
  and detail responses.
- `q` is a `LIKE` baseline until P10 owns FTS5, bm25 and the exact query
  builder. P5 still enforces the 2-char minimum and composes `q` with the
  other filters as `AND`.
- The 200-char / 12-token search caps are not in §S13. They bound the LIKE
  fan-out; §S24 lists the hostile-input axis.
- The 256 KiB body cap is a transport bound, not a product cap on prompts. It
  satisfies the P2 note: Vercel had none, `adapter-node` caps at 512 KiB.
- No new index. 20k rows re-sort within the budget and §S2's index set is
  locked.
- `FeedParams.limit` is required rather than optional, so an internal caller
  cannot forget the bound.

## P6 — Summaries

`ai/provider.ts` turns `ai.providers` into a `LanguageModel`: OpenAI, Anthropic
and Google use their own adapters; OpenRouter, Groq, DeepSeek, Ollama, LM
Studio and a custom endpoint use `createOpenAICompatible` with a base URL.
Entries are parsed one at a time and the first enabled valid one is active;
the cache key is `<provider>:<model>` and `secret.ai.<id>.key` is decrypted
only when a generation is needed. `ai/prompt.ts` keeps the system prompt free
of user data and wraps title/source/date/excerpt (≤6000 chars) in an escaped
`<article>`; the text is declared untrusted. `ai/summary.ts` validates strict
JSON (summary ≤480, 2–4 key points, optional why ≤180), rejects URLs, markdown,
HTML, control and bidi characters, makes exactly one repair call, then stores
nothing; citations come from `item_source`. `POST /api/items/[id]/summary`
serves a cached summary before it asks for the key, and `POST
/api/settings/ai/test` makes one tiny call and saves nothing. `GET
/api/items/[id]` now carries `keyPoints` and `whyItMatters`.

70 new tests (282 total): provider config/factory, prompt escaping and caps,
output validation, real-DB generation/caching/citations/repair, the two routes,
vault-cookie round-trip and auth cookie flow. Gates green (lint, typecheck,
test, build); `audit:gate` critical 0 / high 0 / moderate 1 / low 0. New
migration `0002_optimal_blockbuster.sql` adds `summary.key_points` and
`summary.why_it_matters`.

Pen-tester pass: no critical or high findings. One medium was fixed before the
commit: `/api/settings/ai/test` would send a stored key to any base URL in the
request, letting a session point it at a host it controls. A stored key now
only travels to the endpoint it was configured for; a different endpoint needs
the key in the request. Reproducing test in `tests/ai-test-route.test.ts`.
The summary output rejects HTML, URLs, markdown, control and bidi characters,
so a hostile model reply cannot become markup or a spoofed direction; the
citations are built server-side and the model cannot supply them.

Accepted as known limitations:

- No per-session rate limit or in-flight dedupe on AI generation. A signed-in
  user can issue parallel requests for different items, each a paid call.
  Every call is bounded by 700 output tokens, a 60 s timeout, one repair and
  the `(item_id, model)` cache; a rate limit belongs to a later settings phase.
- A provider base URL is owner-controlled. The SDK follows redirects from that
  endpoint, so a hostile configured endpoint is outside the threat model; a
  request-supplied endpoint never receives the stored key.

Deviations:

- `l30_vault` is a second HttpOnly cookie, next to §S9's `l30_session`. It holds
  the password-derived data key encrypted under the session id, so a later
  request can decrypt AI keys without a process-wide cache (§S19). The DB has
  the session ids but not this ciphertext, so a stolen database still yields no
  key. Sessions without the cookie can read a cached summary; generation is
  `409 ai_locked` until the user signs in again. Existing P2 sessions stay
  valid for everything that does not need a key.
- `ai` 7.0.179 and the four `@ai-sdk/*` adapters are §S1's pinned AI SDK. Node
  has no client for these provider protocols and hand-rolling them would
  duplicate auth, retries and response parsing.
- The summary columns and the `ai.providers` / `secret.ai.<id>.key` setting
  names are new; P12 should reuse them when it builds the settings screen.
- The 60 s summary timeout, 30 s test timeout and `maxRetries: 0` are not in
  §S8; they bound a failed or looping provider call.

## Working rules adopted mid-project

- One branch per phase, feature or fix; merged with `--no-ff` and kept.
- `pnpm lint:changed`, `typecheck:changed`, `test:changed` are the inner loop.
  The full gate runs once, before the merge.
- Critical and high findings are fixed before the commit, with a reproducing
  test. Everything else is discussed first.
- Every phase starts by reading `.agents/skills/last30days-news/SKILL.md` and
  loading the skills it names for that kind of work.
