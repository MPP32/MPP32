# Changelog

All notable changes to `mpp32-mcp-server` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-05-10

### Fixed

* **Configuration robustness.** Every environment variable is now trimmed,
  stripped of a leading byte-order mark, and unwrapped if the value was
  pasted with literal surrounding quotes. A trailing newline or stray
  whitespace in `MPP32_AGENT_KEY` used to make Node's HTTP client throw
  `ERR_INVALID_CHAR` on every catalog call. That failure mode is now
  impossible.
* **ASCII-only header guard.** Any non-ASCII byte in a value that would
  end up in an HTTP header is rejected at startup with a clear message
  pointing at the offending variable, instead of a low-level fetch error
  at call time.
* **Format validation.** `MPP32_AGENT_KEY` must look like
  `mpp32_agent_*`. `MPP32_PRIVATE_KEY` must be a 0x-prefixed 64-character
  EVM hex key. `MPP32_SOLANA_PRIVATE_KEY` is recognized as base58, hex,
  or a JSON byte-array. Malformed values warn at startup with the first
  hex bytes so invisible characters are easy to spot.
* **Case-insensitive payment challenge parsing.** `Payment-Required` and
  `payment-required` headers are now treated identically.
* **Liberal `WWW-Authenticate` parser.** Token regex broadened to RFC
  7235 token68 so valid challenges with `+`, `/`, `:`, and `,` no longer
  get silently dropped.
* **`walletAddress` sanitization.** The optional `walletAddress` argument
  to `get_solana_token_intelligence` is trimmed and ASCII-validated
  before going into the `X-Wallet-Address` header.

### Added

* **Request timeouts.** Every outbound fetch is wrapped with an
  `AbortController`. Default 30 seconds, configurable through
  `MPP32_TIMEOUT_MS` (1000-300000).
* **Startup banner.** The server prints the version, API base URL,
  configured keys, and timeout to stderr on start, so misconfigurations
  are visible without making a call.

### Internal

* `SERVER_VERSION` is now a single constant, so the protocol handshake,
  banner, and `package.json` cannot drift apart.

## [1.1.1] - 2026-05-09

### Added

* `mcpName` field added to `package.json` to satisfy the MCP registry
  publishing requirement.
* First registry listing under `io.github.MPP32/mpp32-mcp-server` at
  `registry.modelcontextprotocol.io`.

## [1.1.0] - 2026-05-09

### Added

* Three tools: `list_mpp32_services`, `call_mpp32_endpoint`,
  `get_solana_token_intelligence`.
* End to end support for five payment rails: x402, Tempo, ACP, AP2,
  AGTP. Server picks the rail the wallet is funded for and falls back
  if the first attempt does not settle.
* Federated catalog (native, curated free, x402 Bazaar, MCP registry).
* Automatic 402 sign-and-retry through `/api/agent/execute`.

## [1.0.0] - 2026-05-08

* Initial public release on npm.
