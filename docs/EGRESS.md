# Egress allow-list — `mpp32-mcp-server`

This document lists every outbound network destination the
`mpp32-mcp-server` npm package opens during normal operation. It exists so
operators, auditors, and Socket.dev reviewers can verify the package's
network behavior against a known list.

The MCP server makes no other outbound calls. It does not phone home for
telemetry, does not check for updates, and does not load remote code at
runtime.

## Allowed hosts

| Host                                  | Why we call it                                                 | Triggered by                                       |
|:--------------------------------------|:---------------------------------------------------------------|:---------------------------------------------------|
| `mpp32.org` (`MPP32_API_URL` default) | Federated catalog, agent execute, intelligence oracle, SIWS    | Almost every tool call                             |
| `pivx.org` (via backend proxy)        | PIVX DAO proposal HTML — scraped by **backend** at `/api/governance`, never by the MCP client. The MCP only ever talks to `MPP32_API_URL`. | `get_pivx_dao_intelligence` |
| `chainz.cryptoid.info` (via backend)  | PIVX chain stats — scraped by **backend** at `/api/governance`, never by the MCP client.                    | `get_pivx_dao_intelligence` |
| `api.mainnet-beta.solana.com`         | Solana RPC `getLatestBlockhash` for x402 SVM signing. Override with the `MPP32_SOLANA_RPC` arg.            | Any paid SVM call                                   |
| `mainnet.base.org`, `sepolia.base.org`, `eth.llamarpc.com` | EVM chain RPC endpoints used by `viem` for EIP-3009 signing. | Any paid EVM call                                   |
| `facilitator.payai.network` (resolved server-side) | x402 facilitator endpoint advertised by the backend. The MCP forwards the challenge but does not call the facilitator directly. | Indirect, server-resolved      |

## Configuration

- `MPP32_API_URL` — override the MPP32 backend host (defaults to
  `https://mpp32.org`). All MPP32-routed traffic respects this.
- `MPP32_TIMEOUT_MS` — request timeout for every outbound call
  (default `30000`, range `1000`–`300000`).
- `MPP32_SOLANA_RPC` (per-call argument) — override the Solana RPC
  endpoint used during x402-SVM signing.

## What's NOT in the package

- ❌ No analytics or telemetry endpoint.
- ❌ No package-registry "check for updates" call.
- ❌ No filesystem writes outside of `console.error` to stderr.
- ❌ No child processes spawned by `mpp32-mcp-server`'s own code.
- ❌ No native (`*.node`) binary loaded.
- ❌ No remote code (`new Function`, `eval`, dynamic `require` of URLs).
