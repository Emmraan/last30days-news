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
| v0.6 | Customization | Custom topics, custom source manager, country filters |
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
- Keys are stored locally and never sent anywhere except the chosen
  provider.
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

## 7. Non-functional requirements

- Privacy: all data and keys stay on the user's machine by default.
- Portability: runs on Windows, macOS, and Linux.
- Performance: 24-hour feed renders in under two seconds on a laptop.
- Reliability: a failing source is skipped, not fatal.
- Extensibility: a new source or provider needs no core change.
- Accessibility: keyboard navigation, contrast, and labels.
- Security: sanitize all fetched HTML; never render raw remote markup.

## 8. Constraints

- Runtime and dependencies: stable and latest, pinned exactly in
  `package.json`. Version sources and dates are recorded in the
  decisions log.
- AI keys are optional; the core product must work without them.
- No vendor lock-in for sources or models.

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