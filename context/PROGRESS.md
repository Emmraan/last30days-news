# PROGRESS

Phase history for `context/PLAN.md`. Keep it compact: the status table plus one
short entry per phase commit, limited to the work commit, gate result,
deviations and accepted findings. Work committed but not merged is marked
`committed` and keeps the merge column empty. Tighten older entries when adding
a new one; the plan and code hold the full rationale.

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
| P9 Feed and detail | done | `phase-9-feed-detail` | `cc34369` | `9e8d53d` |
| P10 Search | done | `phase-10-search` | `8faa930` | `77f03e2` |
| P11 Category manager | done | `phase-11-categories` | `6695835` | `27dfa41` |
| P12 Settings | done | `phase-12-settings` | `f2e74d5` | `675a551` |
| P13 Keyboard and offline | done | `phase-13-keyboard-states` | `7e8176f` | `d6191b4` |
| Fix: first-run password + seed | done | — | `4ac1b3c` | direct, on `main` |
| Fix: CSP inline styles | done | — | `58998e8` | direct, on `main` |
| P14 Dashboard + landing showcase | done | `phase-14-landing` | `e9aae09` | `0ac90e1` |
| P15 Install, budgets, CI | committed | `phase-15-install` | `1e16a63` + `f2446fb` + `e9ac5e2` + `ca712bd` | - |

## P0 — Bootstrap

Node 26.13.0 / pnpm 12.16.1 pinned exact. TypeScript 6.0.3 because SvelteKit
3.4.0 rejects 7; adapter chosen in `vite.config.ts`; `#lib/*` replaces `$lib`;
`allowBuilds` lives in `pnpm-workspace.yaml`; `bin/` is P15. Gates green;
audit 0.

## P1 — Database

`createDb()` is async, runs embedded `import.meta.glob` migrations tracked in
`__migration`, one transaction per file in byte order. 7 tests; audit 0/0/1/0.
Accepted: 5 s busy timeout; `0700` is a no-op on Windows; migration race
possible (desktop lock P15); no pre-migration backup; no index on
`session.expires_at`/`item_source.source_id`; a Turso URL without a token fails
at the first query; no `item_fts` rebuild.

## P2 — Auth

scrypt N=2^15 r=8 p=1; AES-256-GCM vault keyed from `scrypt(password,
crypto.salt)`; lockout 5 failures/15 min doubling to 24 h; `l30_session`
HttpOnly, SameSite=Lax, 30 days, rotated on login and password change. 29
tests; audit 0/0/1/0. Fixed: reset is one transaction; `mustChangePassword`
blocks all APIs except password/session/logout; `/api/*` no-store. Accepted:
password route unthrottled (session already held); password change drops
undecryptable secrets; unknown peer shares one lockout bucket; raw session ids
(§S9). Deviations: sync `deriveKey`, 64 MiB scrypt maxmem, `Handle` from
`@sveltejs/kit/hooks`.

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
≤800; missing dates estimated; script-based language. 29 new tests (155); audit
0/0/1/0. Fixed: pinned `rss-parser`. Accepted: 48 h Jaccard scan (200 × window)
with 64-token samples; concurrent title inserts can duplicate; a URL in two
categories keeps the first; item + link are two statements.

## P5 — Feed API

`feed/query.ts` holds parsing, the §S7 keyset cursor and one Drizzle query. The
cursor is base64url `[source_count, published_at, id]`. `limit` is 1–100
(default 50). Effective date is `published_at`, or `fetched_at` when estimated.
`q` is a multi-token literal `LIKE` over title/excerpt, escaped, capped at 200
chars / 12 tokens. `GET /api/feed` returns `{items,nextCursor}`;
`GET /api/items/[id]` returns `{item,sources,summary}` with source names only.
`readJson` caps bodies at 256 KiB (413). 57 new tests (212); 20k-row p95 24 ms
vs 120 ms; audit 0/0/1/0; no dependency or migration.

Pen-test: no critical/high. Accepted low: (1) rank key is mutable mid-scroll —
a fetch adding a source moves `source_count` past the cursor and the row is
skipped until refresh; fixing it changes §S7's locked rank. (2) Hostile
100k-char titles cross the wire 50 times; P8's render clamp and the P15 payload
budget are the defence.

Deviations: `src/lib/types.ts` is the §S1 shared shape; `q` stays a LIKE
baseline until P10; 256 KiB is a transport bound; `FeedParams.limit` required.

## P6 — Summaries

