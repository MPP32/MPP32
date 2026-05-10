import type { Crawler, CatalogItem, CrawlerResult } from '../types.js'

// Official Model Context Protocol Registry
// https://registry.modelcontextprotocol.io
// Response shape (2025-12+): { servers: [{ server: {...}, _meta: {...} }], metadata: { nextCursor } }
const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers'

interface MCPRegistryServerInner {
  name?: string
  title?: string
  description?: string
  version?: string
  repository?: { url?: string; source?: string; id?: string }
  packages?: Array<{
    registryName?: string
    registry_name?: string
    name?: string
    version?: string
    transport?: { type?: string }
  }>
  remotes?: Array<{ type?: string; transport_type?: string; url?: string }>
}

interface MCPRegistryEntry {
  server?: MCPRegistryServerInner
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status?: string
      isLatest?: boolean
      publishedAt?: string
      updatedAt?: string
    }
  }
}

interface MCPRegistryResponse {
  servers?: MCPRegistryEntry[]
  metadata?: { nextCursor?: string; next_cursor?: string; count?: number }
}

function slugifyServer(name: string): string {
  return `mcp-reg:${name}`
    .toLowerCase()
    .replace(/[^a-z0-9:._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

function categoryFor(s: MCPRegistryServerInner): string {
  const blob = `${s.name ?? ''} ${s.title ?? ''} ${s.description ?? ''}`.toLowerCase()
  if (/(crypto|web3|ethereum|solana|wallet|defi|chain|token)/.test(blob)) return 'crypto'
  if (/(search|crawl|scrape|web|browse|fetch)/.test(blob)) return 'web-search'
  if (/(image|vision|art|stable.?diffusion|flux|midjourney)/.test(blob)) return 'media'
  if (/(audio|speech|whisper|tts|voice)/.test(blob)) return 'media'
  if (/(database|sql|postgres|mysql|sqlite|mongo|redis)/.test(blob)) return 'data'
  if (/(github|gitlab|sentry|vercel|cloudflare|aws|gcp|deploy|docker|k8s)/.test(blob)) return 'devops'
  if (/(slack|discord|telegram|email|notion|linear|jira)/.test(blob)) return 'productivity'
  if (/(filesystem|file|fs|read|write)/.test(blob)) return 'mcp-tool'
  if (/(llm|chat|gpt|claude|anthropic|openai|inference)/.test(blob)) return 'ai-inference'
  return 'mcp-tool'
}

function endpointFor(s: MCPRegistryServerInner): string | null {
  const remote = s.remotes?.find((r) => r.url)
  if (remote?.url) return remote.url
  const pkg = s.packages?.[0]
  const reg = pkg?.registryName ?? pkg?.registry_name
  if (reg === 'npm' && pkg?.name) return `npx://${pkg.name}`
  if (reg === 'pypi' && pkg?.name) return `pypi://${pkg.name}`
  if (reg && pkg?.name) return `${reg}://${pkg.name}`
  return null
}

function transportFor(s: MCPRegistryServerInner): string {
  const r = s.remotes?.[0]
  if (r) return r.type ?? r.transport_type ?? 'remote'
  const pkg = s.packages?.[0]
  if (pkg?.transport?.type) return pkg.transport.type
  if (pkg?.registryName ?? pkg?.registry_name) return 'stdio'
  return 'unknown'
}

function displayName(s: MCPRegistryServerInner): string {
  const t = s.title?.trim()
  if (t) return t
  const last = s.name?.split('/').pop() ?? s.name ?? 'unnamed'
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const mcpRegistryCrawler: Crawler = {
  source: 'mcp-registry',
  description: 'Official Model Context Protocol Registry — registry.modelcontextprotocol.io',
  async run(): Promise<CrawlerResult> {
    const items: CatalogItem[] = []
    const seenNames = new Set<string>()
    let cursor: string | undefined
    let pages = 0
    const MAX_PAGES = 10
    const LIMIT = 100

    try {
      while (pages < MAX_PAGES) {
        const url = new URL(MCP_REGISTRY_URL)
        url.searchParams.set('limit', String(LIMIT))
        if (cursor) url.searchParams.set('cursor', cursor)

        const res = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          if (pages === 0) {
            return {
              source: 'mcp-registry',
              items: [],
              errorMessage: `MCP registry HTTP ${res.status}`,
            }
          }
          break
        }

        const data = (await res.json()) as MCPRegistryResponse
        const entries = data.servers ?? []
        if (entries.length === 0) break

        for (const entry of entries) {
          const meta = entry._meta?.['io.modelcontextprotocol.registry/official']
          // Skip non-latest versions and inactive servers
          if (meta?.isLatest === false) continue
          if (meta?.status && meta.status !== 'active') continue

          const s = entry.server
          if (!s?.name) continue
          if (seenNames.has(s.name)) continue
          seenNames.add(s.name)

          const endpoint = endpointFor(s)
          const transport = transportFor(s)
          const registry = s.packages?.[0]?.registryName ?? s.packages?.[0]?.registry_name

          items.push({
            sourceId: s.name,
            slug: slugifyServer(s.name),
            name: displayName(s),
            description: s.description ?? `MCP server: ${s.name}`,
            category: categoryFor(s),
            endpointUrl: endpoint,
            websiteUrl: s.repository?.url ?? null,
            protocol: 'mcp',
            protocols: ['mcp'],
            pricePerQuery: 0,
            priceCurrency: 'USD',
            tags: ['mcp', transport, ...(s.repository?.source === 'github' ? ['open-source'] : [])],
            metadata: {
              transport,
              version: s.version,
              registry,
              packageName: s.packages?.[0]?.name,
            },
            popularity: 50,
            verified: true,
          })
        }

        cursor = data.metadata?.nextCursor ?? data.metadata?.next_cursor
        if (!cursor) break
        pages++
      }

      return { source: 'mcp-registry', items }
    } catch (err) {
      return {
        source: 'mcp-registry',
        items,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    }
  },
}
