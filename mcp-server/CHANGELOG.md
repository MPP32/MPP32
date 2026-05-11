# Changelog

All notable changes to `mpp32-mcp-server` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.4] - 2026-05-11

### Fixed

* **Self-payment now fails fast with a useful error.** When the wallet
  derived from `MPP32_SOLANA_PRIVATE_KEY` (or `MPP32_PRIVATE_KEY`) is the
  same address as a challenge's `payTo`, the signer used to construct the
  transaction anyway and the facilitator surfaced an opaque "transaction
  failed simulation" error a few seconds later. Both the SVM and EVM
  signers now detect this case before signing and return:
  `Refusing to sign an x402 payment to yourself: the wallet derived from
  MPP32_SOLANA_PRIVATE_KEY (<addr>) is also the payment recipient (payTo)
  for this service.` This happens most often when an operator uses their
  own receiving wallet to test a paid endpoint they themselves run.

## [1.2.3] - 2026-05-11

### Fixed

* **Solana-only users were being pushed to EVM and failing.** When a third-
  party x402 v2 challenge advertised both an EVM and an SVM entry in
  `accepts[]`, 1.2.2's `pickRequirements` preferred EVM unconditionally —
  so a user who had only set `MPP32_SOLANA_PRIVATE_KEY` got a "no EVM key
  set" error instead of a successful Solana payment. The picker now:
  - Honors `MPP32_PREFERRED_NETWORK` if set (accepts `solana`, `base`,
    `evm`, `ethereum`, or a full CAIP-2 like `solana:5eykt...`).
  - Otherwise, if only one key is configured, prefers that network.
  - Otherwise, when both keys are configured, prefers EVM (Base settles
    faster and is the dominant chain across providers).
  - Otherwise falls back to the first `accepts[]` entry so the per-network
    signer can surface a precise "you need MPP32_X_PRIVATE_KEY" error.

### Added

* **`MPP32_PREFERRED_NETWORK` env var.** Explicit override for the network
  picker. Useful when both keys are configured but the user wants every
  payment to go through one specific chain.
* **`debug_mpp32` tool (alias of `get_mpp32_diagnostics`).** Several
  external docs and skills already reference this name; the alias keeps
  them working without a documentation churn.

### Changed

* **`get_mpp32_diagnostics` now probes the API live.** In addition to
  reporting which env vars the process loaded, it issues a 5-second
  `GET /api/agent/protocols` against the configured `MPP32_API_URL` and
  reports `OK / Reachable but {status} / UNREACHABLE: {reason}`. Adds a
  single `Ready to pay end-to-end: YES/NO` line so users do not need to
  cross-reference three separate fields to know whether payments will
  work. Windows-specific guidance (no surrounding quotes inside the JSON
  string) is now called out explicitly — this tripped multiple users in
  1.2.1/1.2.2.

## [1.2.2] - 2026-05-11

### Fixed

