# PRD — last30days-news

Index only. Buildable spec is `context/PLAN.md` (§S specs, §P phases).
On conflict, PLAN wins. Fill each heading; keep it one screen.

## 1. What and why

A personal AI intelligence desk: the last 24 hours of AI and technology news,
filtered by categories you define, summarised with citations. Local-first,
single user, one command to run. Built for one technical person tired of
tab-hopping, duplicate stories, and clickbait — one feed, one window, one
summary that points back at the source.

## 4. Scope (v0.1)

In: time-window feed (24h/7d/30d/custom), two builtin categories plus
user-created ones, six curated sources, dedup and ranking, FTS5 search,
on-demand summaries, password login, landing page, `npx` + Docker install.

Out: multi-user, teams, mobile, cloud sync, digests, social scraping,
publishing, analytics, i18n, multi-replica SQLite.

## 5. Requirements

Behaviour lives in PLAN: time §S3 · categories §S4 · sources §S5 · fetch §S6 ·
dedup and rank §S7 · AI contract §S8 · search §S13 · keyboard §S14 · states
§S12 · landing §S22.

## 6. Constraints

Stack locked (PLAN §S1): SvelteKit + TS + Tailwind v4 + `lucide-svelte` +
libSQL/Turso + Drizzle + Vercel AI SDK + rss-parser. `adapter-vercel` in prod,
`adapter-node` for `npx`/Docker. No chart library, no UI kit, no web fonts.
Versions pinned exact in `package.json` (Node 26.13.0, pnpm 12.16.1).

UI locked (PLAN §S11, §S21): tokens, layout, radii, logo B, AI-pattern
blocklist. Deviation needs approval.

## 7. Non-functional

Budgets §S17 · CI gates §S18 · logging §S16 · retention §S15 · language §S20 ·
security §S9.

## 8. Done

Cold boot <800ms. `/api/feed` p95 <300ms at 20k rows. A new user reaches a
populated feed in under a minute. Tests never hit the network. No §S21 pattern
ships. Every phase: tests written first, then a §S24 pen-test pass.

## 9. Risks

Feed formats drift → fixtures + three-strike disable. Providers change → prompt
in one file, adapter per provider. SQLite on network FS → documented, refused.
Scope creep → ordered phases, nothing exists before the phase that needs it.
