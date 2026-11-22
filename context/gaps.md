# PRD gaps

Audit of `context/PRD.md` before implementation. Each gap has an ID and a
status. Resolve one at a time; mark `RESOLVED` with the PRD section that
answers it.

Status values: `OPEN` · `RESOLVED` · `DROPPED`

---

## A — Contradictions inside the PRD

### G-01 · §6.6 lists post-MVP features as requirements — `RESOLVED`
Answered by PRD §6.6: split into "Ships in v0.1 (MVP)" and "Post-MVP"
blocks; post-MVP bullets cross-reference §5.

### G-02 · Time filters disagree — `RESOLVED`
Answered by PRD §6.1 "Ranges in v0.1": 24h / 7d / 30d only, rolling
windows; calendar day and custom range are explicitly post-MVP.

### G-03 · Category count disagrees — `RESOLVED`
Answered by PRD §6.2: `ai` and `technology` active; six others exist in
the enum with no sources and are hidden in the UI.

### G-04 · Landing page claims unbacked facts — `RESOLVED`
Answered by PRD §6.11 (exactly six sources, listed) and §6.20 (the
keyboard map). Both landing page claims now have a spec behind them.

---

## B — Missing specifications, blocking implementation

### G-05 · No data model — `RESOLVED`
Answered by PRD §6.10 Data model (LOCKED): six tables, column types,
indexes, and storage rules.

### G-06 · No exact source list — `RESOLVED`
Answered by PRD §6.11 Curated sources (LOCKED): six sources with id,
kind, URL, category, interval, plus the HN API shape and the seed-file
rule.

### G-07 · No refresh policy — `RESOLVED`
Answered by PRD §6.12 Fetch and refresh policy (LOCKED): on-demand
passes, per-source TTL, 4 in flight, 10s timeout, two jittered retries,
isolation, streaming partial results, 200-item cap, fixture-only tests.

### G-08 · Deduplication is a word, not a rule — `RESOLVED`
Answered by PRD §6.13: canonical URL steps, three match conditions,
oldest-row-wins merge, no cross-category merges.

### G-09 · No ranking fallback when AI is off — `RESOLVED`
Answered by PRD §6.13 "Ranking — with AI off": source_count, then
published_at, then id. Deterministic and stable.

### G-10 · No AI output contract — `RESOLVED`
Answered by PRD §6.14 AI output contract (LOCKED): strict JSON shape,
field caps, temperature 0.2, 700 token cap, one repair attempt,
server-side citations, on-demand generation.

### G-11 · Timezone of a "last 24 hours" window — `RESOLVED`
Answered by PRD §6.1 "Time rules (LOCKED)": UTC millisecond storage,
rolling windows, client-computed ranges, published-time filtering,
`estimated` flag for missing publish dates.

### G-12 · No retention or pruning policy — `RESOLVED`
Answered by PRD §6.21: 30-day item retention via one `RETENTION_DAYS`
constant, cascading deletes, session sweeping, 500 MB `VACUUM` trigger.

### G-13 · Encryption is named, not specified — `RESOLVED`
Answered by PRD §6.15: AES-256-GCM, scrypt-derived data key, per-secret
IV, `<iv>.<tag>.<ct>` layout, password change re-encrypts, password loss
means key loss (stated in the UI).

### G-14 · Session and login defence specifics — `RESOLVED`
Answered by PRD §6.15: `l30_session` cookie flags and 30-day TTL,
session-id rotation, Origin-check CSRF, scrypt password hashing, per-IP
rate limits, constant-time login, security headers.

### G-15 · Install contract — `RESOLVED`
Answered by PRD §6.17: package/binary names, port range 4477–4487, bind
address, per-OS data dir with `L30_DATA_DIR` override, single SQLite file
with pragmas, `--no-open`, no prompts.

### G-16 · No API surface — `RESOLVED`
Answered by PRD §6.16: 14 routes, auth rule, error envelope, cursor
pagination, SSE refresh, epoch-ms dates, strict body validation.

### G-17 · No UI state definitions — `RESOLVED`
Answered by PRD §6.18: empty, loading, error, offline, long content,
first run — each with copy tone, tokens, and containment rules.

### G-18 · Search implementation undefined — `RESOLVED`
Answered by PRD §6.19: FTS5 external-content table, weighted columns,
safe query building, bm25 ranking, 2-char minimum, boot-time fallback.

### G-19 · Licence and source terms — `RESOLVED`
Answered by PRD §6.22: MIT, always-on attribution, declared-interval
fetching, robots.txt posture, excerpt-only storage, no paywall
circumvention.

---

## C — Deferred, not blocking v0.1

- **G-20** Logging and observability — `OPEN`
- **G-21** Bundle size budget — `OPEN`
- **G-22** CI gates and release process — `OPEN`
- **G-23** i18n — items carry a `language` field but the UI language policy
  is undecided — `OPEN`
- **G-24** Docker and VPS packaging specifics — `OPEN`

---

## Resolution order

**B section complete.** All of G-01 … G-19 resolved.

| Gap | PRD section |
|---|---|
| G-01 §6.6 split | §6.6 |
| G-02 ranges | §6.1 |
| G-03 categories | §6.2 |
| G-04 landing claims | §6.11, §6.20 |
| G-05 data model | §6.10 |
| G-06 source list | §6.11 |
| G-07 refresh | §6.12 |
| G-08 dedup | §6.13 |
| G-09 ranking | §6.13 |
| G-10 AI contract | §6.14 |
| G-11 timezone | §6.1 |
| G-12 retention | §6.21 |
| G-13 encryption | §6.15 |
| G-14 session | §6.15 |
| G-15 install | §6.17 |
| G-16 API surface | §6.16 |
| G-17 UI states | §6.18 |
| G-18 search | §6.19 |
| G-19 licence | §6.22 |

Section C (G-20 … G-24) stays open by design — they are deploy-time
decisions, not v0.1 blockers.
