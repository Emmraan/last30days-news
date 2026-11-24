# Changelog

## 0.1.0 - 2026-11-24

- First release.
- Local reader for the last 30 days of technology news.
- RSS and Hacker News sources, duplicate removal, categories, search and AI summaries.
- Single SQLite file with WAL mode and automatic migrations.
- `npx last30days-news` installs a `last30days` binary with port selection, data-directory defaults and optional browser opening.
- Docker image with a non-root user, `/data` volume and health check.
- systemd unit for a VPS behind a TLS proxy.
- Vercel target using Turso, selected by `VERCEL=1`.
- Deployed installs require `L30_INITIAL_PASSWORD`, never accept the local default password, and disable password reset.
- Build budgets, HTTP smoke tests and package-install smoke tests.