* **x402 v2 envelope (the whole third-party catalog).** Every third-party
  x402 provider we tested — Venice (`api.venice.ai`), Exa (`api.exa.ai`),
  Firecrawl, OpenAI's x402 gateway, etc. — ships the **v2** challenge
  shape: `{x402Version: 2, accepts: [{scheme, network, asset, payTo,
  amount, ...}, ...]}`. 1.2.0 and 1.2.1 only understood **v1**
  (`{scheme, network, asset, payTo, maxAmountRequired, ...}` at the top
  level), so every third-party call failed with "missing network field"
  before we ever signed anything. The signer now:
  - Detects v1 vs v2 by the presence of `accepts: [...]`.
  - Picks the first `accepts[]` entry it can pay (prefers EVM when
    `MPP32_PRIVATE_KEY` is set, falls back to SVM when only the Solana
    key is set, falls back to the first entry so the per-network error
    surfaces precisely).
  - Maps v2's `amount` to v1's `maxAmountRequired` internally, so the
    same signing code handles both.
  - Echoes the challenge's `x402Version` back in the outgoing envelope
    so servers that key off it (Venice's facilitator does) accept the
    response. v1 challenges still get v1 back; v2 challenges get v2.
  This unblocks paid access to the entire ~4,500-entry federated
  catalog, which is overwhelmingly v2.

## [1.2.1] - 2026-05-11

### Fixed

* **"Server disconnected" on startup under Claude Desktop's bundled Node.**
  1.2.0 imported `@solana/kit` (and `@solana-program/*`) at the top of the
  payment-signer module. Those packages declare `engines.node: ">=20.18.0"`
  and use Node-20-only WebCrypto Ed25519 APIs at load time. Claude Desktop
  ships a bundled Node that on many installs is still 18.x, so the import
  threw before the MCP server could answer the initialize handshake — the
  process exited and Claude Desktop reported only "Server disconnected"
  with no further diagnostics. All Solana and EVM crypto deps are now
  loaded lazily inside the signer functions. The server boots on any Node
  that supports MCP; only a `solana:*` payment attempt fails on too-old
  Node, and now with a clear actionable error.

## [1.2.0] - 2026-05-11

This release makes x402 payments actually work end-to-end. Prior versions
shipped a non-spec-compliant signing path that the official x402.org
facilitator rejected with HTTP 400 on every paid call, so no settlement ever
occurred. The signing path has been rewritten from scratch against the
[Coinbase x402 reference implementation](https://github.com/coinbase/x402).

### Fixed (the headline)

* **Real Solana x402 payments.** When a server returns a `Payment-Required`
  challenge on a `solana:*` network, the MCP client now builds a real Solana
  `VersionedTransaction` with the three instructions the `exact` SVM scheme
  requires — `SetComputeUnitLimit`, `SetComputeUnitPrice`, and SPL-Token
  `TransferChecked` between the payer's and recipient's Associated Token
  Accounts. The transaction is partially signed by the payer (the fee-payer
  slot is left empty for the facilitator to fill at `/settle` time, per spec)
  and base64-encoded into the `payload.transaction` field. The official
  `x402.org/facilitator` now accepts and settles these payments.

* **Real EVM x402 payments on Base.** For challenges with `network: "base"`
  or `network: "base-sepolia"` (and the `eip155:*` aliases), the client now
  signs an EIP-3009 `transferWithAuthorization` typed-data message using
  `viem` and the EVM private key in `MPP32_PRIVATE_KEY`. This unblocks the
  ~85% of the federated catalog (~3,900 of 4,581 entries) that lives on
  Base — Exa Search, Firecrawl, OpenAI's x402 gateway, Anthropic's,
  Alchemy RPC, CoinGecko Pro, Nansen, Cloudflare Workers AI, and the rest.

### Added

* **`path` argument to `call_mpp32_endpoint`.** Many curated catalog
  entries store only an upstream base URL (e.g. `https://api.exa.ai`). Pass
  the upstream path (e.g. `/search`) via the new `path` parameter to hit a
  real endpoint instead of `POST /` (which returned 404). The agent server
  forwards the path and appends it safely to the catalog base URL.

* **`MPP32_SOLANA_RPC_URL` env var.** Override the Solana RPC used to fetch
  recent blockhashes when building x402 transactions. Defaults to
  `https://api.mainnet-beta.solana.com`. Set this if you hit public-endpoint
  rate limits.

* **`@solana/kit`, `@solana-program/token`, `@solana-program/compute-budget`,
  `viem` as real dependencies.** Tree-shakeable, no `rpc-websockets`
  transitive dependency, and no ESM/CJS landmines on Node 20+. `viem` was
  previously an optional peer; it is now required because the EVM x402
  signer cannot work without it.

### Migration

* No config changes required if you only use the Solana intelligence oracle
  (it still uses `MPP32_SOLANA_PRIVATE_KEY`). To pay for Base-network
  services like Exa Search, set `MPP32_PRIVATE_KEY` to your EVM private key
  and ensure that wallet holds USDC on Base.

## [1.1.4] - 2026-05-11

### Added

* **`get_mpp32_diagnostics` MCP tool.** Reports server version, API URL,
  and per-variable detection state for `MPP32_AGENT_KEY`,
  `MPP32_SOLANA_PRIVATE_KEY`, and `MPP32_PRIVATE_KEY` — without ever
  echoing the secret. The single most common payment failure has been
  "I set the key but the MCP server doesn't see it" (wrong
  `claude_desktop_config.json` file, `env` block at the wrong level in
  the JSON, typo, or stale process from an incomplete restart). This
  tool turns that into a one-call diagnosis.
* **Per-variable startup banner lines.** The stderr banner now prints
  one `[mpp32] MPP32_X: SET (fingerprint) / NOT SET` line per managed
  env var, so users who can find their MCP log file can see the same
  diagnosis without calling a tool.

## [1.1.3] - 2026-05-11

### Fixed

* **x402 payments actually work now.** `completeX402Payment` previously
  dynamically imported `@solana/web3.js`, `bs58`, and `tweetnacl`, but
  none of those packages were declared in `dependencies`. On a clean
  `npx mpp32-mcp-server` install they were missing from `node_modules`,
  the import threw, the catch block returned a misleading "check wallet
  balance" message, and Claude paraphrased that as "no funded Solana
  wallet configured" even when `MPP32_SOLANA_PRIVATE_KEY` was set.
* **Dropped `@solana/web3.js` entirely.** Adding it to `dependencies`
  uncovered a second, deeper bug: its transitive `rpc-websockets`
  bundle is CJS and `require()`s a now ESM-only `uuid`, which throws
  `ERR_REQUIRE_ESM` on Node 20+ the first time the signer loads. We
  only ever used `Keypair.fromSecretKey` and `publicKey.toBase58()`,
  both of which are trivial Ed25519/base58 operations. Signing is now
  done directly with `tweetnacl` + `bs58`, so the failure mode is gone
  and the install footprint is ~30 MB smaller.
* **Properly declared signing dependencies.** `bs58` and `tweetnacl`
  are now real `dependencies` rather than implicit assumptions.
* **Better error when a payment dependency genuinely fails to load.**
  The catch around each dynamic import now tells the user the package
  ships with `mpp32-mcp-server` and directs them to upgrade to
  `@latest` instead of suggesting a manual `npm install` that won't
  stick across `npx` runs.
* **32-byte seed Solana keys now accepted** in addition to 64-byte
  expanded keys (previously `Keypair.fromSecretKey` rejected seeds).

### Added

* **Catalog total surfaced in `list_mpp32_services`.** The federated
  catalog has 4,500+ external services but the API returns at most 500
  per call (default 100). The response now includes
  `data.totalAvailable` and a `truncated`/`hint` pair so the model
  knows results were paginated and how to drill in with `q`,
  `category`, `source`, or `protocol`. The MCP client formats the
  header as `Found N services (of M total available in catalog)` and
  prints the hint when applicable.

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
