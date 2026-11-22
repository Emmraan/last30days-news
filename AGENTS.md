# AGENTS.md

This file is self-contained. Do not assume any other spec document exists or
will survive — it may be replaced. Every rule an agent needs is written here.

Stack: SvelteKit + TypeScript + Tailwind v4 + `lucide-svelte` + libSQL/Turso
+ Drizzle + Vercel AI SDK. `adapter-vercel` in prod, `adapter-node` for
`npx`/Docker. Package manager is **pnpm** — never `npm install`, never a
second lockfile. Versions are pinned exact in `package.json`
(Node `26.13.0`, pnpm `12.16.1`). Do not re-resolve them.

Gates: `pnpm lint:changed`, `pnpm typecheck:changed` and
`pnpm test:changed` after every edit — they look only at new and modified
files, so the loop stays fast. The full gate (`pnpm lint && pnpm typecheck
&& pnpm test && pnpm build && pnpm audit`) runs once per phase, before the
merge, and in CI. Never run the full suite as the inner dev loop.

Branches: every phase, feature and fix gets its own branch off `main` —
`phase-N-<slug>`, `feat-<slug>`, `fix-<slug>`. Nothing is implemented on
`main`. A branch is merged with `--no-ff` and kept; `main` only ever moves
by merge. The one exception is an explicit instruction from the owner to
work on `main` for that specific change.

Skills: before starting any phase, feature or fix, read
`.agents/skills/last30days-news/SKILL.md` and load the skills it names for
that kind of work, so the implementation follows this project's own
conventions. The rules in this file win over anything a skill says.

Progress: `context/PROGRESS.md` is the phase history — commit, gate result,
deviations and accepted findings, one entry per merged phase. Append to it
before the phase merge.

Doc lifecycle: `context/PRD.md` is the working spec. Once `context/PLAN.md`
covers everything the PRD describes, replace the PRD with its blank template
so the next round is written there. Once every phase in `PLAN.md` is merged,
replace `PLAN.md` and `PROGRESS.md` with their blank templates. A template's
sections stay; only the fields are emptied. Today `PRD.md` stays filled —
the post-MVP scope has no plan yet.

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
the build. Cover at least:

- **Auth bypass** — any `/api/*` reachable without a session; cookie
  forging; session fixation; expiry not enforced; `mustChangePassword`
  ignored.
- **Injection** — FTS5 query smuggling (`"`, `*`, `NEAR`, `^`, column
  filters), SQL via sort/cursor params, XSS in item title/excerpt/author
  from a hostile feed, XSS in the AI summary, template injection in
  `reason`.
- **SSRF via feed URL** — a pasted URL pointing at `127.0.0.1`,
  `169.254.169.254`, `[::1]`, `file://`, a redirect chain, or a non-HTTP
  scheme. Must be blocked and must not leak the response.
- **Resource exhaustion** — a 2 GB feed, a feed with 50k items, a zip bomb,
  `Content-Length` lies, no timeout, an infinite redirect loop, a category
  with 10k keywords, `limit=100000`.
- **Secrets** — a key in any response body, log line, error string, or
  stack trace; settings dumpable unauthenticated; reset leaving an old key
  usable.
- **Rate limiting** — 100 parallel logins; does the lockout hold when the
  DB is remote; can a spoofed `X-Forwarded-For` reset the counter.
- **Crypto** — non-constant-time compare anywhere, reused IV, missing GCM
  tag check, password change not re-encrypting, salt not rewritten on
  reset.
- **CSRF** — non-GET without `Origin`, `Origin: null`, a cross-site form
  post, `SameSite` missing in a prod build.
- **Client DoS** — a 100k-char title, a title of only combining marks, an
  RTL override in a title, `line-clamp` bypass.
- **Cost abuse** — unauthenticated AI calls; a category prompt that
  triggers unbounded scoring; a model response that loops the repair.
- **Info leak** — a stack trace in an API error, the data dir path in a
  prod error, source URLs of disabled feeds, the version string.
- **Headers** — CSP actually emitted, no `unsafe-inline`, no missing
  `nosniff`, cache headers not caching authenticated JSON.
- **Supply chain** — a new dependency with a postinstall script, an
  unpinned transitive, a lockfile change with no `package.json` change.

Produce a numbered findings list: severity, what was broken, the exact
reproduction, and the smallest fix.

## 5. Discuss and improve

Critical and high findings are fixed before the phase is committed — no
discussion needed, the fix lands with a reproducing test. Everything else
is presented as a list, discussed, prioritised, then implemented, with the
decision recorded next to that phase's work. A finding may be accepted as a
known limitation with a written reason.

## Hard rules

- Never read real environment values from `.env` while implementing or
  debugging. No `cat .env`, no printing an env var, no dumping the process
  environment. Work from the documented variable names only; if a value is
  genuinely needed, ask for it instead of reading it.
- Tests never touch the network. Recorded fixtures only.
- No file exists before the phase that needs it. No `utils/` dumping
  ground, no barrel `index.ts`, no interface with one implementation.
- A new dependency needs a one-line justification in the PR body: why the
  stdlib or an installed package could not do it. There is no
  `DECISIONS.md`.
- UI text is English and plain. No AI-pattern copy: no "unlock", "supercharge",
  "seamless", "elevate", "game-changing", no em-dash-heavy marketing voice,
  no emoji headings.
- UI must read as a Windows desktop app, not a webpage: no gradients or
  aurora backgrounds, no card grids, no fake window chrome, no serif
  display fonts, no multi-colour status dots, no web fonts.
- Comments explain *why*, never *what*.
