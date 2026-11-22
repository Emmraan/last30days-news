# Product Requirements Document — last30days-news

Status: working draft
Owner: product
Last updated: 2026-11-22

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

The MVP ships one complete end-to-end use case:

> Read AI and technology news from the last 24 hours, drawn from
> curated RSS feeds and Hacker News, and get a short, cited summary.

### In scope

- Time filters: last 24 hours, 7 days, 30 days.
- Categories: AI & ML, Technology (curated set for MVP).
- Sources: curated RSS feeds + Hacker News API.
- AI: summarization with citations, provider-independent.
- AI config: base URL, API key (optional), model selection, on/off.
- Web UI: single feed, category + time filters, article cards with
  summary and source links.
- Landing page: one public single-page site that explains the product
  and how to run it (see 6.8).
- Storage: local database for articles and summaries.
- Install: `npx last30days-news` launches a local server and opens the
  browser.

### Out of scope (MVP)

- Social monitoring (X, Reddit, YouTube, GitHub, arXiv).
- Individual account monitoring.
- Custom topics and custom source manager UI.
- Cross-source verification and "What's Next?".
- Follow-up conversations and period comparison.
- Notifications, saved reports, and accounts.
- Team features and hosted SaaS.

### MVP success criteria

- A user runs one command and sees a populated, filtered feed.
- At least 20 fresh items across 2 categories in the last 24 hours.
- Every summary links back to its original source.
- Basic aggregation works with no AI key configured.

## 5. Future roadmap

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

- Filter any view by: 24 hours, calendar day, 7 days, 30 days,
  custom range.
- Default view is 24 hours.
- Range applies to published time, not fetch time.

### 6.2 Categories and geography

- Standard categories: AI & ML, Technology, Politics, Geopolitics,
  Business & Economy, Science & Space, Cybersecurity, Startups.
- Custom topics are user-defined keyword or rule sets.
- Each category supports global scope and optional country scope.
- Items may belong to more than one category.

### 6.3 Source system

- Sources are pluggable modules with a common contract:
  fetch, normalize, deduplicate, attach metadata.
- Source types: RSS, web search, X, Reddit, YouTube, GitHub, Hacker
  News, arXiv, government and research feeds, custom APIs.
- Each item keeps: title, url, author, source, published time,
  content, language.
- Individual account monitoring: a tracked profile's new post appears
  with original link, author, and timestamp.
- Custom sources use the same source-definition schema (6.9).
- A source can be disabled without removing its history.

### 6.4 AI research and intelligence

- Summarize a single item and a batch of items.
- Deduplicate near-identical stories across sources.
- Verify claims by showing multiple sources side by side.
- Rank items by relevance and impact for the chosen topic.
- Build a timeline of a developing story.
- Show different perspectives and an impact note.
- Offer a short "What's Next?" where evidence allows.
- Compare two time periods.
- Every claim links to its source.

### 6.5 AI configuration

- Providers: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
  DeepSeek, Ollama, LM Studio, and any OpenAI-compatible base URL.
- Per provider: base URL, API key (optional), model, enable toggle.
- Keys are stored server-side, never in the browser.
- At rest, keys are encrypted with a password-derived key (local file
  or database); a stolen file or database is useless without the login
  password.
- The server validates a key with an optional test call before saving.
- The UI shows a masked key and an is-configured flag; the raw key is
  never returned to the client after save.
- The server makes all AI calls; keys are never sent to the browser.
- On serverless hosts, keys live in server env vars or a managed KV
  store, since the filesystem is read-only.
- If AI is off or unconfigured, aggregation and filtering still work.

### 6.6 Web application

- Responsive dashboard with a feed, filters, and article detail.
- Category and time filters are one click away.
- Social monitoring view for tracked accounts.
- Custom source manager for adding and editing sources.
- Trending topics and AI research reports.
- Saved items and saved reports.
- Search and discovery across all stored items.
- Notifications for tracked topics or accounts.
- Dark and light themes.

### 6.7 Authentication and access control

- The web UI requires a login before any data is shown.
- Default password is `last30` on first run.
- After first login, the user is prompted to change the password in
  Settings.
- The password is stored hashed, never in plain text.
- Login is required in every deployment mode: local `npx`, Docker,
  VPS, and Vercel.
- A server-side session cookie (httponly) keeps the user logged in
  until logout or expiry.
- AI keys never reach the client; they stay in the server-side store
  (see 6.5).
- Settings exposes change password and, later, session management.
- No account or email is required; this is a single-user local gate.
- Login attempts are rate-limited to slow brute-force tries.

### 6.8 Landing page (public, single page)

One page, nav to footer, no separate marketing site. Shares the app's
tokens, type scale, radii, and logo — it must look like the same
product, just in a document-shaped container.

Structure is inspired by openship.io (stacked two-line headline,
left-aligned hero, real product screenshots as the only imagery,
numbered walkthrough, spec table, FAQ, columned footer). It is **not**
a copy: no blue-gradient brand palette, no feature-card grid, no
comparison matrix against competitors.

