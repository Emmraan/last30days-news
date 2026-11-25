# Development setup

Local development only. Production installs, Docker and deployment are out of
scope; see `README.md`, `Dockerfile`, `deploy/` and the docs site. Read
`AGENTS.md` and `.agents/skills/last30days-news/SKILL.md` before changing code.

## Requirements

- Node.js `26.13.0`, pnpm `12.16.1` and Git, exactly as pinned in
  `package.json`.
- Install pnpm if it is missing: `npm install -g pnpm@12.16.1`.
- Check with `node -v` and `pnpm -v` before continuing.
- Use pnpm only. Never run `npm install` in the repository, add a second
  lockfile, or change the pinned versions.

## First setup

1. Clone the repository and open the repository root.
2. Install the workspace, including `landing/`:

   ```bash
   pnpm install --frozen-lockfile
   ```

3. Start the app:

   ```bash
   pnpm dev
   ```

   Vite prints the URL, usually `http://localhost:5173`.

4. On first boot the app creates its data directory and `db.sqlite`, applies
   every migration in `drizzle/`, and seeds the builtin categories and sources.
   There is no separate migrate or seed command.

5. Sign in with the local first-run password `last30`, then change it in
   Settings. The boot notice prints the data directory.

No environment file is needed for local SQLite. Copy
`.env.development.example` to `.env.development` only for Turso or
deployed-mode testing, and leave the Turso values blank to stay local. On
Windows PowerShell use `Copy-Item`.

## Commands

```bash
pnpm dev              # app on Vite, usually port 5173
pnpm dev:landing      # landing and docs on http://localhost:5174/docs
pnpm build            # production build of the app
pnpm build:landing    # static landing build
pnpm start            # built app on 127.0.0.1, first free port 4477-4487
pnpm start:local      # same, but loads .env.production
pnpm db:generate      # regenerate drizzle/*.sql after a schema edit
pnpm format           # Prettier
```

`pnpm start` needs a successful `pnpm build`. It does not load
`.env.production`; use `pnpm start:local` for that.

## Environment

Read only the example files: `.env.development.example` and
`.env.production.example`. Never read, print or commit `.env.development` or
`.env.production`; both are ignored and may hold real credentials.

Vite fills missing process variables from `.env.development`; values already
set in the shell win. Tests skip environment-file merging, so a local `.env`
cannot point the suite at a real database.

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: optional remote libSQL database.
  Leave blank for a local file. Use the `libsql://` URL, not `turso://`.
- `L30_DATA_DIR`: SQLite folder. Defaults to the platform app-data directory
  (`%APPDATA%\last30days-news` on Windows).
- `L30_DEPLOYED=1`: test deployed auth locally; disables the `last30` default
  and password reset.
- `L30_INITIAL_PASSWORD`: first password in deployed mode, at least 8
  characters.
- `L30_DEBUG=1`: debug logs. Local and VPS only.
- `L30_TRUST_PROXY=1`: only behind a proxy that overwrites `X-Forwarded-*`.
- `PORT`, `HOST`: packaged app only; Vite dev ignores them.
- `CI=1`: do not open a browser from the packaged app.
- `APP_URL`: landing build only; defaults to `http://localhost:5174`.

AI provider keys are entered in Settings and stored encrypted in the database.
There is no AI key environment variable. Do not make real provider calls unless
the owner asks; tests use recorded fixtures.

## Database

- Local path is `<data-dir>/db.sqlite`, with WAL mode and foreign keys enabled.
- Migrations and seeding run on every boot. A new file in `drizzle/` is picked
  up automatically.
- After editing `src/lib/server/db/schema.ts`, run `pnpm db:generate` and
  commit the new SQL file. Do not edit an applied migration.
- To reset local data, stop the dev server and delete `db.sqlite`,
  `db.sqlite-wal` and `db.sqlite-shm`. This is destructive: ask the owner
  first. For a clean side-by-side run, point `L30_DATA_DIR` at a new folder.
- Without FTS5, boot still succeeds and search falls back to `LIKE`.

## Gates

After every edit:

```bash
pnpm lint:changed
pnpm typecheck:changed
pnpm test:changed
```

One test file:

```bash
pnpm exec vitest run tests/auth-routes.test.ts
```

Before a merge:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm build:landing && pnpm budget && pnpm test:smoke && pnpm test:package && pnpm audit:gate
```

Run `pnpm budget` alone; it measures cold boot. Tests never touch the network
and use recorded fixtures. Integration tests use real file-backed libSQL
databases in temporary directories.

## Working rules

- Planned work gets `phase-N-<slug>` or `feat-<slug>` from `main`; small fixes
  and docs can go directly on `main`. Merge with `--no-ff`.
- Use Conventional Commits.
- Never commit `.env` files, databases, build output or secrets.
- Never use the section-sign glyph. Write `section 6.2`, `S9` or `P4`.
- Ask before deleting data or changing a pinned version or credential.

## Troubleshooting

- **Install or engine error:** the Node or pnpm version is wrong. Fix it and
  rerun `pnpm install --frozen-lockfile`.
- **Port in use:** Vite picks the next free port; read its output. The packaged
  app scans 4477 to 4487.
- **Database locked:** another app or dev server holds the same SQLite file.
  Stop it; do not delete the database.
- **Unknown password:** local development uses `last30` only until it is
  changed. If it was changed, ask the owner; do not reset data without
  permission.
- **Docs 404:** run `pnpm dev:landing` and open
  `http://localhost:5174/docs`; `pnpm dev` serves the app only.
- **Landing build asks for `APP_URL`:** set it only for a deployed build; local
  builds default to `http://localhost:5174`.
- **Windows shell:** use `Copy-Item` and `$env:NAME = 'value'`.

Production deployment and the release flow are not part of this setup.