`ai/provider.ts` maps `ai.providers` to a `LanguageModel`; first enabled valid
entry wins; cache key `<provider>:<model>`; `secret.ai.<id>.key` decrypted only
for a generation. `ai/prompt.ts` keeps user data out of the system prompt and
wraps title/source/date/excerpt (≤6000) in an escaped `<article>` marked
untrusted. `ai/summary.ts` validates strict JSON (summary ≤480, 2–4 key points,
why ≤180), rejects URLs/markdown/HTML/control/bidi, makes one repair, then
stores nothing; citations come from `item_source`. `POST
/api/items/[id]/summary` serves cache before the vault; `POST
/api/settings/ai/test` saves nothing. 70 new tests (282); audit 0/0/1/0;
migration `0002_optimal_blockbuster.sql`.

Pen-test: medium fixed — the test route could send a stored key to any request
`baseUrl`; now only to the configured endpoint, else 400. Accepted: no
per-session AI rate limit or in-flight dedupe (bounded by auth, cache, 700
output tokens, 60 s timeout, one repair); provider base URLs are
owner-controlled while a request-supplied endpoint never receives the key.

Deviations: `l30_vault` is a second HttpOnly cookie holding the
password-derived data key encrypted under the session id (§S19); DB theft
yields no key, cached summaries still read, generation is 409 `ai_locked`. `ai`
7.0.179 plus four adapters are §S1's stack. 60 s / 30 s timeouts and
`maxRetries: 0` are bounded-cost additions.

## P7 — Categories

`feed/keywords.ts` matches ASCII word boundaries and escapes GLOB wildcards.
`categories/filter.ts` uses `item.category` for builtins, `item_source` for
pinned custom sources, all items when a custom category pins none, and scores
keyed by `sha1(prompt)`. `feed/query.ts` projects the cached `score`/`reason`
only when a scored category admits the row. `ai/score.ts` scores 20 per call,
200 per open, skips cached rows, temperature 0, one repair, missing id stored
as 0; `both` excludes keyword hits in SQL before the cap. Routes:
`/api/categories` CRUD (builtin 403, unique names, `usr-<slug>` ids),
`/rescore` SSE, `/feed-check`, and `POST /api/sources` (one probe, one
transaction). 87 new tests (369); audit 0/0/1/0; no migration, no dependency.

Pen-test fixes: high — SSRF guard now covers IPv4-mapped/compatible IPv6, ULA,
link-local, multicast, NAT64, CGNAT and `*.localhost`, throws typed
`UnsafeUrlError`, rechecks every redirect, omits credentials, and bounds a feed
title to 120 chars. Medium — the `both` budget excludes keyword hits in SQL; a
mid-open query failure still closes the stream with `degraded` + `done`.

Accepted limits: 10k keywords take 63 s on 1,000 items versus 892 ms with FTS;
DNS rebinding unchecked; no per-session AI rate limit (P6); old prompt-hash
rows orphaned; SQLite `lower()` folds ASCII only; an empty custom category
shows every item; source URL uniqueness is checked before insert.

Deviations: scoring runs from `/rescore`, not `GET /api/feed`; keywords capped
at 200 chars; source ids are `src-<sha1>`.

## P8 — UI shell

`@theme` exposes every §S11 token; `app.css` adds the base type scale, focus
ring and hand-written `.pane`, `.btn`, `.seg`, `.chip`, `.tag`, `.search`,
`.iconbtn`, `.fav`, `.item` classes. `/app` is a 100vh `auto/minmax(0,1fr)/auto`
grid with full-bleed square top/status bars and three 10px panes separated by
2px. Theme is read from `l30_theme` before paint; no cookie follows
`prefers-color-scheme` through `light-dark()`. 5 new tests (374); audit
0/0/1/0; no dependency or migration.

Pen-test: low — below 320px the topbar's automatic minimum clipped its actions;
`min-width: 0` fixes it. `style-src` allows `unsafe-hashes` plus the announcer's
exact hash and no `unsafe-inline`; scripts get a per-request nonce. The
constant glyph is `{@html}` and its test rejects scripts/handlers.

Deviations: the theme class is injected through an `app.html` placeholder, not
a script; CSP lives in `vite.config.ts` so SvelteKit can nonce its bootstrap.

## P9 — Feed and detail

`/app` server-loads the 24h feed and categories, then filters, paginates and
refreshes through `/api/feed` and `/api/refresh`. `ItemRow` clamps the title to
two lines and shows initials, relative time, source count and a `why` callout;
`FeedPane` covers skeleton, empty, error and Load more; `DetailPane` renders
attribution, summary, key points, citations, the generate action and a
relevance footer. `format.ts` adds relative time, initials, control/bidi
stripping and http(s)-only hrefs. 57 new tests (431); full gate green; audit
0/0/1/0; no dependency or migration.

