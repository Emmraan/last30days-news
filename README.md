# last30days-news

A local reader for the last 30 days of technology news. It pulls RSS and Hacker News sources into one SQLite file, removes duplicate stories, and shows them in a desktop-style reader with optional AI summaries.

## Requirements

- Node.js 26.13.0
- pnpm 12.16.1 for development
- No account and no hosted service for the local install

## Install

```bash
npx last30days-news
```

The command starts the reader at `http://127.0.0.1:4477` and opens the browser. The first run uses the default password `last30`. Change it in Settings after signing in.

```text
last30days [options]

--no-open       Do not open the browser
--version, -v   Print the version and exit
--help, -h      Print help and exit
```

The process never prompts. It writes NDJSON logs to stdout; set `L30_DEBUG=1` for debug lines.

### Ports and data

`PORT` is used as-is. Without it, the reader tries 4477 through 4487 and fails with a clear message when none is free.

The data directory is created with owner-only permissions:

- Windows: `%APPDATA%\last30days-news`
- macOS: `~/Library/Application Support/last30days-news`
- Linux: `$XDG_DATA_HOME/last30days-news`, or `~/.local/share/last30days-news`
- Any platform: `L30_DATA_DIR` overrides the default

The database is one file, `<data-dir>/db.sqlite`, with WAL mode and foreign keys enabled.

### Forgotten password

A local `npx` install keeps the local escape hatch: `/reset` works from the machine running the reader. It clears the password, saved API keys and sessions; items, sources and categories stay. A remote client cannot use it.

Docker, VPS and Vercel are deployments. Docker and the systemd unit set `L30_DEPLOYED=1`; Vercel sets `VERCEL=1`. Either way they never accept the local default password and reset is disabled. To recover a deployment, stop the process and use an SQLite client or the Turso console to delete the setting rows `auth.password`, `crypto.salt`, and every row whose key starts with `secret.`. Set a fresh `L30_INITIAL_PASSWORD` (8+ characters) in the environment, then start again. Items, sources and categories stay; saved API keys must be entered again.

For Vercel, make the same setting-row changes in Turso, update `L30_INITIAL_PASSWORD` in the project environment, and redeploy.

### Reverse proxies

The server binds `127.0.0.1` by default. `HOST=0.0.0.0` works for containers and prints a warning.

Set `L30_TRUST_PROXY=1` only when a reverse proxy sets `X-Forwarded-Proto` and `X-Forwarded-For`. The reader then trusts those headers for secure cookies and client addresses. Do not set it when the port is directly exposed.

## Docker

```bash
docker build -t last30days-news .
docker run -d --name last30days-news \
  -p 4477:4477 \
  -v last30days-data:/data \
  -e L30_INITIAL_PASSWORD='choose-a-password' \
  last30days-news
docker logs last30days-news
```

The image runs as UID 1000 and keeps the database in `/data`. Mount a volume there; the entrypoint warns when `/data` is not a mount. `L30_INITIAL_PASSWORD` is used on the first boot and stored as a hash; the local default `last30` is never accepted, and reset is disabled. The health check calls `/api/health`.

If `L30_INITIAL_PASSWORD` is missing, the container still starts but login fails closed with a setup message. Set the variable and restart.

## VPS with systemd

1. Install Node.js 26.13.0 and pnpm 12.16.1.
2. Copy the repository to `/opt/last30days-news` and run `pnpm install --frozen-lockfile && pnpm build`.
3. Create a `last30days` user and `/var/lib/last30days-news`, owned by that user.
4. Create `/etc/last30days-news.env` with `L30_INITIAL_PASSWORD` set to an 8+ character password, readable only by root and the service user.
5. Install `deploy/last30days-news.service` in `/etc/systemd/system/`, then run `systemctl daemon-reload` and `systemctl enable --now last30days-news`.
6. Put a TLS proxy in front of `127.0.0.1:4477`. Keep `L30_TRUST_PROXY=1` only when that proxy sets the forwarded headers.

The unit sets `L30_DEPLOYED=1`, so the local default password and reset are disabled on this target.

## Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEmmraan%2Flast30days-news&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,L30_INITIAL_PASSWORD&envDescription=Turso%20database%20URL%2C%20auth%20token%2C%20and%20an%208%2B%20character%20first%20password&envLink=https%3A%2F%2Fgithub.com%2FEmmraan%2Flast30days-news%23environment-variables&project-name=last30days-news&repository-name=last30days-news)

Vercel uses the same codebase with `adapter-vercel`; `VERCEL=1` is set by the platform and selects the adapter in `vite.config.ts`. A local SQLite file cannot persist there, so a Turso database is required.

Before deploying, test the same Turso connection locally:

1. Create a Turso database and a fresh development branch.
2. Copy `.env.development.example` to `.env.development` and fill `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from that branch.
3. Run `pnpm dev`, sign in with the local default `last30`, and check that the feed and refresh work.
4. To test deployed-mode auth locally, put `L30_DEPLOYED=1` and `L30_INITIAL_PASSWORD` in `.env.development.local` (or the shell), then sign in with that password instead.

Click the button and set these environment variables in the Vercel project:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `L30_INITIAL_PASSWORD` (8+ characters; read once on the first boot)

Vercel sets `VERCEL=1`, so the local default password and reset are disabled. If `L30_INITIAL_PASSWORD` is missing, login fails closed with a setup message. After the deployment is live, sign in and change the password in Settings.

`/api/refresh` processes one batch per call on Vercel; the client polls it. Sessions and login lockouts are stored in the database, so they survive across function instances.

`vercel.json` contains the install and build commands. No other Vercel configuration is required.

## Environment variables

| Name                   | Purpose                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`                 | Listen port. Defaults to the first free port from 4477 to 4487.                                     |
| `HOST`                 | Bind address. Defaults to `127.0.0.1`.                                                              |
| `L30_DATA_DIR`         | Data directory. Defaults to the platform app data directory.                                        |
| `L30_DEPLOYED`         | Set to `1` on Docker, VPS and other public targets. Disables the local default password and reset.  |
| `L30_INITIAL_PASSWORD` | First password for a deployed install, 8+ characters. Read once while the database has no password. |
| `L30_DEBUG`            | Set to `1` for debug logs.                                                                          |
| `L30_TRUST_PROXY`      | Set to `1` only behind a proxy that sets `X-Forwarded-*`.                                           |
| `CI`                   | Set to skip opening the browser.                                                                    |
| `TURSO_DATABASE_URL`   | Turso database URL. Required on Vercel.                                                             |
| `TURSO_AUTH_TOKEN`     | Turso auth token. Required on Vercel.                                                               |

`.env.development.example` and `.env.production.example` list the names with dummy values. Copy them to `.env.development` and `.env.production`; those real files are ignored by git.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` loads `.env.development`. `pnpm build` loads `.env.production`, and `pnpm start:local` runs the built app with that file. To check the Vercel adapter locally, run `VERCEL=1 pnpm build`. On Windows that needs Developer Mode or an elevated shell because the adapter creates symlinks; CI runs the same build on Linux.

The full gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:landing
pnpm budget
pnpm test:smoke
pnpm test:package
pnpm audit:gate
```

`pnpm budget` reads the rendered pages from the built app and fails when a §S17 budget is over. The fetch-pass budget is not measured because tests and scripts never touch the network.

`pnpm test:package` packs the tarball, checks that it contains only the built app and no tests or source maps, installs it in a temporary directory, and checks both the local and deployed login paths.

Dependabot opens grouped weekly updates for npm, GitHub Actions and the Docker base image. A pull request with only patch and minor bumps is labelled `automerge`, then merged after both CI jobs pass; a major bump is closed with a comment and needs a manual branch. The policy lives in `.github/workflows/dependabot-policy.yml` and `.github/workflows/dependabot-merge.yml`.

## Releases

`main` is released by semantic-release after the CI workflow passes. Commit messages follow Conventional Commits, and the version is derived from them; the first release is `1.0.0`. Every release creates a Git tag and a GitHub Release. npm publishing is skipped when `NPM_TOKEN` is absent; add it to the `release` environment to publish the same release to npm. No manual tag or laptop publish.

## License

MIT. See `LICENSE`.
