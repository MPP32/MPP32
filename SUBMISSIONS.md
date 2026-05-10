# MPP32 Directory Submissions — Copy-Paste Ready

Use this file to submit MPP32 to every major directory. Each section tells you exactly where to go and what to paste.

---

## TIER 1 — Do These First

---

### 1. Official MCP Registry

**What:** The canonical MCP server registry. Glama, PulseMCP, and GitHub all pull from this.

**Steps on your laptop (PowerShell):**

```powershell
npm install -g @anthropic-ai/mcp-publisher
mcp-publisher login
```

This opens a browser for GitHub OAuth. Log in with your MPP32 GitHub account.

Then create this file in your mcp-server folder as `server.json`:

```json
{
  "name": "mpp32-mcp-server",
  "namespace": "io.github.mpp32",
  "description": "Universal Payment Proxy for Machine-Payable APIs. Lets AI agents discover, pay for, and call APIs across 5 payment protocols (x402, Tempo, ACP, AP2, AGTP). One integration, instant settlement, no subscriptions.",
  "repository": {
    "url": "https://github.com/MPP32/MPP32",
    "source": "mcp-server"
  },
  "version_detail": {
    "version": "1.0.2"
  },
  "packages": [
    {
      "registry_name": "npm",
      "name": "mpp32-mcp-server",
      "version": "1.0.2"
    }
  ],
  "remotes": [
    {
      "transport_type": "stdio",
      "command": "npx",
      "args": ["mpp32-mcp-server"]
    }
  ]
}
```

Then run:

```powershell
cd path\to\mcp-server
mcp-publisher publish
```

---

### 2. Glama.ai

**URL:** https://glama.ai/mcp/servers/submit (or look for "Submit Server" button on https://glama.ai/mcp/servers)

**What to paste:**

- **GitHub Repository URL:** `https://github.com/MPP32/MPP32`
- **Subfolder (if asked):** `mcp-server`

That's it. Glama auto-indexes your tools, schemas, and README from the repo.

---

### 3. Smithery.ai

**Steps on your laptop (PowerShell):**

```powershell
npm install -g @anthropic-ai/smithery-cli
smithery auth login
smithery mcp publish https://github.com/MPP32/MPP32 -n mpp32/mpp32-mcp-server
```

If it asks for details, use:
- **Name:** mpp32-mcp-server
- **Description:** Universal Payment Proxy for Machine-Payable APIs. 5 payment protocols, instant settlement, no API keys needed.
- **Install command:** `npx mpp32-mcp-server`

---

### 4. mcp.so

**URL:** https://github.com/chatmcp/mcpso/issues/new

**Title:** `Add mpp32-mcp-server — Universal Payment Proxy for AI Agents`

**Body (copy this entire block):**

```
## Server Information

- **Name:** MPP32 MCP Server
- **npm package:** mpp32-mcp-server
- **GitHub:** https://github.com/MPP32/MPP32
- **Website:** https://mpp32.org
- **Install:** `npx mpp32-mcp-server`

## Description

MCP server that gives AI agents the ability to discover, pay for, and consume APIs autonomously. One integration handles payment negotiation across 5 protocols (x402/USDC on Solana, Tempo/pathUSD, ACP checkout sessions, AP2 verifiable credentials, AGTP signed agent identity). No subscriptions, no API keys, no accounts.

## Tools

1. **list_mpp32_services** — Browse all machine-payable APIs in the ecosystem with names, categories, pricing, and endpoints
2. **get_solana_token_intelligence** — Real-time Solana token analysis: alpha score, rug risk, whale activity, smart money signals, pump probability ($0.008/query)
3. **call_mpp32_endpoint** — Call any API in the ecosystem with automatic HTTP 402 payment flow handling

## Category

Finance / Crypto / Payments / Agent Commerce

## Connection

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "your-solana-private-key (optional, for paid services)"
      }
    }
  }
}
```
```

---

### 5. PulseMCP

**URL:** https://www.pulsemcp.com/use-cases/submit

**Fields:**

- **Server Name:** MPP32
- **URL/Package:** https://www.npmjs.com/package/mpp32-mcp-server
- **GitHub URL:** https://github.com/MPP32/MPP32
- **Website:** https://mpp32.org
- **Description:** MCP server for autonomous agent payments. Agents discover APIs, pay per query via 5 protocols (x402 USDC, Tempo pathUSD, ACP, AP2, AGTP), and get data back. No accounts, no subscriptions. Ships with a Solana token intelligence oracle.
- **Category:** Finance / Payments
- **Install:** `npx mpp32-mcp-server`

---

### 6. Coinbase x402 Bazaar / Agentic.Market

**URL:** https://github.com/x402-foundation/x402 (check for submission guidelines or open an issue)

**Issue title:** `List MPP32 Universal Payment Proxy in x402 ecosystem`

**Body:**

```
MPP32 is a universal payment proxy for machine-payable APIs that natively supports x402 (USDC on Solana).