Pen-test: medium — the detail route has no category context, so the selected
row now supplies `score`/`reason`; low — fav initials strip bidi and controls.
Accepted: repeated Load more grows the DOM; below 720px the detail pane is
hidden (P13); refresh and feed requests have no abort on unmount.

Deviations: refresh polls `{batch:true}` instead of SSE; the live `Scoring n of
m` footer stays in P11; source errors stay in P13.

## P10 — Search

`search/fts.ts` quotes every whitespace token, doubles embedded quotes and
prefixes the last one; the query is always bound. `queryFeed` ranks with
`-bm25(item_fts,3.0,1.0)`, then `published_at desc, id asc`, and keeps the
opaque keyset cursor (`rank`, `published_at`, `id`). The topbar search debounces
250 ms and only searches from two characters. Boot probes `pragma_module_list`;
an FTS5-less target skips migration `0001` and search falls back to one escaped
title `LIKE`. 28 new tests (459); audit 0/0/1/0; no dependency or migration.

Pen-test: no critical/high. Fixed low — `q=%00%00` passed the length check but
built an empty MATCH and returned 500; NUL is now stripped at parse. Accepted:
bm25 is corpus-dependent, so inserts during a scroll can shift the rest of it;
the LIKE fallback full-scans titles; `VACUUM` would renumber `item.rowid` and
stale the index.

Deviations: the search cursor is a separate shape server-side but stays opaque
on the wire; `/` focus and Esc clear remain P13.

## P11 — Category manager

`CategoryPanel.svelte` lives inside `/app` as a pane, not a route: list, move
up/down, rename, delete, re-score, and a create form (name, source checkboxes,
feed URL checked inline through `/api/categories/feed-check`, prompt, keywords,
threshold). Pure logic is in `category-panel.ts` (`moveCategory`,
`parseKeywords`, `takeScoreEvents`). Reorder PATCHes `sortOrder` only for rows
whose value changed. 11 files; 38 tests in the changed set; full gate green;
audit 0/0/1/0; no dependency, no migration.

Pen-test fixes: high — reorder was a no-op when legacy rows shared
`sortOrder` 0 with builtins, so `moveCategory` now returns a positional
`{id, sortOrder}` per row; high — builtin categories could not be reordered at
all, now a `sortOrder`-only PATCH is allowed (`orderOnly`) while content and
blend changes still 403; medium — a remote feed title was rendered straight
into the panel, now through `displayText()`.

Accepted limits: no rate limit on `/feed-check` or `/rescore` (authenticated,
10 s timeout, 5 MiB cap, 200-item score cap each); one open rescore SSE stream
per tab, no server-side concurrency cap; DNS rebinding and
`127.0.0.1.nip.io`-style names still pass the SSRF literal-host check (P3/P7).

Deviations: `FeedCategory` removed from `lib/types.ts` in favour of the shared
`CategoryView`; the app loader widens categories through `categoryViews()`;
sources are loaded once on mount.

## P12 — Settings

`SettingsPanel.svelte` is a `/app` overlay, not a route: theme picker, password
block, and one row per provider (model, base URL, enable, key state). The
password form is `PasswordForm.svelte`, shared by the panel and the first-run
banner in `/app`. `GET`/`PATCH /api/settings` return `{theme, ids, providers}`
with `keyConfigured` and never key material; the whole PATCH body is validated
before the first write; changing a provider's `baseUrl` deletes its stored key.
Theme is a cookie from the PATCH response, not a DB row. First-run detection
reuses `locals.mustChangePassword`; while it is set the panel only renders the
password block, since §S9 blocks every other API. 8 files; 30 tests in the
changed set; full gate green (43 files, 489 tests); audit 0/0/1/0; no
dependency, no migration.

Pen-test: no critical/high. The test button already refused to send a stored key
to a request-supplied `baseUrl` (P6). Accepted: no rate limit on the test
button or on PATCH (authenticated, 30 s timeout, 5 output tokens, 32-provider
cap); the theme cookie is readable by script (it is not a secret and the class
must land before paint).

Deviations: theme lives in `l30_theme` only, so a second browser keeps its own
choice; `/app?change=1` from login is still unread, the banner covers it.

## P13 — Keyboard and offline states

`src/lib/util/keys.ts` is the pure §S14 map (`resolveKey`, `stepIndex`); `/app`
binds one `keydown` listener on `window`. A text field owns every key except
`Esc`; a focused button keeps `Enter`, so the toolbar stays usable from the
keyboard. `g` arms a 1 s chord and only `s` completes it. `j`/`k` walk in-memory
items and an `$effect` scrolls the selected row into view with `block: 'nearest'`,
so the page never scrolls. `?` opens `HelpOverlay.svelte`, a bordered two-column
panel with no backdrop; `Esc` closes help, then settings, then categories, then
blurs a field, then clears the detail. `online`/`offline` listeners drive an
offline bar in `/app` and a `Disconnected` status bar with a Retry button. Global
reduced-motion block already existed; the help panel adds no motion. 7 files;
48 tests in the changed set; full gate green (44 files, 521 tests); audit
0/0/1/0; no dependency, no migration.

