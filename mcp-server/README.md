# mpp32-mcp-server

MCP (Model Context Protocol) server for **MPP32** — the machine-payable API platform. Lets AI agents discover and call paid APIs autonomously via the HTTP 402 payment flow.

## Quick Start

```bash
npx mpp32-mcp-server
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_PRIVATE_KEY": "your-tempo-private-key"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_PRIVATE_KEY": "your-tempo-private-key"
      }
    }
  }
}
```

## Tools

### `list_mpp32_services`

Browse the MPP32 ecosystem. Returns all available services with names, categories, prices, and proxy URLs.

| Parameter  | Type   | Required | Description                          |
| ---------- | ------ | -------- | ------------------------------------ |
| `category` | string | No       | Filter by category slug              |

### `call_mpp32_endpoint`

Call a machine-payable API. Handles the full HTTP 402 payment flow automatically — sends the request, receives the payment challenge, completes a Tempo micropayment in pathUSD, and retries with the receipt.

| Parameter | Type   | Required | Description                                  |
| --------- | ------ | -------- | -------------------------------------------- |
| `slug`    | string | Yes      | Service slug (use `list_mpp32_services` to find) |
| `method`  | string | No       | HTTP method (default: GET)                   |
| `body`    | string | No       | JSON request body                            |
| `query`   | object | No       | URL query parameters                         |

## Environment Variables

| Variable            | Required | Description                                                        |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `MPP32_PRIVATE_KEY` | Yes      | EVM private key for a wallet funded with pathUSD on Tempo          |
| `MPP32_API_URL`     | No       | Override API base URL (default: `https://api.mpp32.org`)           |

## How It Works

1. **Discovery** — `list_mpp32_services` calls the MPP32 submissions API to list all approved services
2. **Payment** — `call_mpp32_endpoint` makes a request to the MPP32 proxy, receives an HTTP 402 challenge, completes a Tempo on-chain micropayment, and retries with the signed receipt
3. **Response** — The upstream service response is returned to the agent

Payments settle on the **Tempo network** (Ethereum L2) in **pathUSD**, a USD-pegged stablecoin.

## License

MIT
