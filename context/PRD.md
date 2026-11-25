# Product Requirements Document — last30days-news

Status: v0.1 shipped; post-MVP scope not planned yet
Owner: product
Last updated: 2026-11-25

## 1. Overview

last30days-news is a personal AI intelligence desk. It discovers,
monitors, and explains important developments across news and social
sources in one responsive dashboard.

The product answers three questions for one person or a small team:

- What happened in the last 24 hours, 7 days, or 30 days?
- What matters in the topics I care about?
- Why does it matter, and what might happen next?

### Problem

Information is spread across news sites, RSS feeds, and social
platforms. Reading it all is slow, and most of it is noise. Existing
aggregators list headlines but do not explain, verify, or connect
developments.

### Vision

A calm, extensible desk that turns scattered sources into a short,
cited, research-grade briefing. The user picks the topics; the system
does the reading.

## 2. Goals and non-goals

### Goals

- Aggregate news and social posts from pluggable sources.
- Filter by time window, category, and geography.
- Summarize, deduplicate, and rank developments with citations.
- Work across many AI providers, including local models.
- Run locally with one command and self-host anywhere.
- Stay open: sources and AI providers are modular, not locked in.

### Non-goals (v0.x)

- A social network or a publishing platform.
- Real-time tick-by-tick market data.
- Editorial opinion or original reporting.
- Multi-tenant SaaS billing (future only).

## 3. Target users

| Persona | Need |
|---|---|
| Solo researcher | Fast, cited briefings on a few topics |
| Engineer / founder | Track rivals, launches, and technical shifts |
| Analyst / student | Compare periods and gather perspectives |
| Small team | Shared sources and saved reports |

Primary user is a single self-hosting owner. Team use is a later
addition.

## 4. MVP scope (v0.1)

## 5. Future roadmap

Status: **not planned yet.** Post-MVP scope is agreed below at intent
level only; its build plan is written before the next round starts.

| Stage | Theme | Key additions |
|---|---|---|
| v0.2 | More sources | Reddit, GitHub, arXiv; source health checks |
| v0.3 | Social monitoring | X, YouTube, individual account tracking |
| v0.4 | Deeper intelligence | Deduplication, verification, ranking, timelines |
| v0.5 | Research workspace | Saved reports, follow-up chat, period compare |
| v0.6 | Customization | Custom sources (manual + AI), custom topics, country filters |
| v0.7 | Collaboration | Accounts, shared sources, notifications |
| v1.0 | Hosted option | Optional managed SaaS, Docker and VPS images |

Each stage keeps the same core flows. The source and AI layers are
built once and extended, not rewritten.

## 6. Functional requirements

### 6.1 Time-based discovery

**Time rules (LOCKED).** One rule set, applied everywhere:

- Every stored timestamp is UTC, as an integer of milliseconds since
  epoch. No local-time strings in the database, no offset columns.
- Range presets are computed from the client's timezone, then sent to the
  server as an explicit `from` / `to` UTC pair. The server never guesses a
  timezone and never uses its own locale.
- "Last 24 hours" means `now - 24h` to `now`. It is a rolling window, not
  a calendar day. Same for 7 days and 30 days.
- "Calendar day" means local midnight to local midnight for the client's
  timezone, converted to UTC before it reaches the server.
- Ranges filter on **published** time, never fetch time. Items with no
  published time fall back to fetch time and are flagged `estimated`.
- Display is local. Absolute timestamps render as relative ("4h ago") up to
  7 days, then as a local date. All rendered numbers use tabular numerals.

**Post-MVP ranges.** Calendar day and a custom range picker. The time
rules above already define both, so shipping them later needs no data
change — only a control.

### 6.2 Categories (LOCKED)

Post-MVP: per-category country scope, AI-written keyword lists,
AI-suggested feed URLs, multi-category assignment of a single item, and
the full custom source manager with a hand-editable definition (6.9).

### 6.3 Source system

- Sources are pluggable modules with a common contract: fetch, normalize,
  deduplicate, attach metadata.
- Source types beyond RSS and Hacker News: web search, X, Reddit, YouTube,
  GitHub, arXiv, government and research feeds, custom APIs.
- Individual account monitoring: a tracked profile's new post appears
  with original link, author, and timestamp.
- Custom sources use the same source-definition schema (6.9).

### 6.4 AI research and intelligence

