# AGENTS.md

The spec is `context/PLAN.md`. On conflict, PLAN wins. This file is the
agent-facing copy of PLAN §S23; if the two disagree, §S23 wins.

Stack: SvelteKit + TypeScript + Tailwind v4 + `lucide-svelte` + libSQL/Turso
+ Drizzle + Vercel AI SDK. `adapter-vercel` in prod, `adapter-node` for
`npx`/Docker. Package manager is **pnpm** — never `npm install`, never a
second lockfile. Versions are pinned exact in `package.json`
(Node `26.13.0`, pnpm `12.16.1`). Do not re-resolve them.

Gates: `pnpm lint && pnpm check` mid-phase. `pnpm test && pnpm build` plus
the phase's **Done** line plus a security review at every phase gate.

## 1. Unit testing

Pure functions only: canonical URL, title normalisation, Jaccard, keyword
match, query building, cursor encode/decode, time presets, ranking
comparator. Table-driven, no mocks, no network, no DB. One `.test.ts` file
per unit, next to the source. Coverage is not the target — every documented
edge case having a case is.

## 2. Integration testing

Everything that touches the DB or a route: migrations, seed idempotency,
dedup insert, feed pagination, auth, category CRUD, encrypt/decrypt
round-trip. One real libSQL file DB per test file in a temp dir, deleted
after. Never mock the DB layer — a mocked DB proves nothing about the SQL
that ships.

## 3. Test-driven development

Test first, watch it fail, then write the smallest code that passes. A
phase's tests are written at the start of that phase, not after it. A bug
fix without a reproducing test is not a fix.

## 4. Pen tester pass

After each phase's green tests, switch to adversarial mode and try to break
the build. Minimum scope is PLAN §S24: auth bypass, injection, SSRF via
feed URL, resource exhaustion, secrets, rate limiting, crypto, CSRF, client
DoS, cost abuse, info leak, headers, supply chain. Produce a numbered
findings list: severity, what was broken, the exact reproduction, and the
smallest fix.

## 5. Discuss and improve

Findings are not auto-fixed. Present them as a list, discuss, prioritise,
then implement — with the decision recorded in that phase's section. A
finding may be accepted as a known limitation with a written reason.

## Hard rules

- Tests never touch the network. Recorded fixtures only.
- No file exists before the phase that needs it. No `utils/` dumping
  ground, no barrel `index.ts`, no interface with one implementation.
- A new dependency needs a one-line justification in the PR body: why the
  stdlib or an installed package could not do it. There is no
  `DECISIONS.md`.
- UI text is English and plain. No §S21 pattern ships.
- Comments explain *why*, never *what*.
