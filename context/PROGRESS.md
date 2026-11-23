# PROGRESS

Phase history for `context/PLAN.md`. Keep it compact: the status table plus one
short entry per merged phase, limited to the work commit, gate result,
deviations and accepted findings. Tighten older entries when adding a new one;
the plan and code hold the full rationale.

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
| P7 Categories | done | `phase-7-categories` | `d06dda2` | `a844770` |
| P8 UI shell | done | `phase-8-shell` | `47da9d5` | `0e7ab65` |
| P9 Feed and detail | done | `phase-9-feed-detail` | `cc34369` | pending |

## P0 — Bootstrap

Node 26.13.0 / pnpm 12.16.1 pinned exact. TypeScript 6.0.3 because SvelteKit
3.4.0 rejects 7; adapter chosen in `vite.config.ts`; `#lib/*` replaces `$lib`;
`allowBuilds` lives in `pnpm-workspace.yaml`; `bin/` is P14. Gates green;
audit 0.

## P1 — Database

`createDb()` is async, runs embedded `import.meta.glob` migrations tracked in
`__migration`, one transaction per file in byte order. 7 tests; audit 0/0/1/0.
Accepted: 5 s busy timeout; `0700` is a no-op on Windows; migration race
possible (desktop lock P14); no pre-migration backup; no index on
`session.expires_at`/`item_source.source_id`; a Turso URL without a token fails
at the first query; no `item_fts` rebuild.

## P2 — Auth

scrypt N=2^15 r=8 p=1, 32-byte key/16-byte salt; AES-256-GCM vault keyed from
`scrypt(password, crypto.salt)`, 12-byte IV; lockout 5 failures/15 min doubling
to 24 h; `l30_session` HttpOnly, SameSite=Lax, 30 days, rotated on login and
password change. 29 tests; audit 0/0/1/0. Fixed: reset is one transaction;
`mustChangePassword` blocks all APIs except password/session/logout; `/api/*`
no-store. Accepted: password route unthrottled (session already held);
password change drops undecryptable secrets; unknown peer shares one lockout
bucket; raw session ids (§S9). Deviations: sync `deriveKey`, 64 MiB scrypt
maxmem, `Handle` from `@sveltejs/kit/hooks`, one navigation-resolve disable.

## P3 — Sources and the fetch pass

`rss`/`hn`/`json` adapters; four in flight, 10 s timeout, 500/1500 ms retries,
200 items/source, three-strike disable, post-pass prune. `GET /api/sources`,
`PATCH /api/sources/[id]`, `POST /api/refresh` (SSE locally, `{batch:true}` on
Vercel). 40 tests, fixtures only; audit 0/0/1/0. Fixed: 5 MiB decompressed cap;
SSRF guard (http(s), no loopback/private/link-local/.internal, three redirects
re-checked); slice before map; a disconnected SSE client no longer aborts the
pass. Accepted: DNS rebinding; no in-flight refresh guard; `lastError` echoes
the URL/status; raw titles (P8 clamp). `rss-parser` added (no stdlib XML
parser).

## P4 — Ingest

`util/url.ts`; `util/dedup.ts` (`titleKey`, `jaccard`); `util/rank.ts`.
Canonical URL, identical normalised title, or Jaccard ≥0.72 within 48 h and the
same category; a match adds `item_source` and bumps `source_count`. Excerpts
≤800; missing dates estimated; script-based language. 29 new tests (155);
audit 0/0/1/0. Fixed: pinned `rss-parser`. Accepted: 48 h Jaccard scan (200 ×
window) with 64-token samples; concurrent title inserts can duplicate; a URL in
two categories keeps the first; item + link are two statements.

## P5 — Feed API

