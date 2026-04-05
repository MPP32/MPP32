# Roadmap

This document outlines what we're building next. Items move from planned → in progress → shipped as development advances. We update this regularly — watch the repo or follow [@MPP32_](https://x.com/MPP32_) on X for announcements.

---

## Now — Q2 2026

These are actively being worked on or in final testing.

- [ ] **Solana mainnet launch** — Full public availability of the paid intelligence endpoint with live MPP session billing
- [ ] **Streaming responses** — WebSocket support for real-time oracle updates as on-chain data changes
- [ ] **Batch query endpoint** — Accept up to 20 token addresses in a single call, priced per token
- [ ] **Wallet-level intelligence** — Query a wallet address and receive a breakdown of its holdings, PnL, and behavioral pattern classification
- [ ] **Alert subscriptions** — Subscribe to a token and receive a webhook ping when alpha score or rug risk crosses a defined threshold

---

## Next — Q3 2026

Planned and scoped. Subject to reprioritization based on community feedback.

- [ ] **TypeScript SDK** — A typed `mpp32` client library (npm) that wraps the API, handles session management, and exports all Zod schemas
- [ ] **Python SDK** — Same as above for Python environments and AI agent pipelines
- [ ] **On-chain verification** — Publish a Solana program that logs query hashes on-chain, providing a trustless audit trail for intelligence results
- [ ] **Ecosystem analytics dashboard** — Public leaderboard showing top-queried tokens, most active ecosystem services, and aggregated platform stats
- [ ] **AI agent presets** — Pre-built prompt templates and tool definitions for plugging MPP32 into Claude, GPT-4, and AutoGPT-style agent workflows
- [ ] **Historical snapshots** — Query a token's intelligence profile at a past timestamp (7d, 30d lookback)
- [ ] **Multi-DEX aggregation** — Expand pair coverage beyond Raydium to include Orca, Meteora, and Phoenix

---

## Later — Q4 2026 and beyond

On the radar. Not yet scoped.

- [ ] **MPP32 mobile app** — iOS and Android companion for running queries, monitoring watched tokens, and managing your ecosystem service
- [ ] **Multi-chain expansion** — Bring the oracle to Ethereum, Base, and other EVM chains with the same MPP payment model
- [ ] **Embedded widgets** — Drop-in React and iframe components for adding live token intelligence to any third-party site
- [ ] **Signal marketplace** — Let builders publish custom scoring signals (e.g. "social sentiment overlay", "dev activity score") that anyone can add on top of base oracle results
- [ ] **Enterprise tier** — Dedicated endpoints, SLA guarantees, and volume pricing for high-frequency institutional callers
- [ ] **Governance** — Community input on oracle model updates, ecosystem listing standards, and fee structure

---

## Shipped

- [x] Oracle — 8-dimensional Solana token intelligence via HTTP (v0.1.0 → v1.0.0)
- [x] Demo endpoint — Free, rate-limited access to full response shape
- [x] Playground — Browser-based query terminal at mpp32.org/playground
- [x] Dashboard — Query history, average alpha score, API configuration
- [x] Ecosystem directory — Public listing and filtering of community MPP services
- [x] Builder platform — Register any endpoint and monetize it with zero infrastructure changes
- [x] Hosted proxy — MPP payment gating for existing APIs without code changes
- [x] Use cases — Six detailed personas (retail trader, speed trader, sniper bot, AI agent, portfolio monitor, DeFi dev)
- [x] Docs — Full API reference, architecture overview, quickstart guide

---

## How to influence the roadmap

Open an issue tagged `roadmap` describing your use case and what you'd need built to support it. Community votes (👍 reactions) on existing issues factor into prioritization.

We're particularly interested in feedback from:
- **AI agent developers** building autonomous trading or research bots
- **DeFi protocol teams** looking to embed intelligence into their products
- **Data providers** who want to monetize their data via the ecosystem

Reach us at contact@mpp32.org or [@MPP32_](https://x.com/MPP32_) on X.