**Imagery rule.** Every image on the page is a screenshot of this
product, captured from the running dashboard at 2x and exported to
`webp`. No stock photos, no illustrations, no abstract renders, no
AI-generated artwork, no device mockups. Screenshots sit in a plain
1px `--line` frame with `var(--r-lg)` radius and no drop shadow.

Sections, in order:

1. **Nav** — logo + wordmark left; anchors (`How it works`, `What you
   get`, `Sources`, `FAQ`) centre-right; `Open the app` pill and a
   small mono `v0.1.0` on the right. Sticky, `--side` background,
   1px bottom hairline. No blur, no shadow.
2. **Hero** — stacked two-line headline, left-aligned, largest type on
   the page (`--f-d`, clamp 40–64px, tracking -0.03em), second line in
   `--txt-3`. One supporting sentence at 16px/1.6 in `--txt-2`, max
   56ch. Two actions: primary accent pill `Open the app`, secondary
   bordered pill `See how it works`. Directly below, a full-width
   dashboard screenshot in a 1px frame — the same markup as the real
   app, not a redraw.
3. **Proof strip** — a single hairline-bordered row of plain-text facts
   separated by 1px rules: `Local-first`, `Works without an AI key`,
   `6 curated sources`, `Cited summaries`. Mono numerals, no badges,
   no logos.
4. **How it works** — three numbered steps, vertically stacked, each a
   two-column row: left = mono step number + short label; right =
   heading, one paragraph, and a cropped screenshot of that stage
   (feed, detail pane, citations). Hairline rule between steps. This is
   the section that carries the page; give it the most space.
5. **What you get** — spec list, not cards. Two columns per row: label
   (`--txt`) left, one-line description (`--txt-2`) right, 1px hairline
   separator between rows. Eight rows max: time windows, categories,
   cited summaries, provider-independent AI, local storage, no-key
   mode, keyboard-first UI, single-binary install.
6. **Sources** — the curated set as small bordered badges in a wrapped
   flow row, grouped by category with mono group labels. Real domains
   only. No logo wall, no marquee, no carousel.
7. **FAQ** — six to eight native `<details>` items, 1px hairline
   separators, mono chevron, no accordion library. Questions must be
   the ones a real user asks: is my data uploaded, do I need an API key,
   which providers work, how fresh is the feed, can I add sources.
8. **Closing action** — one line, one primary pill, one secondary link
   to the repo. Left-aligned, same rhythm as the hero.
9. **Footer** — logo and one-sentence description left; three link
   columns (`Product`, `Developers`, `Legal`) plus install command in
   mono; bottom row with `v0.1.0` and licence. 1px top hairline.

Rules: no pricing table, no testimonials, no newsletter form, no cookie
banner, no fake customer logos, no "trusted by". Copy is concrete and
short — every claim must be true of the shipped app. Section spacing
follows one rhythm (96px desktop / 56px mobile); content column max
1080px, centred, with the hero screenshot allowed to bleed wider.

### 6.9 Custom resources (post-MVP)

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

- Privacy: all data and keys stay on the user's machine by default.
- Portability: runs on Windows, macOS, and Linux.
- Performance: 24-hour feed renders in under two seconds on a laptop.
- Reliability: a failing source is skipped, not fatal.
- Extensibility: a new source or provider needs no core change.
- Accessibility: keyboard navigation, contrast, and labels.
- Security: sanitize all fetched HTML; never render raw remote markup.
- Security: login is required before any data is shown; passwords are
  hashed and login attempts are rate-limited.

## 8. Constraints

### 8.1 Chosen stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit (Svelte 5) |
| Language | TypeScript |
| Styling | Custom CSS with design tokens |
| Components | Hand-built, no default kit |
| Motion | Svelte transitions and CSS |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle |
| AI | Vercel AI SDK (core and svelte) |
| RSS | rss-parser |
| Server | adapter-node and adapter-vercel |

### 8.2 Runtime rules

- Runtime and dependencies: stable and latest, pinned exactly in
  `package.json`. Version sources and dates are recorded in the
  decisions log.
- AI keys are optional; the core product must work without them.
- No vendor lock-in for sources or models.

### 8.3 UI principles — LOCKED

Approved 2026-11-22. Reference implementation: `dash-design.html`.
Do not deviate without a new approval.

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

| Metric | Target |
|---|---|
| Time to first feed | Under 5 minutes from install |
| Fresh items per day | 20+ across 2+ categories |
| Cited summaries | 100% of summaries link to sources |
| Works without AI key | Yes |
| Supported providers | 3+ at launch |

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Source breakage | Health checks, graceful skip, retries |
| AI cost | Local providers, caching, on-demand summaries |
| Duplicate noise | Deduplication pass before ranking |
| Prompt injection from feeds | Treat fetched text as data, sanitize, strip instructions |
| Scope creep | Ship MVP first; roadmap stages are explicit |