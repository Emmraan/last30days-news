# Security policy

## Supported versions

Only the latest release and the current `main` branch receive security fixes. Older tags are not backported.

| Version        | Supported                   |
| -------------- | --------------------------- |
| Latest release | Yes                         |
| `main`         | Yes, until the next release |
| Older tags     | No                          |

## Report a vulnerability

Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue and the impact.

Do not open a public issue for a security problem. If private reporting is unavailable, open a minimal issue asking for a private contact method, without exploit details.

Include:

- The version or commit.
- The target: local, Docker, systemd/VPS or Vercel.
- The exact reproduction steps.
- What an attacker can do, and what they need to start.
- Relevant logs or responses with secrets removed.

Never send API keys, Turso tokens, session cookies, passwords or real user data. Redact them.

This is a single-maintainer project, so response times are best effort. I will acknowledge the report as soon as I can, usually within a few days, and tell you the next step. There is no bug bounty.

## Deployment model

The local install and a deployment intentionally behave differently:

- A local install accepts the default password `last30` on first run and allows `/reset` from the same machine. This is the local escape hatch, not a vulnerability.
- A deployment runs with `L30_DEPLOYED=1` or `VERCEL=1`, requires `L30_INITIAL_PASSWORD`, rejects `last30` even when an old database stores its hash, and disables reset.
- A deployment with no stored password and no initial password fails closed with `503 setup_required`.

A report that shows a deployment accepting `last30`, resetting a password from a remote address, bypassing the setup check, or leaking password material is in scope. A report that only shows the documented local default is not.

## In scope

- Authentication bypass, session fixation, missing expiry, ignored `mustChangePassword`.
- Default-password or reset-based takeover of a deployment.
- SSRF through a feed URL, including loopback, link-local, cloud metadata, `file://`, redirect chains and non-HTTP schemes.
- XSS from a hostile feed title, excerpt or author, from an AI summary, or template injection in a category reason.
- SQL or FTS5 injection through search, sort, cursor or filter parameters.
- Secrets in a response body, log line, error string or stack trace.
- Unauthenticated settings access or unauthenticated AI calls.
- CSRF on state-changing requests.
- Login lockout bypass, including spoofed `X-Forwarded-For` when a proxy is misconfigured.
- Resource exhaustion: oversized feeds, tens of thousands of items, zip bombs, lying `Content-Length`, missing timeouts, redirect loops, huge limits.
- Path traversal or arbitrary file read/write.
- Supply-chain issues in a new dependency, such as an unexpected postinstall script or an unpinned transitive dependency.
- Missing security headers or cache headers that cache authenticated JSON.
- Information leaks such as the data directory, source URLs of disabled feeds or the version string in a production error.

## Out of scope

- The documented local default password and loopback reset on a local install.
- A deployment that deliberately removes the documented safeguards, such as exposing the app directly without TLS or a proxy. Tell us anyway if the app itself leaks data.
- Automated scanner output without a concrete reproduction.
- Self-XSS, social engineering, physical access or a compromised host.
- Denial of service against a deployment you do not own.
- Best-practice suggestions with no security impact.
- AI output quality or accuracy, unless it enables XSS, injection or secret disclosure.
- Dependency version alerts with no exploitable path. Dependabot already tracks those.

## Safe harbour

Test only against your own deployment or a local copy. Do not access, change or delete other people's data. Do not run denial-of-service tests against a shared service. Give the project reasonable time to fix the issue before public disclosure.

To the extent permitted by law, I will not pursue legal action for good-faith research that follows these rules.

## Disclosure

I prefer coordinated disclosure. I will credit you in the advisory if you want. Please do not publish details before a fix is available.

For a dependency advisory, open a private report if the vulnerable code is reachable from this app. Otherwise let Dependabot and the release process handle it.
