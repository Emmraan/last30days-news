# Contributing

Thanks for taking the time to improve last30days-news. This project is small on purpose: one SvelteKit app, one libSQL database, one user. Keep changes focused and easy to review.

Before you start, read the [README](README.md), the project rules in [AGENTS.md](AGENTS.md), and the current plan in [context/PLAN.md](context/PLAN.md). Those files are the source of truth when a suggestion here is not specific enough.

## Set up

Requirements:

- Node.js 26.13.0
- pnpm 12.16.1

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` loads `.env.development`. Copy `.env.development.example` if you need Turso or other overrides. Never commit `.env.development` or `.env.production`; both are ignored.

Use pnpm only. Do not run `npm install`, do not add a second lockfile, and do not re-resolve the exact versions pinned in `package.json`.

## Branches

- Planned work gets a branch from `main`: `phase-N-<slug>` for a phase from `context/PLAN.md`, or `feat-<slug>` for a feature.
- Small fixes, wording changes and doc edits can go straight onto `main` as a direct commit.
- Merge a branch with `--no-ff` and keep the branch. `main` only moves by merge or by those small direct commits.
- Do not force-push `main`.

An explicit instruction from the owner wins over this default.

## Tests first

Write the test first, watch it fail, then write the smallest code that passes.

- **Unit tests:** pure functions only. Canonical URLs, title normalisation, Jaccard, keyword matching, query building, cursor encoding, time presets and the ranking comparator. Table-driven, no mocks, no network, no database. Put the test next to the source.
- **Integration tests:** anything that touches the database or a route. Use one real libSQL file database per test file in a temp directory, and delete it after. Never mock the database layer; a mocked database proves nothing about the SQL that ships.
- **Bug fixes:** include a test that reproduces the bug. A fix without one is not complete.
- **Network:** tests never touch the network. Use recorded fixtures.

A phase's tests are written at the start of that phase, not after it.

## Inner loop

After each edit, run the fast gates:

```bash
pnpm lint:changed
pnpm typecheck:changed
pnpm test:changed
```

They only look at new and modified files. To run one test file directly:

```bash
pnpm exec vitest run tests/auth-routes.test.ts
```

Before a merge, run the full gate once:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm build:landing && pnpm budget && pnpm test:smoke && pnpm test:package && pnpm audit:gate
```

Notes:

- Run `pnpm budget` alone. It measures cold boot and is sensitive to other heavy commands running at the same time.
- `pnpm test:package` packs the npm tarball, installs it in a temporary directory, and checks local and deployed login.
- `pnpm audit:gate` fails on critical and high advisories. Moderate findings are discussed before a merge.
- CI runs the same full gate on every push and pull request.

## Code style

- TypeScript and SvelteKit. Use the existing patterns before adding a new abstraction.
- Tailwind v4 and the tokens in `src/app.css`. Do not add a second styling system.
- Comments explain _why_, never _what_. If a comment repeats the code, delete it.
- No new dependency without a one-line justification in the pull request: why the standard library or an installed package cannot do it.
- No `utils/` dumping ground, no barrel `index.ts`, no interface with one implementation.
- Keep the package contents narrow. Tests, source, fixtures and `.env` files do not ship in the npm tarball.

### UI

The UI must read as a Windows desktop app, not a webpage:

- No gradients, aurora backgrounds, card grids, fake window chrome or serif display fonts.
- No web fonts. Use the system UI font.
- Plain English. No "unlock", "supercharge", "seamless", "elevate" or "game-changing".
- No emoji headings or marketing voice.

A dashboard change is not complete until the matching `landing/` preview and copy are updated in the same change set. The showcase must never describe an older dashboard.

## Commits and releases

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add saved searches
fix: reject the default password on deployments
docs: explain the Turso URL scheme
test: cover first-run password change
ci: drop the Docker job
chore: update the release notes
```

Releases are automatic. When CI passes on `main`, semantic-release creates a GitHub tag and Release, and publishes to npm only when `NPM_TOKEN` is configured in the `release` environment. Do not create tags or publish from a laptop.

## Pull requests

Open a pull request against `main`. Include:

- What changed and why.
- The test evidence: the failing test before the fix, and the passing command after it.
- Screenshots or a short recording for UI changes.
- A link to the phase or issue when there is one.
- Any new dependency and its one-line justification.

Before you ask for review:

- [ ] The change has a test that failed before the fix.
- [ ] `pnpm lint:changed`, `pnpm typecheck:changed` and `pnpm test:changed` pass.
- [ ] The full gate passes before merge.
- [ ] README and CHANGELOG are updated for user-visible changes.
- [ ] The landing preview is updated for dashboard changes.
- [ ] No secrets, `.env` files, database files or build output are committed.
- [ ] Auth, feed, AI and deployment changes got a security review (see [SECURITY.md](SECURITY.md)).

Critical and high security findings are fixed before the merge, with a reproducing test. Everything else is discussed and prioritised first.

## Dependabot

Dependabot opens grouped minor and patch updates weekly. The policy workflow labels them `automerge` and the merge workflow merges them after CI passes. Major updates are commented and closed. Do not merge Dependabot pull requests by hand; let the policy do it.

## Questions

Open an issue for a bug or a design question. For a security problem, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