- **Live endpoint:** https://mpp32.org/api/intelligence
- **Protocol:** x402 with on-chain Solana USDC verification
- **OpenAPI spec:** https://mpp32.org/openapi.json
- **MCP server:** `npx mpp32-mcp-server` (npm: mpp32-mcp-server)
- **Agent Card:** https://mpp32.org/.well-known/agent.json
- **Price:** $0.008/query for Solana token intelligence
- **Payment address:** 9Pa8yUe8k1aRAoS1J8T5d4Mc4zXH2QTKiHE7wibowt6S (Solana)

MPP32 returns HTTP 402 with challenge headers for all 5 supported protocols (x402, Tempo, ACP, AP2, AGTP) on every paid endpoint, allowing any x402-compliant agent to complete payment automatically.

GitHub: https://github.com/MPP32/MPP32
Website: https://mpp32.org
```

---

## TIER 2 — Do This Week

---

### 7. MCP.Directory

**URL:** https://mcp.directory/submit

**Fields:**
- **Name:** MPP32
- **GitHub URL:** https://github.com/MPP32/MPP32
- **npm:** mpp32-mcp-server
- **Website:** https://mpp32.org
- **Description:** Universal payment proxy for machine-payable APIs. 5 protocols, instant settlement, Solana token intelligence oracle included.

---

### 8. Cline MCP Marketplace

**URL:** https://github.com/cline/mcp-marketplace/issues/new

**Title:** `Add MPP32 — Universal Agent Payment Proxy`

**Body:**

```
## Server Details

- **Name:** MPP32 MCP Server
- **npm:** mpp32-mcp-server
- **GitHub:** https://github.com/MPP32/MPP32
- **Install:** `npx mpp32-mcp-server`

## Description

Gives AI agents the ability to discover, pay for, and call APIs. Handles HTTP 402 payment flows automatically across 5 protocols (x402, Tempo, ACP, AP2, AGTP).

## Tools Provided

- `list_mpp32_services` — Browse machine-payable API marketplace
- `get_solana_token_intelligence` — Real-time Solana token analysis
- `call_mpp32_endpoint` — Call any API with automatic payment

## Configuration

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "your-key (optional, for paid services)"
      }
    }
  }
}
```

## Logo

https://mpp32.org/logo-mpp32.jpg
```

---

### 9. MCPServers.org

**URL:** https://mcpservers.org/submit

**Fields:**
- **Name:** MPP32
- **Package:** mpp32-mcp-server
- **URL:** https://mpp32.org
- **GitHub:** https://github.com/MPP32/MPP32
- **Description:** Universal payment proxy for machine-payable APIs. Agents discover, pay, and call APIs across 5 payment protocols.
- **Category:** Finance / Payments / Crypto

---

### 10. LobeHub MCP Marketplace

**URL:** https://lobehub.com/mcp (look for "Submit MCP" button)

**Fields:**
- **Name:** mpp32-mcp-server
- **Description:** Universal Payment Proxy for Machine-Payable APIs. 5 payment protocols, instant settlement, Solana token intelligence.
- **GitHub:** https://github.com/MPP32/MPP32
- **npm:** mpp32-mcp-server

---

### 11. awesome-mcp-servers (3 repos — submit PRs)

For each repo, fork it, edit the README.md, and open a PR.