Pen-test: no critical/high after fix H1 — `Enter` was swallowed while a toolbar
button had focus, breaking keyboard activation; `activable` in the key context
plus a table case covers it. Accepted: shortcuts stay live while the help panel
is open (it is not a modal, so nothing is trapped); Retry while still offline
just fails again; `navigator.onLine` can be wrong behind a dead proxy.

Deviations: none.

## Bugfixes landed straight on `main`

- `4ac1b3c` — `POST /api/auth/password` rejected the first-run default because
  it verified against a stored hash that does not exist yet, so the banner link
  was dead; `seed()` was never called outside tests, so a fresh install had zero
  sources. Both carry a reproducing test.
- `58998e8` — the CSP header had no `style-src`, so `default-src 'self'` blocked
  the inline `<style>` a prerendered page ships and the page rendered unstyled.
  `style-src 'self' 'unsafe-inline'` added; scripts stay nonce-gated.

## P14 — Dashboard and landing showcase

Merged in `0ac90e1` (work `e9aae09`, branch kept). Dashboard: 260/1fr/460 shell, 64px
toolbar, 52px pane heads, paragraph-preserving detail copy, custom dropdowns,
Ctrl/Cmd K, icon status states, logout, and a mobile feed/detail swap. Landing:
separate static `landing/` app, `csr = false`, nine sections, real-markup
previews, inline scripts for theme/install/menu/copy. Root `/` redirects to
`/app` or `/login`. Full gate: lint/typecheck clean, 538 tests, app and landing
builds pass, audit 0 critical/high (2 moderate). Accepted deviations: no
screenshots or Playwright; the landing is a separate build; inline enhancement
scripts are allowed.

## P15 — Install, budgets, CI

Work `1e16a63` + `f2446fb` + `e9ac5e2` + `ca712bd`, on
`phase-15-install`, not merged.
`bin/last30days.js` adds
`--no-open`, exact `PORT` or 4477–4487, platform data dirs and browser open.
Docker and systemd units, `vercel.json` and `VERCEL=1` adapter switch. Local
npm keeps `last30` and loopback `/reset`; deployments (`L30_DEPLOYED=1` or
`VERCEL=1`) seed `L30_INITIAL_PASSWORD` (8+), never accept `last30` (even
when an old database stored its hash), fail closed with `setup_required`,
and disable reset. The tarball ships only
`bin/`, built output and docs. `.env.development.example` and
`.env.production.example` hold dummy values; real files stay ignored.
`vite.config.ts` loads the matching file for dev/build but never for tests.
README has a Deploy to Vercel button and a local Turso branch check. Release
is semantic-release from `main` after CI: GitHub Release always, npm only
when `NPM_TOKEN` exists in the `release` environment. CI adds a Vercel
adapter build and a Docker job: build, size <220 MB, boot, login, `/app`,
feed, reset 403 and an unset-password container 503.
Local gate: lint/typecheck clean, 53 files / 619 tests, both builds, budget
pass (cold boot 677 ms, /app JS 56.4 KB, feed p95 60 ms), smoke and package
smoke pass, audit 0 critical/high (2 moderate). A dummy `.env.production`
verified `start:local`: deployed login works, `last30` 401, reset 403, feed
200, and the password never reached the log. Dependabot groups weekly
npm, actions and Docker minor/patch updates; a policy labels them
`automerge` and closes majors, and a `workflow_run` job merges after green
CI and closes on failure. CI was green on `a057ff7` (owner report), Docker
job included; `ca712bd` needs the same run. Not yet verified: real Turso and
Vercel login/fetch/feed, npm publish (account suspended 72 h). Accepted: DNS
rebinding and the `Host` header (P3); the local default window (now
closed on deployments). A local install exposed through a proxy must set
`L30_TRUST_PROXY=1`, or reset still sees the proxy as loopback.

## Working rules adopted mid-project

- One branch per phase, feature or fix; merged with `--no-ff` and kept.
- Inner loop: `pnpm lint:changed`, `typecheck:changed`, `test:changed`; full
  gate once before merge.
- Critical/high findings get a reproducing test before commit; the rest are
  discussed and recorded here.
- Every phase starts by reading `.agents/skills/last30days-news/SKILL.md`.