- Summarize a batch of items.
- Verify claims by showing multiple sources side by side.
- Rank items by relevance and impact for the chosen topic.
- Build a timeline of a developing story.
- Show different perspectives and an impact note.
- Offer a short "What's Next?" where evidence allows.
- Compare two time periods.
- Every claim links to its source.

### 6.6 Web application

Post-MVP:

- Social monitoring view for tracked accounts.
- Custom source manager for adding and editing sources.
- Trending topics and AI research reports.
- Saved items and saved reports.
- Notifications for tracked topics or accounts.

### 6.9 Custom resources (post-MVP)

The category creator already accepts a pasted feed URL. What this section
adds later is the full manager: hand-editable definitions, per-source
intervals, editing, and AI-assisted creation.

- Users can add their own sources in a defined source format.
- The format is a versioned schema (source definition) shared by
  built-in and custom sources.
- Two ways to create a source:
  - Manual: fill a form or write the definition by hand.
  - AI-assisted: describe a site or feed; the AI proposes a valid
    definition that the user reviews and saves.
- Every custom source is validated against the schema before it runs.
- Custom sources behave like built-in sources: fetch, normalize,
  deduplicate, and appear in the same feed.
- A custom source can be edited, disabled, or removed without losing
  its history.

## 7. Non-functional requirements

- Privacy: all data and keys stay on the user's machine by default. The
  hosted target keeps them in the user's own Turso database, and no third
  party ever sees an AI key.
- Portability: runs on Windows, macOS, and Linux.
- Performance: 24-hour feed renders in under two seconds on a laptop.
- Reliability: a failing source is skipped, not fatal.
- Extensibility: a new source or provider needs no core change.
- Accessibility: keyboard navigation, contrast, and labels.
- Security: sanitize all fetched HTML; never render raw remote markup.
- Security: login is required before any data is shown; passwords are
  hashed and login attempts are rate-limited.
- Observability: structured logs only, no telemetry.
- Budgets: bundle, boot, and query limits fail the build.
- Language: English UI, no i18n framework.

## 8. Constraints

### 8.1 Chosen stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit (Svelte 5, runes) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 as the utility layer, hand-written component CSS and design tokens on top |
| Icons | `lucide-svelte` |
| Components | Hand-built, no default kit |
| Motion | Svelte transitions and CSS |
| Database | libSQL — local file in dev, Turso in production |
| ORM | Drizzle |
| AI | Vercel AI SDK (core and svelte) |
| RSS | rss-parser |
| Server | `adapter-vercel` when `VERCEL=1`, `adapter-node` otherwise |

### 8.2 Runtime rules

- Runtime and dependencies: pinned exact in `package.json` to the Node
  and pnpm versions already installed on the development machine, so
  `package.json` is the single source of truth. Do not re-resolve them.
- Repo work uses pnpm only: no `npm install`, no second lockfile. The
  published package may be installed by a user with any package manager.
- AI keys are optional; the core product must work without them.
- No vendor lock-in for sources or models.
- A new dependency needs a one-line justification in the PR body: why the
  stdlib or an already-installed package could not do it.

### 8.3 UI principles — LOCKED

Approved 2026-11-22. Do not deviate without a new approval.

**Feel.** A Windows desktop application, not a webpage. Premium and
hand-crafted. The software feel comes from layout, typography, and
density — never from fake OS window chrome, title bars, or traffic
lights.

**Tokens (single source of truth).**

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#1b1b1b` | `#f3f3f3` |
| `--side` | `#171717` | `#e9e9e9` |
| `--pane` | `#202020` | `#f7f7f7` |
| `--card` | `#262626` | `#fff` |
| `--raise` | `#2c2c2c` | `#f2f2f2` |
| `--raise-2` | `#333` | `#e9e9e9` |
| `--line` | `#2e2e2e` | `#e3e3e3` |
| `--line-2` | `#3d3d3d` | `#d2d2d2` |
| `--txt` | `#f2f2f2` | `#141414` |
| `--txt-2` | `#b9b9b9` | `#545454` |
| `--txt-3` | `#8a8a8a` | `#848484` |
| `--accent` | `#60cdff` | `#0f6cbd` |
| `--accent-on` | `#062a3a` | `#fff` |
| `--ok` | `#6ccb5f` | `#0f7b0f` |
| `--warn` | `#fce100` | `#9d5d00` |