`feed/query.ts` holds parsing, the §S7 keyset cursor and one Drizzle query. The
cursor is base64url `[source_count, published_at, id]`, strictly validated.
`limit` is 1–100 (default 50) and always required internally. Effective date is
`published_at`, or `fetched_at` when estimated. `q` is a multi-token literal
`LIKE` over title/excerpt, with `%`, `_`, `\` escaped and caps of 200 chars /
12 tokens. `GET /api/feed` returns `{items,nextCursor}`; `GET /api/items/[id]`
returns `{item,sources,summary}` with source names only, no feed URLs.
`readJson` caps bodies at 256 KiB (413 `body_too_large`). 57 new tests (212
total); 20k-row p95 24 ms vs 120 ms; gates green; audit 0/0/1/0; no new
dependency or migration.

Pen-test: no critical/high. Two low accepted:

1. Rank key is mutable mid-scroll: a fetch that adds a source to a row below
   the cursor moves `source_count` 1→2 above it, so the rest of that scroll
   skips the row until refresh. The smallest fix sorts by immutable
   `(published_at, id)`, which changes §S7's locked rank.
2. Hostile 100k-char titles cross the wire 50 times. Truncating the wire
   projection hides the full title the detail pane promises to wrap; P8's
   render clamp and the P15 payload budget are the defence.

Deviations: `src/lib/types.ts` is the §S1 shared shape; `q` stays a LIKE
baseline until P10; the 200/12 caps are not in §S13; 256 KiB is a transport
bound; no new index; `FeedParams.limit` is required.

## P6 — Summaries

`ai/provider.ts` maps `ai.providers` to a `LanguageModel` (OpenAI, Anthropic
and Google use their adapters; the rest use `createOpenAICompatible`). The
first enabled valid entry wins; the cache key is `<provider>:<model>`;
`secret.ai.<id>.key` is decrypted only for a generation. `ai/prompt.ts` keeps
user data out of the system prompt and wraps title/source/date/excerpt (≤6000
chars) in an escaped `<article>` marked untrusted. `ai/summary.ts` validates
strict JSON (summary ≤480, 2–4 key points, optional why ≤180), rejects URLs,
markdown, HTML, control and bidi characters, makes exactly one repair, then
stores nothing; citations come from `item_source`. `POST
/api/items/[id]/summary` serves cache before the vault; `POST
/api/settings/ai/test` makes one tiny call and saves nothing. The detail
response adds `keyPoints` and `whyItMatters`. 70 new tests (282 total); gates
green; audit 0/0/1/0; migration `0002_optimal_blockbuster.sql` adds the two
columns.

Pen-test: no critical/high. Medium fixed: the test route could send a stored
key to any request `baseUrl`; now only to the configured endpoint, else 400.
Output rejects HTML/URLs/markdown/control/bidi; citations are server-side.

Accepted limits: no per-session AI rate limit or in-flight dedupe (parallel
paid calls are bounded by auth, the item/model cache, 700 output tokens, a 60 s
timeout and one repair; a rate limit belongs to a later settings phase);
provider base URLs are owner-controlled and the SDK follows their redirects,
while a request-supplied endpoint never receives the stored key.

Deviations: `l30_vault` is a second HttpOnly cookie holding the
password-derived data key encrypted under the session id, so later requests
decrypt AI keys without global state (§S19); DB theft yields no key, cached
summaries still read and generation is 409 `ai_locked` until sign-in. `ai`
7.0.179 plus four `@ai-sdk/*` adapters are §S1's stack (Node has no provider
clients). `ai.providers` / `secret.ai.<id>.key` names are for P12. The 60 s /
30 s timeouts and `maxRetries: 0` are bounded-cost additions.

## P7 — Categories

`feed/keywords.ts` matches ASCII word boundaries and escapes GLOB wildcards.
`categories/filter.ts` uses `item.category` for builtins, `item_source` for
pinned custom sources, all items when a custom category pins none, and scores
keyed by `sha1(prompt)`. `feed/query.ts` projects the cached `score`/`reason`
only when a scored category admits the row. `ai/score.ts` scores 20 per call,
200 per open, skips cached rows, caps titles at 300 and excerpts at 800,
temperature 0, 900 output tokens, one repair, missing id stored as 0; `both`
excludes keyword hits in SQL before the 200 cap. Routes: `/api/categories`
CRUD (builtin 403, unique names, `usr-<slug>` ids), `/rescore` SSE
(`progress`/`degraded`/`done`, optional empty body and `reset`), `/feed-check`,
and `POST /api/sources` (one probe, one transaction, no row on failure).
Seeded builtins now own their six source pins. 87 new tests (369 total); gates
green; audit 0/0/1/0; no migration, no dependency.

Pen-test fixes: high — SSRF guard now covers IPv4-mapped/compatible IPv6,
ULA, link-local, multicast, NAT64, CGNAT and `*.localhost`, throws typed
`UnsafeUrlError`, rechecks every redirect, omits credentials, and bounds a
feed title to 120 chars before it becomes a source name. Medium — the `both`
budget excludes keyword hits in SQL; score prompts cap titles; a mid-open
query failure still closes the SSE stream with `degraded` + `done`.

Accepted limits: 10k keywords take 63 s on 1,000 items versus 892 ms with FTS
(exact punctuation/boundary kept; single-owner, no crash); DNS rebinding
unchecked; no per-session AI rate limit (P6); old prompt-hash rows orphaned;
SQLite `lower()` folds ASCII only; an empty custom category shows every item
until a layer is set; source URL uniqueness is checked before insert, not
constrained.

Deviations: scoring runs from `/rescore`, not `GET /api/feed`, so the feed
stays read-only; each keyword is capped at 200 chars; `itemCount` counts
cached/visible items; source ids are `src-<sha1>`.

## P8 — UI shell

`@theme` exposes every §S11 colour, radius, spacing and text token; `app.css`
adds the base type scale, focus ring and hand-written `.pane`, `.btn`, `.seg`,
`.chip`, `.tag`, `.search`, `.iconbtn`, `.fav`, `.item` classes. `/app` is a
100vh `auto/minmax(0,1fr)/auto` grid with full-bleed square top/status bars
and three 10px panes separated by 2px. The logo and favicon share one locked
glyph; the favicon is an inline data URI. Theme is read from `l30_theme`
before paint; no cookie follows `prefers-color-scheme` through `light-dark()`.
5 new tests (374 total); gates green; audit 0/0/1/0; no dependency or
migration.

Pen-test: low — below 320px the topbar's automatic minimum clipped its
actions; `min-width: 0` on the bar and search fixes it, with no overflow at
280. SvelteKit's runtime announcer inserts one fixed inline style, so
`style-src` allows `unsafe-hashes` plus that exact hash and no
`unsafe-inline`; scripts get a per-request nonce. The constant glyph is
`{@html}` and its test rejects scripts/handlers; malformed theme cookies fall
back to system.

Deviations: the theme class is injected through an `app.html` placeholder,
not a script; CSP moved to `vite.config.ts` so SvelteKit can nonce its
bootstrap; the announcer hash is tied to the pinned SvelteKit version.

## P9 — Feed and detail

`/app` server-loads the 24h feed and categories, then filters, paginates and
refreshes through `/api/feed` and `/api/refresh`. `ItemRow` clamps the title to
two lines and shows initials, relative time, source count and a `why` callout;
`FeedPane` covers skeleton, empty, error and Load more; `DetailPane` renders
attribution, summary, key points, citations, the generate action and a
relevance footer, with the summary scrolling inside the pane. `sourceName`
joins the feed projection; `format.ts` adds relative time, initials,
control/bidi stripping and http(s)-only hrefs. 57 new tests (431 total); full
gate green; audit 0/0/1/0; no dependency or migration.

Pen-test: medium — the detail route has no category context, so the selected
feed row now supplies `score`/`reason`; low — fav initials now strip bidi and
controls. Accepted: repeated Load more grows the DOM (50 per click, user-
driven); below 720px the detail pane is hidden (P13 navigation); refresh and
feed requests have no abort on unmount (bounded by request ids and 100 rounds).

Deviations: time presets, category filter, cursor pagination and refresh are
wired here; refresh polls `{batch:true}` instead of SSE; the live
`Scoring n of m` footer stays in P11; source errors stay in P13.

## Working rules adopted mid-project

- One branch per phase, feature or fix; merged with `--no-ff` and kept.
- Inner loop: `pnpm lint:changed`, `typecheck:changed`, `test:changed`; full
  gate once before merge.
- Critical/high findings get a reproducing test before commit; the rest are
  discussed and recorded here.
- Every phase starts by reading `.agents/skills/last30days-news/SKILL.md`.
