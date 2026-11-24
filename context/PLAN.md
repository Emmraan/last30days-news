# PLAN — last30days-news v0.1

Single build doc. Specs first (§S), then phases (§P). Read top to bottom.
Do not start a phase until the previous one's **Done** line is true.

## 0. Rules

- Stack is locked (§S1). A new dependency needs a one-line justification
  in the PR body: why the stdlib or an installed package could not do it.
  There is no `DECISIONS.md`; the spec here is the only record.
- Versions are pinned **exactly** in `package.json` to the machine's own
  runtime: `node 26.13.0`, `pnpm 12.16.1` (`engines` + `packageManager`).
  No `^`, no `~`, no `latest`. One source of truth, no drift.
- Package manager is `pnpm`. Never `npm install`, never `npm ci`, never a
  second lockfile.
- **Test-driven.** Write the failing test first, then the code that makes
  it pass, then stop. A phase with no test is not done.
- Mid-phase gate: `pnpm lint:changed && pnpm typecheck:changed`. Phase
  gate: the full suite in §S18 plus that phase's **Done** line plus a
  security review (§S24).
- Tests never touch the network. Recorded fixtures only.
- No file exists before the phase that needs it. No `utils/` dumping
  ground, no barrel `index.ts` re-exports, no interface with one impl.
- UI text is English and plain. Copy rules §S21.
- Comments explain *why*, never *what*. No "As an AI", no narration.
- `AGENTS.md` is generated from §S23. It is the agent-facing copy of these
  rules; if the two disagree, §S23 wins.

## 1. File layout (end state)

```
src/
  app.css                    @import "tailwindcss" + @theme tokens + base
  app.html                   CSP meta, no remote hosts
  hooks.server.ts            session guard, security headers
  lib/
    types.ts                 Item, Category, Source, Summary
    logo.ts                  LOGO_SVG + FAVICON_DATA_URI
    util/url.ts              canonicalUrl()
    util/dedup.ts            titleKey(), jaccard()
    util/time.ts             range presets -> {from,to}
    util/format.ts           relative time, tabular numerals
    components/              Icon.svelte Logo.svelte ItemRow.svelte
                             Pane.svelte TopBar.svelte StatusBar.svelte
                             Skeleton.svelte Empty.svelte KeyMap.svelte
    server/
      log.ts                 log(level,event,data)
      db/schema.ts           drizzle schema (§S2)
      db/index.ts            createClient, pragmas, migrate
      db/seed.ts             2 categories + 6 sources, idempotent
      auth/password.ts       scrypt hash/verify
      auth/secret.ts         AES-256-GCM with password-derived key
      auth/session.ts        cookie create/read/destroy
      auth/rate.ts           DB-backed limiter (serverless-safe)
      sources/{rss,hn,json}.ts  fetchSource -> RawItem[]
      fetch/pass.ts          orchestrator, SSE emitter
      ingest/insert.ts       dedup + insert + source_count
      feed/query.ts          cursor pagination
      search/fts.ts          query builder + LIKE fallback
      ai/provider.ts         settings -> LanguageModel
      ai/summary.ts          §S8 summary call
      ai/score.ts            §S8 category scoring call
  routes/
    +layout.svelte           theme class on <html>
    +page.server.ts          `/` redirects to `/login` or `/app`
    login/+page.svelte
    reset/+page.svelte
    app/+page.svelte         dashboard shell
    api/…                    §S10, one +server.ts per row
landing/                     separate static showcase app
fixtures/                    recorded feed responses (json)
tests/                       vitest units + integration
```

Routes: `/` → `/login` or `/app` · `/login` · `/reset` · `/app` dashboard ·
`/api/*`. The landing showcase lives in `landing/` as its own static build;
`/app` and every `/api/*` except `/api/auth/login` + `/api/health` require a
session.

## 2. Locked specs

### S1 Stack