Radii: `--r:10px` `--r-md:14px` `--r-lg:18px`. Pills use `99px`.
Heights: `--h-top:54px` `--h-sb:34px`. Easing:
`cubic-bezier(.22,.61,.36,1)`.

**Type.** `Segoe UI Variable Text` body, `Segoe UI Variable Display`
headings, `Cascadia Mono` for numerals, counts, and timestamps. Base
14px / 1.5. Negative tracking on headings. Tabular numerals on all
metrics.

**Layout model.**

- App shell: `grid-template-rows: auto minmax(0,1fr) auto`, `100vh`,
  zero padding, zero gap.
- Top bar and status bar are **full-bleed and square** — edge to edge,
  no radius, separated from the body by a 1px hairline only
  (`box-shadow: 0 1px 0 var(--line)` / `0 -1px 0 var(--line)`).
- Body: `grid-template-columns: 252px minmax(0,1fr) 424px`,
  `gap:2px`, `padding-bottom:2px`, background `--bg`.
- The three panes are **seamless, not floating**: `border:0`,
  `border-radius:var(--r)` (10px), separated only by the 2px `--bg`
  gutter. No 8px gutters, no drop shadows on panes.
- Breakpoints: 1280px hides the detail pane, 940px hides the sidebar
  and the workspace switcher.

**Borders — small components only.** Large panes stay borderless.
Interactive small components carry a 1px `--line` border so they read
as controls:

- `.search` — 1px `--line`, hover `--line-2`, focus-within `--accent`.
- `.iconbtn` — 1px transparent, hover reveals `--line` (no layout shift).
- `.seg`, `.btn`, `.chip`, `.tag` — 1px `--line`, hover `--line-2`.
- `.tag.ai` and `.why` callout — 1px accent at 22% tint.
- `.fav` source badges — 1px `--line-2`, centered glyph, `padding:0 2px`,
  `line-height:1` so text never touches the border.
- `.item.on` — `inset 0 0 0 1px var(--line)` plus a 3px accent left bar.

**Logo — LOCKED: radar sweep.** Rounded-square accent tile (28px,
9px radius, `linear-gradient(150deg, var(--accent), color-mix(in
srgb, var(--accent) 45%, #7b61ff))`) holding a 19px glyph:

```
<circle r="8.7" stroke-width="1.5" opacity=".3"/>
<circle r="5" stroke-width="1.5" opacity=".5"/>
<path d="M12 12 12 3.3A8.7 8.7 0 0 1 20.7 12Z" fill opacity=".92"/>
<circle r="1.9" fill/>
```

It is a symbol mark, not a letterform. Meaning: continuous scanning of
a recency window. Reuse the same glyph for the favicon on an accent
background.

**Colour discipline.** One accent plus `--ok` and `--warn`. No
multi-colour status dots. No gradients except the logo tile.

**Motion.** 100–120ms on hover and selection, 220ms for panel
transitions, `--ease` throughout. Honour
`prefers-reduced-motion: reduce`.

**Navigation.** SPA — instant, no full reload. Focus-visible ring is
2px `--accent` at 1px offset on every interactive element.

### 8.4 AI-generated pattern block

The build fails on any of these patterns:

- Generic gradient hero, centered tagline, "AI-powered" badge.
- Emoji section headers (rocket, sparkle, target).
- Default template or component-kit look.
- "Lorem ipsum" or placeholder copy.
- Over-explaining or "As an AI" comments.
- Emoji used as icons.
- Random accent colors with no token system.
- Fake OS window chrome, traffic lights, or title-bar replicas.
- Serif display fonts, aurora/mesh gradient backgrounds.
- Uniform card grids used as the default page structure.
- Floating panes with wide gutters and drop shadows inside the app shell.
- More than one accent hue, or status dots in arbitrary colours.

## 9. Success metrics

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Source breakage | Health checks, graceful skip, retries |
| AI cost | Local providers, caching, on-demand summaries, lazy per-category scoring with 200-item cap |
| Category sprawl | No cap by design; scoring is lazy so unused categories cost nothing |
| Duplicate noise | Deduplication pass before ranking |
| Prompt injection from feeds | Treat fetched text as data, sanitize, strip instructions |
| Scope creep | Ship v0.1 first; roadmap stages are explicit |
