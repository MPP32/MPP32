# Security Policy

## Reporting a vulnerability

Please report security issues privately to **`security@mpp32.org`**.

Include:

- A description of the issue and the affected component (`backend`,
  `mcp-server`, `sdk`, or `webapp`).
- Steps to reproduce, or a minimal proof of concept.
- The version or commit SHA you tested against.
- Your name or handle if you'd like credit in the fix release.

We aim to acknowledge reports within **3 business days** and provide a
remediation timeline within **10 business days**. Please do not file public
GitHub issues for security vulnerabilities until a fix has shipped.

## Supported versions

| Component             | Supported version |
|:----------------------|:------------------|
| `mpp32-mcp-server`    | `1.7.x` (latest)  |
| Backend (`mpp32.org`) | Production rolling release |
| SDK                   | Current `main`    |

Older versions receive security fixes only for high-severity issues.

## Hardening already in place

- Production refuses to boot when `MPP_SECRET_KEY` is missing or matches a
  known committed default (see `backend/src/env.ts`).
- All outbound URLs from user submissions and agent execute calls run
  through an SSRF guard blocking private, loopback, link-local, IPv6
  unique-local, and cloud metadata ranges (`backend/src/lib/ssrf.ts`).
- Agent session API keys are hashed at rest with SHA-256.
- AGTP agent identity uses HMAC-SHA256 with a server-held salt so
  signatures cannot be forged from a public agent id.
- Recovery one-time codes refuse to issue in production when the email
  channel is not configured.
- Idempotency cache is bounded with LRU eviction; admin endpoints are
  rate-limited per IP on top of the secret check.

## Disclosure

We follow coordinated disclosure. Reporters who act in good faith and
follow this policy will not be subject to legal action for their research.