Versions are the ones on this machine, pinned exact. Nothing floats.

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node | `26.13.0` |
| Package manager | pnpm | `12.16.1` |
| Framework | SvelteKit + Svelte 5 runes | `@sveltejs/kit 3.4.0`, `svelte 5.59.1` |
| Build | Vite | `8.3.8` |
| Language | TypeScript, `strict` | latest |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | `4.3.5` |
| Icons | `lucide-svelte` (tree-shaken, named imports only) | `1.0.1` |
| DB client | `@libsql/client` (file: locally, libsql:// on Vercel) | `0.18.0` |
| ORM | Drizzle ORM + drizzle-kit | `0.45.4` / `0.31.11` |
| AI | Vercel AI SDK + `@ai-sdk/*` providers | `ai 7.0.179` |
| RSS | `rss-parser` | `3.13.0` |
| Validation | `zod` | `4.6.7` |
| Unit tests | Vitest | `5.1.1` |
| Lint/format | ESLint + Prettier | `10.15.0` / `3.10.1` |

Adapters: `@sveltejs/adapter-vercel 7.0.5` for Vercel,
`@sveltejs/adapter-node 6.0.5` for the `npx`/Docker build. One repo, two
targets, chosen by env in `svelte.config.js` — not two codebases.

**Human-crafted is a quality bar, not a library ban.** Tailwind and
`lucide-svelte` are allowed. What is banned is the *look* they produce by
default: a Tailwind page that reads as a Tailwind page fails §S21.
Tokens in `@theme` keep Tailwind honest; no default palette, no default
shadows, no default rounded-xl cards.

No chart library. If a chart is ever needed it is one inline SVG
sparkline, ~12 lines.

### S2 Data model

```
source(id pk, name, kind rss|hn|json, url, category fk, enabled=1,
       fetch_interval_min=30, last_fetched_at, last_status, last_error, created_at)
item(id pk = sha1(canonical_url), title, url, author, published_at,
     published_estimated, fetched_at, excerpt<=800, language,
     category fk, source_count)
     idx(published_at desc) idx(category,published_at desc) idx(fetched_at)
item_source(item_id, source_id) pk, url, raw_title
summary(item_id, model) pk, body, citations json, created_at, tokens_in, tokens_out
category(id pk, name, builtin, match_mode keywords|ai|both, keywords json,
         prompt, ai_threshold=0.6, sort_order, created_at)
category_source(category_id, source_id) pk
category_item(category_id, item_id, prompt_hash) pk, score, reason, created_at
         idx(category_id,prompt_hash,score desc) idx(item_id)
session(id pk, created_at, expires_at, last_seen_at)
login_attempt(ip, ts) idx(ip, ts)
setting(key pk, value json)
item_fts = fts5(title, excerpt, content=item, content_rowid=rowid,
                tokenize='unicode61 remove_diacritics 2')
```

Rules: all timestamps integer ms UTC. No soft deletes. No `updated_at`.
JSON columns validated on write with zod. Deletes cascade
(`item`→`item_source`,`summary`; `category`→`category_source`,
`category_item`). Migrations generated by `drizzle-kit`, never hand-edited
after ship.

Connection is one env var: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
Unset → `file:<data-dir>/db.sqlite`. Set → `libsql://…`. Same schema, same
SQL, same migrations on both. `FTS5` is built into libSQL; if the target
reports it missing, §S13's `LIKE` fallback takes over and logs once.
Pragmas `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON` apply
to the file case only — a remote replica manages its own.

### S3 Time

- UTC ms everywhere. Presets computed client-side from the browser
  timezone, sent as explicit `from`/`to`. Server never guesses a zone.
- `24h`/`7d`/`30d` are rolling windows from `now`. Default `24h`.
- Filter on `published_at`; fall back to `fetched_at` with
  `published_estimated=1`.
- Display relative up to 7 days, then local date. Tabular numerals.

### S4 Categories

A category is a row with three independent layers: **sources** (works
without AI), **keywords** (works without AI), **AI relevance** (needs a
key). Any mix is valid; nothing requires a model.

- `keywords` — case-insensitive, word-boundary `LIKE` on `title` +
  `excerpt`. No regex, no boolean syntax.
- `ai` — every candidate scored against `prompt`; item shown when
  `score >= ai_threshold`.
- `both` — union; an item already matching a keyword is **not** sent to
  the model.
- Candidates: the category's own sources if it has any, else all items in
  the window. This is what bounds AI cost without bounding the user.
- Scoring is lazy (on open, never on a timer), batched 20 items per call,
  200 items per open, cached in `category_item` by `prompt_hash`.
  Changing the prompt invalidates only that category. Switching
  categories costs nothing.
- No cap on categories, sources, keywords, or prompt length.
- Builtin: `ai` and `technology`, `match_mode='keywords'`, empty keywords,
  pinned to their §S6 sources. `builtin` only blocks rename and delete.
- Create = name (1–40 chars, unique case-insensitive) + optional source
  checkboxes + optional pasted feed URL (fetched once immediately;
  rejected inline if it does not parse, nothing saved) + prompt and/or
  keywords.
- Selecting a category never clears the time filter or the search box.
  All three compose with `AND`.

### S5 Sources (seeded, 6)

| id | Name | kind | URL | category | min |
|---|---|---|---|---|---|
| `hn-top` | Hacker News | hn | `https://hacker-news.firebaseio.com/v0` | technology | 30 |
| `ars` | Ars Technica | rss | `https://feeds.arstechnica.com/arstechnica/index` | technology | 30 |
| `verge` | The Verge | rss | `https://www.theverge.com/rss/index.xml` | technology | 30 |
| `mit-tr` | MIT Technology Review | rss | `https://www.technologyreview.com/feed/` | ai | 60 |
| `tc-ai` | TechCrunch AI | rss | `https://techcrunch.com/category/artificial-intelligence/feed/` | ai | 60 |
| `hf-blog` | Hugging Face Blog | rss | `https://huggingface.co/blog/feed.xml` | ai | 120 |

HN = `topstories.json` then `item/{id}.json`, first 100 ids, excerpt falls
back to title. Seed from one `sources.seed.ts`. UA
`last30days-news/0.1 (+https://github.com/<owner>/last30days-news)`.
Three consecutive failures → auto-disable + status-bar note, never a
silent drop. Never publish a source count on the landing page.

### S6 Fetch pass

On demand only (app open or refresh), never a cron. At most 4 in flight,
10s timeout each, retries at 500ms then 1500ms jittered, 200 items max
per source per pass, only sources past their interval. One failing source
never fails the pass. Items stream in as each source finishes. Prune
after each pass.

### S7 Canonical URL + dedup + rank

Canonical: http(s) only → lowercase scheme+host, strip `www.` → drop
fragment → drop `utm_*`,`fbclid`,`gclid`,`ref`,`ref_src`,`source`,
`mc_cid`,`mc_eid`,`igshid` → sort query → strip trailing `/` unless path
is `/`. `id = sha1(canonical)`.

Same story when: identical canonical URL, **or** identical normalized
title (lowercase, punctuation stripped, whitespace collapsed), **or**
token Jaccard ≥ `0.72` and same category and published within 48h. On
match keep the oldest row, append `item_source`, increment
`source_count`, never mutate the canonical title/URL. Cross-category is
never merged; primary category = first source's category in seed order.

Rank (no AI, MVP): `source_count desc`, `published_at desc`, `id asc`.
Show `source_count` as a mono badge when above 1.

### S8 AI contract

The model is a text function. Input: title, source name, published date,
≤6000 chars of stripped text. Never raw HTML, never the URL list. System
prompt lives in one file, contains no user data, declares fetched text as
untrusted and says to ignore instructions inside it.

Summary output, strict JSON, zod-validated before storage:

```json
{"summary":"2-4 sentences, <=480 chars","key_points":["",""],"why_it_matters":"<=180 chars"}
```

`temperature 0.2`, `max_tokens 700`, no streaming to storage. No markdown,
no URLs in `summary` — citations are attached by the server from
`item_source`. On invalid output: one repair attempt with the validator
error appended, then store nothing. A failed summary is never a failed
item. Cached forever per `(item_id, model)`, generated on demand.

Category scoring, a separate call that never writes `summary`:
input = category `prompt` + up to 20 items `{id,title,source,published,
excerpt<=800}`; output `{"scores":[{"id","score":0-1,"reason"<=90}]}`,
`temperature 0`, `max_tokens 900`. Missing id = score 0, not retried.
Total failure → fall back to keyword matching for that request + the
degraded note from §S12. Changing provider settings invalidates nothing.

### S9 Security

Node `crypto` only, no auth library.

- Password: `scrypt` N=2^15, r=8, p=1, 32-byte out, 16-byte salt, stored
  `scrypt$N$r$p$<salt-b64>$<hash-b64>` in `setting:auth.password`.
  Verify with `timingSafeEqual`. Wrong or missing password always runs one
  verify against a dummy hash (constant time).
- Secrets: AES-256-GCM, 32-byte key = `scrypt(password, setting:crypto.salt)`
  (16-byte salt). Per-secret random 12-byte IV, stored
  `<iv-b64>.<tag-b64>.<ct-b64>`. Decrypt per request, never cached past
  logout. Password change re-derives and re-encrypts every secret in one
  transaction.
- Reset: `/reset` needs no session, asks no old password, requires typing
  `reset`, deletes `auth.password` + all sessions + all secrets + rewrites
  `crypto.salt`, keeps items/summaries/sources/settings, logs
  `auth.reset`, then demands a new password ≥8 chars. Rate-limited by the
  same counter as login.
- Cookie `l30_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure`
  over HTTPS, 30 days, value = `session.id` (32 random bytes hex). Rotate
  on login and password change.
- CSRF: `SameSite=Lax` + strict `Origin` check on every non-GET → 403.
- Rate limit: **stored in the DB**, not in memory — Vercel runs many
  instances, an in-memory counter is a no-op there. `login_attempt`
  `(ip, ts)` rows, 5 failures / 15 min, lockout 15 min doubling to 24h,
  success deletes the IP's rows. Pruned with retention.
- Headers: `CSP default-src 'self'` (no inline script, no remote host),
  `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.

### S10 API

| M | Path | Body / notes |
|---|---|---|
| POST | `/api/auth/login` | `{password}` → cookie |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/password` | `{current,next}` → re-encrypts secrets |
| POST | `/api/auth/reset` | `{confirm:"reset",next}` no session |
| GET | `/api/auth/session` | `{authenticated,mustChangePassword}` |
| GET | `/api/feed` | `?from&to&category&q&cursor&limit` |
| GET | `/api/items/[id]` | item + sources + cached summary |
| POST | `/api/items/[id]/summary` | generate or return cached |
| POST | `/api/refresh` | SSE locally; `{batch:true}` on Vercel → one batch per call, client polls |
| GET | `/api/categories` | `builtin,match_mode,keywordCount,itemCount,hasPrompt` |
| POST | `/api/categories` | `{name,matchMode,keywords?,prompt?,aiThreshold?,sourceIds?}` |
| PATCH | `/api/categories/[id]` | builtin rejected |
| DELETE | `/api/categories/[id]` | builtin rejected; its sources are disabled, not deleted |
| POST | `/api/categories/[id]/rescore` | drop cached scores for current prompt_hash, SSE |
| POST | `/api/categories/feed-check` | `{url}` → `{ok,feedTitle,itemCount}` or `{ok:false,code,message}` |
| GET | `/api/sources` | with status |
| PATCH | `/api/sources/[id]` | `{enabled}` only |
| POST | `/api/sources` | `{url,name?,categoryId,intervalMin?}` validates by one fetch |
| GET | `/api/settings` | redacted, keys masked |
| PATCH | `/api/settings` | theme, providers, key set/clear |
| POST | `/api/settings/ai/test` | validate key, save nothing |
| GET | `/api/health` | `{ok,version}`, no auth |

Errors `{error:{code,message}}`; the client switches on `code`. Feed is
cursor-paginated `{items,nextCursor}`, cursor = base64url
`(sortKey,id)`, never an offset. Dates cross the wire as ms. Unknown body
fields are rejected by zod, not ignored.

### S11 UI shell (LOCKED)

Windows desktop app, not a webpage. The software feel comes from layout,
type, and density — never fake window chrome, title bars, or traffic
lights.

Tokens (dark / light), single source of truth in `app.css`:

```
--bg #1b1b1b / #f3f3f3      --side #171717 / #e9e9e9
--pane #202020 / #f7f7f7    --card #262626 / #fff
--raise #2c2c2c / #f2f2f2   --raise-2 #333 / #e9e9e9
--line #2e2e2e / #e3e3e3    --line-2 #3d3d3d / #d2d2d2
--txt #f2f2f2 / #141414     --txt-2 #b9b9b9 / #545454
--txt-3 #8a8a8a / #848484   --accent #60cdff / #0f6cbd
--accent-on #062a3a / #fff  --accent-soft rgba(96,205,255,.13) / rgba(15,108,189,.09)
--ok #6ccb5f / #0f7b0f      --warn #fce100 / #9d5d00
--hover rgba(255,255,255,.055) / rgba(0,0,0,.04)
--active rgba(255,255,255,.085) / rgba(0,0,0,.065)
--r 10px  --r-md 14px  --r-lg 18px  --pill 99px
--h-top 54px  --h-sb 34px  --ease cubic-bezier(.22,.61,.36,1)
```

Type: `Segoe UI Variable Text` body, `Segoe UI Variable Display` headings,
`Cascadia Mono` for numerals/counts/timestamps. 14px/1.5 base, negative
tracking on headings, tabular numerals on metrics. Zero web fonts.

Tailwind v4 wiring: the block above lives in `@theme` in `app.css`, so
utilities are generated from these names only — `bg-pane`, `text-txt-2`,
`border-line`, `rounded-r`, `h-top`. There is no default palette, no
default `shadow-*`, no `rounded-xl`, no `space-y-*` rhythm. Anything the
tokens cannot express is a small hand-written class next to the component,
not an arbitrary `[value]` utility. Tailwind is the utility layer; the
component CSS below is still authored by hand.

Layout: shell `grid-template-rows: auto minmax(0,1fr) auto`, `100vh`,
zero padding, zero gap. Top bar and status bar are full-bleed and square,
separated by a hairline only (`box-shadow: 0 1px 0 var(--line)` /
`0 -1px 0 var(--line)`). Body `grid-template-columns: 252px
minmax(0,1fr) 424px`, `gap:2px`, `padding:0 0 2px`, background `--bg`.
Panes `border:0`, `border-radius:var(--r)`, separated only by the 2px
gutter — no drop shadows, no wide gutters. Breakpoints: 1280px hides the
detail pane, 940px hides the sidebar.

Borders on small components only, 1px `--line` (hover `--line-2`):
`.search` (focus-within `--accent`), `.iconbtn` (transparent until hover),
`.seg`, `.btn`, `.chip`, `.tag`. `.tag.ai` and the `.why` callout use
accent at 22% tint. `.fav` badges `--line-2`, `padding:0 2px`,
`line-height:1`. `.item.on` = `inset 0 0 0 1px var(--line)` + 3px accent
left bar. Focus ring 2px `--accent` at 1px offset everywhere.

Logo (LOCKED, radar sweep) in a 28px rounded-square tile, 9px radius,
`linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent)
45%, #7b61ff))`, holding a 19px glyph on a 24 viewBox:

```
<circle cx=12 cy=12 r=8.7 stroke=currentColor stroke-width=1.5 fill=none opacity=.3/>
<circle cx=12 cy=12 r=5 stroke=currentColor stroke-width=1.5 fill=none opacity=.5/>
<path d="M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z" fill=currentColor opacity=.92/>
<circle cx=12 cy=12 r=1.9 fill=currentColor/>
```

Symbol, not a letterform. Same glyph as the inline data-URI favicon on an
accent background.

Colour discipline: one accent plus `--ok` and `--warn`. No multi-colour
status dots, no gradients except the logo tile. Motion 100–120ms hover,
220ms panels, `--ease`, honour `prefers-reduced-motion`. SPA navigation,
no full reloads.

### S12 Pane states

Five states, every pane, never blank, never a lone spinner.

- **Empty** — one mono 12px `--txt-3` line, centred: "No items in the last
  24 hours. Refresh to fetch."
- **Loading** — skeleton rows at exact real-row height, `--card` on
  `--pane`, no shimmer. A 2px indeterminate `--accent` bar under the
  navbar during a fetch pass only.
- **Error** — source errors live in the status bar as `name: failed` with
  retry; never take over the feed. Full-page error only for a dead DB, and
  it shows the data-dir and log path.
- **Offline** — cached feed stays; one bar under the navbar reads
  "Disconnected — showing cached items" in `--warn` at 20% tint, clears on
  reconnect.
- **Long content** — titles `line-clamp` 2 in the list, full wrap in
  detail; `overflow-wrap:anywhere` for URLs; summary scrolls inside the
  detail pane.
- **Scoring** — 1px `--line` footer row: `Scoring 40 of 118 · 12s`. No
  skeleton, no overlay. On failure it becomes `AI unavailable — showing
  keyword matches` in `--warn` 20% tint until retried.
- **First run** — no password → login with the default hint; default
  password in use → one inline Settings banner, not a modal; no DB → fetch
  pass starts immediately.

### S13 Search

FTS5, external content, trigger-synced — built into libSQL, so the same
schema works on a local file and on Turso. Columns `title` (weight 3),
`excerpt` (1). Input split on whitespace, each token quoted, last token
gets `*`, joined with `AND`; FTS operators from the client are escaped.
Rank `bm25(item_fts,3.0,1.0)` then `published_at desc`. Minimum 2 chars
or search is disabled. Results reuse the feed row and cursor. If the
target reports FTS5 missing, log once and fall back to `LIKE '%q%'` on
title.

### S14 Keyboard

`/` search · `j`/`k` next/prev · `Enter` open detail · `Esc` close/clear ·
`r` refresh · `1 2 3` 24h/7d/30d · `g` then `s` Settings · `?` map
overlay. Ignored while a text input has focus except `Esc`. Every one has
a visible click target. `?` is a bordered two-column panel, no modal
chrome.

### S15 Retention

Items older than 30 days deleted on start and after each pass, cascading
to `item_source` and `summary`. Sessions expired >7 days deleted on
start. `login_attempt` rows older than 24h deleted on start. `VACUUM`
once after pruning if the file exceeds 500 MB, logging size before/after —
file target only, a Turso replica manages its own storage. Nothing else is
ever pruned. `RETENTION_DAYS` is one exported constant, and the 30-day
range uses it.

### S16 Logging

`log(level,event,data)` → NDJSON on stdout: `ts, level, event, data`.
Levels `error|warn|info|debug`; `debug` needs `L30_DEBUG=1`. Event set is
closed: `boot`, `fetch.pass`, `fetch.source`, `prune`, `vacuum`,
`summary.gen`, `category.score`, `auth.login`, `auth.fail`, `auth.reset`,
`api.error`. Never log keys, hashes, cookies, item bodies, or request
bodies. `fetch.source` logs `{source_id,ok,count,ms,error_code}` with no
stack trace. No metrics endpoint, no telemetry, ever. No log file — stdout
only.

### S17 Budgets (build fails on breach)

Client JS 60 KB gz/route · CSS 28 KB gz · first load 90 KB gz · web fonts
0 · landing 40 KB gz · feed response 50 items 120 KB · cold boot 800 ms ·
`/api/feed` p95 300 ms @20k rows (remote DB adds a hop) · fetch pass 25 s
· DB <200 MB @30 days. Measured from `vite build` output plus `curl
--compressed -w '%{size_download}'`. The landing ships no image assets; its
previews are real UI markup.

CSS budget is 28 KB, not 18 KB, because Tailwind v4 emits the utilities
actually used — measured, not assumed. If it overshoots, the fix is fewer
utilities, not a bigger budget.

### S18 CI and release

PR gates, all blocking: `pnpm install --frozen-lockfile` → `lint` →
`typecheck` (zero warnings) → `test` (unit + integration) →
`build` → `build:landing` → `budget` → `test:smoke` →
`test:package` → `audit:gate` → security review (§S24). Docker build/boot
is a one-off P15 check, not a per-PR gate. The Vercel adapter is checked by
the real deployment, not a CI build. After a push to
`main` passes CI, semantic-release runs on the tested commit. Conventional
Commits decide the version; the first release is `1.0.0`. A GitHub Release
and tag are always created. npm publishing runs only when `NPM_TOKEN` exists
in the `release` environment; without it the release is GitHub-only. No
`--force`, no laptop `pnpm publish`. `main` is always releasable; merge
with `--no-ff` and keep the branch.

### S19 Install and deploy

**Two targets, one codebase.** `svelte.config.js` picks the adapter:
`@sveltejs/adapter-vercel` when `VERCEL=1`, else `@sveltejs/adapter-node`.

`npx last30days-news` → binary `last30days`. `PORT` honoured, else 4477
up to 4487, then fail naming the env var. Bind `127.0.0.1`;
`HOST=0.0.0.0` warns. Data dir: `%APPDATA%\last30days-news`,
`~/Library/Application Support/last30days-news`,
`$XDG_DATA_HOME/last30days-news` or `~/.local/share/last30days-news`;
`L30_DATA_DIR` overrides; created `0700`. One file
`<data-dir>/db.sqlite`, WAL, `synchronous=NORMAL`, `foreign_keys=ON`.
Browser auto-open unless `--no-open` or `CI`. `--version`/`--help` print
and exit. Never prompts. Refuses to boot without a writable data dir.

Docker: single image, Node LTS slim, `/data` volume (mandatory, warn if
missing), non-root UID 1000, 220 MB budget, `HEALTHCHECK` on
`/api/health`, `L30_DEPLOYED=1`, `L30_INITIAL_PASSWORD` on first boot
(never the local default, no reset). VPS:
systemd, `Restart=on-failure`, proxy for TLS, `Secure` cookies need
`X-Forwarded-Proto` which is trusted only when `L30_TRUST_PROXY=1`.

Vercel: `VERCEL=1` + `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. No local
file, no WAL. Because each invocation may be a fresh instance, `/api/
refresh` cannot stream for long — it processes one batch per call and the
client polls, so every run stays inside the function timeout. Rate
limiting and sessions are already DB-backed (§S9), which is what makes
this work. Serverless has no shared memory, so nothing may live in
module scope. Kubernetes and multi-replica SQLite are still unsupported.

### S20 Language

English only in v0.1. No i18n framework, no string catalogue, no locale
switcher. `item.language` is BCP-47, best effort, used only to label a
non-English source in the detail pane. Dates/numbers via `Intl`
(`en-GB` default, browser locale for relative time only).

### S21 Copy and AI-pattern blocklist

Copy is concrete, short, and true of the shipped app. No "AI-powered"
badges, no lorem ipsum, no emoji as icons, no exclamation marks, no
"revolutionise", no "seamless", no over-explaining.

Build fails on: generic gradient hero or centred tagline; emoji section
headers; default kit or template look; placeholder copy; random accent
colours outside the token set; fake OS chrome, traffic lights, title-bar
replicas; serif display fonts; aurora/mesh gradients; uniform card grids
as the default page structure; floating panes with wide gutters or drop
shadows inside the shell; more than one accent hue; arbitrarily coloured
status dots.

### S22 Landing showcase (separate static build)

Same tokens, type, radii, and logo as the app — a document-shaped
container, not a second design. Inspired by openship.io: stacked two-line
headline, left-aligned hero, real UI markup previews as the only imagery,
numbered walkthrough, spec table, FAQ, columned footer. Not a copy: no
blue-gradient palette, no feature-card grid, no competitor matrix.

The showcase is its own static app in `landing/`, not a route in the app
bundle. It ships no hydration bundle and no image assets; the hero preview
and step crops are plain markup. Small inline scripts may handle theme,
install tabs/copy, section scroll and the mobile menu, but the page must
still render its content with JS disabled.

1. **Nav** — logo + wordmark; anchors `How it works`, `What you get`,
   `Sources`, `FAQ`; `Open the app` pill; mono `v0.1.0`. Sticky, `--side`,
   1px bottom hairline, no blur.
2. **Hero** — two-line headline (clamp 40–64px, tracking -0.03em, second
   line `--txt-3`), one sentence at 16px/1.6 `--txt-2` max 56ch, primary
   accent pill + bordered secondary pill, then the full-width dashboard
   markup preview in a frame.
3. **Proof strip** — hairline-separated plain facts: `Local-first`,
   `Works without an AI key`, `Bring your own model`, `Cited summaries`.
   **No source count anywhere.**
4. **How it works** — three stacked rows: mono step number + label left;
   heading, paragraph, cropped UI preview right; hairline between. Carries
   the page.
5. **What you get** — eight label/description rows, hairline separated.
   Spec list, not cards.
6. **Sources** — real domains as small bordered badges in a wrapped flow,
   grouped with mono labels. One line above: any RSS feed can be added
   later. No count, no total, no logo wall, no marquee.
7. **FAQ** — 6–8 native `<details>`, hairline separators, mono chevron,
   no library. Real questions: is my data uploaded, do I need a key, which
   providers, how fresh, can I add sources.
8. **Closing** — one line, one primary pill, one secondary link to the
   repo, left-aligned.
9. **Footer** — logo + one sentence; `Product`/`Developers`/`Legal`
   columns plus the install command in mono; `v0.1.0` and licence. 1px top
   hairline.

No pricing, testimonials, newsletter, cookie banner, fake logos, or
"trusted by". Section rhythm 96px desktop / 56px mobile, content column
1080px centred, hero preview may bleed wider.

### S23 Agent rules — `AGENTS.md` (LOCKED)

`AGENTS.md` at repo root is generated from this section verbatim and is
the file every agent reads first. Eight rules, in this order, not
negotiable:

1. **Unit testing.** Pure functions only: canonical URL, title
   normalisation, Jaccard, keyword match, query building, cursor encode/
   decode, time presets, ranking comparator. Table-driven, no mocks, no
   network, no DB. One file per unit, next to the source, `.test.ts`.
   Coverage is not the target — every documented edge case having a case
   is.
2. **Integration testing.** Everything that touches the DB or a route:
   migrations, seed idempotency, dedup insert, feed pagination, auth,
   category CRUD, encrypt/decrypt round-trip. One real libSQL file DB per
   test file in a temp dir, deleted after. No mocking the DB layer — a
   mocked DB proves nothing about the SQL that ships.
3. **Test-driven development.** Test first, watch it fail, then write the
   smallest code that passes. A phase's tests are written at the start of
   that phase, not after it. A bug fix without a reproducing test is not
   a fix.
4. **Pen tester pass.** After each phase's green tests, switch to
   adversarial mode and try to break the build. Scope, at minimum, per
   §S24. Produce a numbered findings list: severity, what was broken, the
   exact reproduction, and the smallest fix.
5. **Discuss and improve.** Findings are not auto-fixed. They are
   presented as a list, discussed, prioritised, and only then implemented
   — with the decision recorded in that phase's section. A finding may be
   accepted as a known limitation with a written reason.
6. **Look up the skill for the work.** Before starting any phase, feature
   or fix, read `.agents/skills/last30days-news/SKILL.md` and load the
   skills it names for that kind of work, so the implementation follows
   the project's own conventions. The rules in `AGENTS.md` win over
   anything a skill says.
7. **Keep `context/PROGRESS.md` current.** One entry per merged phase:
   the work commit, the merge commit, the gate result, every deviation
   from this plan with its reason, and every finding accepted as a known
   limitation. Append before the phase merge, never after.
8. **Clean the docs back to a template.** Once this plan covers
   everything `context/PRD.md` describes, rewrite the PRD in place as its
   clean template — the same headings, every field empty — so the next
   round is written there. Once every phase here is merged, do the same
   to `context/PLAN.md` and `context/PROGRESS.md`. No template file is
   copied; the file keeps its own structure and loses its content.
   `PRD.md` stays filled for now — the post-MVP scope has no plan yet.

### S24 Security review scope (pen-tester checklist)

Run after every phase gate. Each item either passes or becomes a finding.

- **Auth bypass** — any `/api/*` reachable without a session; cookie
  forging; session fixation; expiry not enforced; `mustChangePassword`
  ignored.
- **Injection** — FTS5 query smuggling (`"`, `*`, `NEAR`, `^`, column
  filters), SQL via sort/cursor params, XSS in item title/excerpt/author
  from a hostile feed, XSS in the AI summary, template injection in
  `reason`.
- **SSRF via feed URL** — a pasted URL pointing at `127.0.0.1`,
  `169.254.169.254`, `[::1]`, `file://`, a redirect chain, or a
  non-HTTP scheme. Must be blocked, must not leak the response.
- **Resource exhaustion** — a 2 GB feed, a feed with 50k items, a zip
  bomb, `Content-Length` lies, no timeout, an infinite redirect loop, a
  category with 10k keywords, `limit=100000`.
- **Secrets** — a key in any response body, log line, error string, or
  stack trace; `setting` dumpable unauthenticated; reset leaving an old
  key usable.
- **Rate limiting** — 100 parallel logins; does the lockout hold when the
  DB is remote; can a spoofed `X-Forwarded-For` reset the counter.
- **Crypto** — non-constant-time compare anywhere, reused IV, missing GCM
  tag check, password change not re-encrypting, `crypto.salt` rewritten
  on reset.
- **CSRF** — non-GET without `Origin`, `Origin: null`, a cross-site form
  post, `SameSite` missing in a prod build.
- **DoS on the client** — a 100k-char title, a title of only combining
  marks, an RTL override in a title, `line-clamp` bypass.
- **Cost abuse** — unauthenticated AI calls; a category prompt that
  triggers unbounded scoring; a model response that loops the repair.
- **Info leak** — a stack trace in an API error, the data dir path in a
  prod error, source URLs of disabled feeds, the version string.
- **Header and CDN** — CSP actually emitted, no `unsafe-inline`, no
  missing `nosniff`, cache headers not caching authenticated JSON.
- **Supply chain** — a new dependency with a postinstall script, an
  unpinned transitive, a lockfile change with no `package.json` change.

Findings get fixed in the phase they were found, or explicitly deferred
with a written reason in that phase.

## 3. Phases

### P0 Bootstrap

- Versions are already fixed in §S1 to this machine's Node `26.13.0` and
  `pnpm 12.16.1`. Do not re-resolve, do not run `npm view`.
- `package.json`: `"packageManager": "pnpm@12.16.1"`,
  `"engines": {"node": "26.13.0"}`, `.npmrc` with
  `engine-strict=true` and `save-exact=true`. Every version exact.
- Scaffold SvelteKit: TypeScript, no demo app. Add
  `@sveltejs/adapter-vercel` + `@sveltejs/adapter-node`,
  `@tailwindcss/vite`, `lucide-svelte`, `src/app.css` with
  `@import "tailwindcss"` and `@theme` tokens from §S11, `src/app.html`.
- Scripts: `dev`, `build`, `preview`, `lint`, `format`, `check`, `test`,
  `db:generate`, `budget`.
- `.gitignore` (`node_modules`, `.svelte-kit`, `build`, `*.sqlite*`,
  `fixtures/cache`), `.editorconfig`, `tsconfig` strict,
  `AGENTS.md` from §S23.
- `/api/health` → `{ok:true,version}`. First Vitest tests exist and run
  (they may assert only the health route).

**Done:** `pnpm build` passes, `pnpm test` passes, dev server boots,
`/api/health` returns 200, `package.json` has no `^` or `~`, and
`AGENTS.md` matches §S23.

### P1 Database

- `db/schema.ts` — every table and index from §S2, `item_fts` + sync
  triggers created in a raw migration.
- `db/index.ts` — resolve the data dir per §S19, `mkdir 0700`, open,
  `WAL`/`NORMAL`/`foreign_keys`, run migrations on boot, export `db` and
  `RETENTION_DAYS`.
- `db/seed.ts` — insert-or-ignore the 2 categories and 6 sources from
  §S5/S4. Idempotent on every boot.
- `drizzle.config.ts`, generated migration committed.

**Done:** deleting `db.sqlite` and booting recreates the schema with 2
categories and 6 sources; a second boot changes nothing.

### P2 Auth

- `auth/password.ts`, `auth/secret.ts`, `auth/session.ts`, `auth/rate.ts`
  per §S9.
- `hooks.server.ts` — session guard (401 JSON for `/api/*`, redirect for
  `/app`), security headers, `Origin` check on non-GET.
- All five `/api/auth/*` routes. `/login` and `/reset` pages.
- First run: no `auth.password` → accept `last30` and set
  `mustChangePassword`.

**Done:** login with `last30` sets the cookie and reaches `/app`; wrong
password is a constant-time 401; 5 failures lock for 15 min; `/reset`
with `reset` wipes keys and forces a new password; a request with a
foreign `Origin` gets 403.

### P3 Sources and fetch pass

- `sources/rss.ts` (`rss-parser`), `sources/hn.ts` (Firebase), `sources/
  json.ts`; one shared `RawItem` shape.
- `fetch/pass.ts` — due sources, concurrency 4, 10s timeout, retries
  500/1500 jittered, 200-item cap, status + error write, three-strike
  auto-disable, prune after pass, SSE events.
- `POST /api/refresh` streaming, `GET /api/sources`, `PATCH
  /api/sources/[id]`.
- `fixtures/` recorded responses for all six; a `fetchSource` test against
  fixtures only.

**Done:** with a fixture-backed pass, a fresh DB fills with items; a source
that always 500s is marked `error`, does not fail the pass, and is
auto-disabled on the third pass; no test touches the network.

### P4 Ingest

- `util/url.ts` canonical URL, `util/dedup.ts` `titleKey` + `jaccard`.
- `ingest/insert.ts` — canonicalize, reject non-http, dedup per §S7, insert
  item + `item_source`, bump `source_count`, cap excerpt at 800 stripped
  chars, compute `published_estimated`, best-effort language.
- Ranking comparator in one exported function.

**Done:** unit tests cover every canonicalization step, the Jaccard
threshold at the boundary, and the 48h window; the same URL from two
sources yields one item with `source_count = 2`.

### P5 Feed API

- `feed/query.ts` — filters (`from`,`to`,`category`,`q`), sort per §S7,
  keyset cursor `(sortKey,id)` base64url, `limit` default 50 max 100.
- `GET /api/feed`, `GET /api/items/[id]`.

**Done:** paging through 20k fixture rows returns every item exactly once,
a new insert mid-scroll never duplicates or skips, p95 under 120 ms.

### P6 Summaries

- `ai/provider.ts` — settings → `LanguageModel` for OpenAI, Anthropic,
  Google, OpenRouter, Groq, DeepSeek, Ollama, LM Studio, and any
  OpenAI-compatible base URL. Keys decrypted per request.
- `ai/summary.ts` — §S8 contract, prompt in its own file, zod validation,
  one repair, citations built from `item_source`.
- `POST /api/items/[id]/summary`, `POST /api/settings/ai/test`.

**Done:** no key → 409 `ai_not_configured` and the item still renders; a
fixture model returning bad JSON triggers exactly one repair then stores
nothing; a valid response is cached and the second call makes no network
request.

### P7 Categories

- Keyword matcher (word-boundary, case-insensitive) and candidate pool
  rule per §S4.
- `ai/score.ts` — batches of 20, `both` skips keyword hits, cache in
  `category_item`, threshold filter, 200-item per-open cap.
- `/api/categories` CRUD, `/rescore` SSE, `/feed-check`, `POST
  /api/sources` (validates with one fetch, saves nothing on failure).

**Done:** a keywords-only category filters correctly with no AI key; an
AI category scores once and re-opens from cache with zero calls; editing
the prompt invalidates only that category; a builtin PATCH/DELETE is
rejected; a bad feed URL is rejected inline and writes no row.

### P8 Shell

- `app.css` — `@import "tailwindcss"`, `@theme` with every §S11 token, base
  reset, type scale, focus ring, and the hand-written component classes:
  `.pane`, `.btn`, `.seg`, `.chip`, `.tag`, `.search`, `.iconbtn`, `.fav`,
  `.item`.
- `Logo.svelte` + `lib/logo.ts` (glyph + favicon data URI), `TopBar`,
  `StatusBar`, three-pane body, theme toggle with `prefers-color-scheme`
  default, breakpoints.

**Done:** `/app` fills exactly 100vh with no page scroll; top and status
bars are square and full-bleed; panes are 10px radius with a 2px gutter and
no shadow; 1280/940 breakpoints behave; the logo renders from the shared
glyph and the favicon is inline.

### P9 Feed and detail

- `ItemRow` (2-line clamp title, mono timestamp, `fav` badge,
  `source_count` badge, `why` callout when present), `Skeleton`, `Empty`.
- Detail pane: title, source link with attribution, summary body,
  `[n]` citations, key points, `why_it_matters` when present, generate
  action, `scoring` footer, all §S12 states.

**Done:** clicking a row opens the detail without a reload; every state in
§S12 is reachable and looks right; long titles clamp in the list and wrap
in detail; the summary scrolls inside the pane.

### P10 Search

- FTS5 table + triggers (raw migration), `search/fts.ts` query builder with
  escaping, bm25 ordering, LIKE fallback when FTS5 is missing.
- Wire the search box into `/api/feed?q=`.

**Done:** 2-char minimum enforced; `NEAR`/`OR`/`:` in input are inert; a
multi-token query matches in title or excerpt and ranks title hits higher;
results paginate with the same cursor.

### P11 Category manager

- Panel (not a route) with list, reorder, create, rename, delete.
- Create form: name, source checkboxes, feed URL field with inline
  validation via `/api/categories/feed-check`, prompt, keywords, threshold.
- Re-score action.

**Done:** a category can be created, renamed, reordered, and deleted
without leaving `/app`; a pasted invalid URL shows the parser error and
saves nothing; a valid one creates a source and the feed shows its items
after the next pass.

### P12 Settings

- Theme, password change (re-encrypts secrets), provider list with base
  URL / model / key / enable, masked key + is-configured flag, test button,
  clear key.
- First-run inline banner when `mustChangePassword`.
- Reset warning copy: reset wipes AI keys.

**Done:** a key round-trips through encrypt/save/mask/test; the raw key is
never in a response body; changing the password keeps existing keys usable;
the banner disappears after a change.

### P13 Keyboard and states polish

- `?` overlay, all §S14 keys with visible click targets, input-focus
  exemption, list scroll-into-view on `j`/`k`.
- Offline bar, disconnect detection, retry affordances in the status bar.
- `prefers-reduced-motion` pass.

**Done:** every key in §S14 works, `Esc` closes the overlay, no action is
keyboard-only, the offline bar appears and clears itself.

### P14 Dashboard and landing showcase

- Dashboard polish: paragraph-preserving detail copy, custom dropdowns,
  larger desktop shell, minimal motion, a visible search border with
  Ctrl/Cmd K, icon-only status states, logout, and a mobile layout.
- `landing/` static app with nine sections per §S22, `prerender = true`,
  `csr = false`, no hydration bundle, reusing the shell's tokens and `Logo`.
- Real UI markup previews, no screenshot capture and no Playwright.
- Root `/` redirects to `/app` when signed in, otherwise `/login`.
- FAQ as native `<details>`.

**Done:** the showcase builds static and renders its content with JS
disabled; no source count appears; previews are real UI markup in 1px
frames; landing total is under 40 KB gz; no pattern from §S21 is present.

### P15 Install, budgets, CI

- `bin/last30days.js` — port scan, browser open, `--no-open`, `--version`,
  `--help`, `CI`, `L30_DATA_DIR`, `L30_DEBUG`, `L30_TRUST_PROXY`.
- `Dockerfile` (multi-stage, non-root, `/data`, healthcheck), systemd unit
  in `deploy/`, `README` install section.
- `vercel.json` + `VERCEL=1` adapter switch + `TURSO_*` env docs, a
  Vercel deploy button, and separate `.env.development.example` /
  `.env.production.example` files.
- `scripts/budget.mjs` — reads the build manifest, fails over §S17.
- GitHub Actions: PR gates per §S18, semantic release from `main`; npm
  publish only when `NPM_TOKEN` is set.
- `CHANGELOG.md`, `LICENSE` (MIT).
- Full §S24 pass on the deployed Vercel URL, not just localhost.

**Done:** `pnpm pack` → install in a temp dir → `last30days` serves the
login screen; `pnpm budget` passes; the CI workflow is green on a clean
clone; the one-off `docker build` was under 220 MB and booted (not a
per-PR CI job); the Vercel deploy logs in, fetches, and shows a feed
against Turso.

## 4. Definition of done (v0.1)

- One command, then a populated 24h feed across `ai` and `technology`.
- A custom category can be created with keywords only, with a pasted feed,
  and with an AI prompt — all three work, the first two with no key.
- Every summary links to its source; a failed summary never blocks an item.
- Login, reset, and encrypted keys behave per §S9.
- No test hits the network. Every gate in §S18 is green.
- Every phase shipped with its tests written first, and a §S24 pass
  recorded with findings closed or deferred in writing.
- No §S21 pattern ships. Landing page is a separate static showcase built
  from real UI markup, not stock imagery.
- Nothing in §S17 is over budget.
- Deployed on Vercel against Turso and running locally on a SQLite file
  from the same commit.
