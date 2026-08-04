# Security Policy — `mpp32-mcp-server`

## Reporting a vulnerability

Report security issues privately to **`security@mpp32.org`**.

Include:

- A description of the issue, including the affected version of
  `mpp32-mcp-server`.
- Steps to reproduce, or a minimal proof of concept.
- The Node.js version, OS, and MCP host (Claude Desktop, Cursor,
  Windsurf, …) you tested against.
- Your name or handle if you'd like credit in the fix release.

We aim to acknowledge reports within **3 business days** and provide a
remediation timeline within **10 business days**. Please do not file public
GitHub issues for security vulnerabilities until a fix has shipped.

## Supported versions

| Version  | Supported  |
|:---------|:-----------|
| `1.7.x`  | ✅ current  |
| `1.6.x`  | High-severity only |
| `< 1.6`  | ❌          |

## What this package does at runtime

Understanding the package's behavior is the first step in any audit. The
MCP server is a stdio process. It:

1. **Reads three environment variables** for authentication and signing:
   `MPP32_AGENT_KEY`, `MPP32_PRIVATE_KEY` (EVM), and
   `MPP32_SOLANA_PRIVATE_KEY`. Values are never logged, transmitted as
   plaintext to third parties, or written to disk. See
   `src/index.ts` for the exact validation rules.
2. **Makes outbound HTTPS requests** to a small, fixed set of hosts
   needed to discover services and settle x402 payments. The complete
   egress allow-list is documented in [`docs/EGRESS.md`](../docs/EGRESS.md).
3. **Signs Solana and EVM payment payloads locally** using
   `@solana/kit` (WebCrypto Ed25519) and `viem` (secp256k1) inside the
   user's Node process. Private keys never leave the machine.

There is no install script, no native code, no filesystem write, no
shell execution, and no dynamic `require`/`eval` in this package.

## Provenance

Starting with `1.7.0`, npm releases are published from a GitHub Actions
workflow using OIDC and include an [npm provenance attestation][prov]
linking the published tarball to the exact commit and workflow run that
produced it. Verify with:

```sh
npm audit signatures
```

[prov]: https://docs.npmjs.com/generating-provenance-statements

## Hardening already in place (backend)

The MCP server depends on a backend at `mpp32.org` for the federated
catalog and `/api/agent/execute`. Backend-side hardening is documented
in the [root SECURITY.md](../SECURITY.md):

- Production refuses to boot when `MPP_SECRET_KEY` is missing or matches
  a committed default.
- All outbound URLs from user submissions and agent execute calls run
  through an SSRF guard.
- Agent session API keys are hashed at rest with SHA-256.

## Disclosure

We follow coordinated disclosure. Reporters who act in good faith and
follow this policy will not be subject to legal action for their
research.
