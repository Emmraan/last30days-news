---
name: last30days-news
description: Which skills from Emmrraan/agent-skills apply to this project (SvelteKit + libSQL + AI SDK), when to load each, and which packs to skip. Use before starting any phase, feature or fix here.
---

# last30days-news — skill map

One skill for this repo. It says which skills from
[Emmraan/agent-skills](https://github.com/Emmraan/agent-skills) are relevant
here and when to load them. It is a router, not a copy: load the real skill by
ID when its row applies.

Project facts live in `AGENTS.md` and `context/PLAN.md`. Those win over
anything below. Do not restate them from memory.

## Project type

**Web app — full stack.** You own the UI and the backend: SvelteKit,
TypeScript, Tailwind v4, libSQL/Turso, Drizzle, Vercel AI SDK. That means the
Mandatory Core Kit plus the full-stack pack. Nothing else.

## Install

```bash
# Mandatory Core Kit — every project, no exceptions
npx skills add https://github.com/Emmraan/agent-skills --skill loop-orchestrator
npx skills add https://github.com/Emmraan/agent-skills --skill using-agent-skills
npx skills add https://github.com/Emmraan/agent-skills --skill planning-and-task-breakdown
npx skills add https://github.com/Emmraan/agent-skills --skill incremental-implementation
npx skills add https://github.com/Emmraan/agent-skills --skill testing
npx skills add https://github.com/Emmraan/agent-skills --skill test-master
npx skills add https://github.com/Emmraan/agent-skills --skill code-reviewer
npx skills add https://github.com/Emmraan/agent-skills --skill code-simplification
npx skills add https://github.com/Emmraan/agent-skills --skill version-control
npx skills add https://github.com/Emmraan/agent-skills --skill sdlc-workflow
npx skills add https://github.com/Emmraan/agent-skills --skill forward-deployed-engineer
npx skills add https://github.com/Emmraan/agent-skills --skill technical-writer

# Full-stack pack
npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/frontend-ui
npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/backend-apis
npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/databases-data
npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/devops-cloud
npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/testing-quality
```

## Core Kit — when, in this repo

| Skill | Load it when |
| --- | --- |
| `loop-orchestrator` | Starting a phase from `context/PLAN.md`. It owns DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP. |
| `using-agent-skills` | You are unsure which skill fits the current task. Load this first, then the one it names. |
| `planning-and-task-breakdown` | A phase's **Done** line needs turning into ordered tasks before any code is written. |
| `incremental-implementation` | Every phase. One thin slice, verify, commit, next slice. Matches the one-branch-per-phase rule. |
| `testing` | Deciding what the phase's tests are. `AGENTS.md` sections 1–3 already fix the shape: pure unit tests next to the source, real-file DB integration tests. |
| `test-master` | Writing the actual test files — table-driven cases, edge cases, fixture wiring. Never for mocking the DB layer. |
| `code-reviewer` | Before every merge, alongside the pen-tester pass in `AGENTS.md` section 4. Its "human-code bar" is the same rule as the comment policy: explain why, never what. |
| `code-simplification` | Before every merge, after review. Deletion over addition. It will try to add abstractions — reject that, `AGENTS.md` forbids interfaces with one implementation. |
| `version-control` | Branching and commit shape: `phase-N-<slug>`, atomic commits, `--no-ff` merge, branch kept. |
| `sdlc-workflow` | Release work (CI, packaging). The phase loop here is `PLAN.md`, not a full issue→PR pipeline. |
| `forward-deployed-engineer` | First task in an unfamiliar area of the repo — orient before editing. Useful when the UI shell lands. |
| `technical-writer` | README, install notes, and the landing copy. Copy must pass the `AGENTS.md` blocklist: no "unlock", "seamless", "supercharge". |

## Full-stack pack — when, in this repo

| Skill | Load it when |
| --- | --- |
| `svelte` | Any `.svelte` file, runes, or `$app/*` module question. SvelteKit 3 here, not 2 — verify against installed types, not memory. |
| `typescript` | Route handler typing, `$types`, generics, narrowing. |
| `tailwind-css` | Dashboard layout and the design tokens in `src/app.css`. |
| `vite` | `vite.config.ts`, adapter selection, vitest `include`. |
| `frontend-core` | Panes, forms, list rendering. |
| `frontend-craft` | Feed rows, UI states, focus rings, keyboard. UI must read as a Windows desktop app: no gradients, no card grids, no web fonts. |
| `api-design` | Feed, summaries, categories — route shapes, status codes, `{error:{code,message}}`. |
| `authentication` | Authentication rework, settings. The scheme is already locked: scrypt, AES-GCM vault, DB-backed lockout. Do not redesign it. |
| `security` / `security-baseline` | The pen-tester pass every phase gate: SSRF, XSS from hostile feeds, cost abuse, secrets in logs. |
| `database-architecture` | Dedup and pagination — schema shape, indexes, FTS5. |
| `database-performance` | Feed query, search. Budgets fail the build on breach. |
| `backend-core` / `backend-craft` | `src/lib/server/**` — the fetch pass, ingest, AI calls. |
| `playwright-expert` | `e2e/` only, and only for the release smoke run. Tests never touch the network, so recorded fixtures come first. |
| `browser-testing-with-devtools` | When a layout bug needs a real DOM. Never for backend work. |
| `devops` / `cloud` | Release work only: `adapter-node`, Docker, Vercel. |

## Skipped packs — and why

| Pack | Why not |
| --- | --- |
| `marketing-growth` | No funnel, no CRO. The copy blocklist bans marketing voice outright. |
| `creative-web-design` | The UI is LOCKED and explicitly forbids gradients, aurora backgrounds, fake window chrome. |
| `animation-webgl` | No animation budget; `motion`/GSAP would fight the desktop-app look. |
| `design-ux` | The UI is locked by spec, so `top-design`/`refactoring-ui` would only propose changes the spec rejects. |
| `ai-ml` | The model is a text function, not a pipeline. No RAG, no fine-tuning, no pandas. |
| `languages` | No Python/Go/Rust here. `node` and `typescript` from `frontend-ui` cover it. |
| `agent-meta` | Single-agent repo. No microservices, no orchestration layer. |
| e-commerce, mobile, enterprise | Not this product. |

## Rules these skills do not override

- Versions are pinned exact in `package.json`. Do not re-resolve them, and do
  not accept a version bump a skill suggests.
- No new dependency without the one-line justification in the PR body.
- Nothing is implemented on `main`. Branch per phase, feature or fix.
- `pnpm lint:changed`, `pnpm typecheck:changed`, `pnpm test:changed` are the
  inner loop. The full gate runs once, before the merge.
- Critical and high findings are fixed before the commit, with a reproducing
  test. Everything else is discussed first.
- Skills may suggest abstractions, factories, config layers, or extra files.
  Refuse anything the phase does not need.