**Repos:**
1. https://github.com/punkpeye/awesome-mcp-servers
2. https://github.com/appcypher/awesome-mcp-servers
3. https://github.com/wong2/awesome-mcp-servers

**Find the "Finance" or "Payments" or "Crypto" section and add this line:**

```markdown
- [MPP32](https://github.com/MPP32/MPP32) — Universal payment proxy for machine-payable APIs. Agents discover, pay for, and call APIs across 5 protocols (x402, Tempo, ACP, AP2, AGTP). `npx mpp32-mcp-server`
```

**PR title:** `Add MPP32 — Universal Agent Payment Proxy`

**PR description:**

```
Adds MPP32, an MCP server that gives AI agents the ability to discover, pay for, and consume machine-payable APIs.

- npm: [mpp32-mcp-server](https://www.npmjs.com/package/mpp32-mcp-server)
- Website: [mpp32.org](https://mpp32.org)
- 3 tools: service discovery, Solana token intelligence, universal API proxy with automatic payment
- Supports 5 payment protocols: x402 (USDC/Solana), Tempo (pathUSD), ACP, AP2, AGTP
- MIT licensed
```

---

### 12. awesome-x402

**URL:** https://github.com/xpaysh/awesome-x402

**Fork, find the appropriate section (SDKs, Services, or MCP), and add:**

```markdown
- [MPP32](https://mpp32.org) — Universal payment proxy supporting x402 (USDC on Solana) alongside 4 other protocols. MCP server: `npx mpp32-mcp-server`. [GitHub](https://github.com/MPP32/MPP32)
```

**PR title:** `Add MPP32 — Multi-protocol payment proxy with x402 support`

---

### 13. Anthropic Plugin Directory

**URL:** https://clau.de/plugin-directory-submission (or https://platform.claude.com/plugins/submit)

**Fields:**
- **Name:** mpp32
- **Package:** mpp32-mcp-server
- **Description:** Universal payment proxy for machine-payable APIs. Agents discover, pay for, and call APIs across 5 payment protocols with automatic HTTP 402 handling.
- **GitHub:** https://github.com/MPP32/MPP32
- **Website:** https://mpp32.org
- **Install command:** `npx mpp32-mcp-server`

---

### 14. APIs.guru

**URL:** https://apis.guru/add-api

**Fields:**
- **API Definition URL:** `https://mpp32.org/openapi.json`

That's it. They auto-index from your OpenAPI spec.

---

## TIER 3 — Do This Month

---

### 15. GitHub Topics (do this right now, takes 30 seconds)

Go to https://github.com/MPP32/MPP32 → click the gear icon next to "About" → add these topics:

```
mcp, mcp-server, model-context-protocol, ai-agents, agent-payments, 
x402, micropayments, solana, usdc, crypto, defi, machine-payments, 
agent-commerce, tempo, acp, payment-proxy, http-402
```

---

### 16. Solana AI Agent Registry

Research the submission process at the Solana Foundation developer portal. MPP32 is Solana-native with x402 USDC payments — this is a strong fit.

---

### 17. Pay.sh Ecosystem

Launched May 6, 2026 by Solana Foundation + Google Cloud. Check https://pay.sh for listing/registration.

---

### 18. Fetch.ai Agentverse

**URL:** https://agentverse.ai

Requires wrapping MPP32 as a uAgent or registering via their API. Lower priority but gives access to ASI:One discovery.

---

## Quick Reference — What to Say Everywhere

**One-liner:** Universal payment proxy for machine-payable APIs. 5 protocols, instant settlement, no subscriptions.

**Two-liner:** MCP server that gives AI agents the ability to discover, pay for, and consume APIs autonomously. One integration handles x402, Tempo, ACP, AP2, and AGTP.

**Install:** `npx mpp32-mcp-server`

**Links:**
- Website: https://mpp32.org
- npm: https://www.npmjs.com/package/mpp32-mcp-server
- GitHub: https://github.com/MPP32/MPP32
- OpenAPI: https://mpp32.org/openapi.json
- Agent Card: https://mpp32.org/.well-known/agent.json
- MCP Config: https://mpp32.org/api/mcp-config
