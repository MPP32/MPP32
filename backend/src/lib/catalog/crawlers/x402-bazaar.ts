import type { Crawler, CatalogItem, CrawlerResult, CatalogProtocol } from '../types.js'

const X402_BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources'

interface BazaarAccept {
  scheme?: string
  network?: string
  asset?: string
  payTo?: string
  maxAmountRequired?: string
  description?: string
  extra?: Record<string, unknown>
}

interface BazaarItem {
  resource: string
  type?: string
  accepts?: BazaarAccept[]
  lastUpdated?: number
  metadata?: Record<string, unknown>
}

interface BazaarResponse {
  x402Version?: number
  items?: BazaarItem[]
  pagination?: { limit: number; offset: number; total: number }
}

function inferCategory(item: BazaarItem): string {
  const m = item.metadata as Record<string, string> | undefined
  if (m?.category) return String(m.category)
  const name = String(m?.name ?? item.resource).toLowerCase()
  if (name.includes('token') || name.includes('crypto') || name.includes('coin')) return 'crypto'
  if (name.includes('search') || name.includes('crawl') || name.includes('scrape')) return 'web-search'
  if (name.includes('llm') || name.includes('chat') || name.includes('inference') || name.includes('ai')) return 'ai-inference'
  if (name.includes('weather')) return 'data'
  if (name.includes('image') || name.includes('vision')) return 'media'
  if (name.includes('audio') || name.includes('speech')) return 'media'
  return 'data'
}

function priceFromAccept(accept: BazaarAccept | undefined): { price: number | null; asset: string | null } {
  if (!accept) return { price: null, asset: null }
  const raw = accept.maxAmountRequired
  if (!raw) return { price: null, asset: accept.asset ?? null }
  const num = Number(raw)
  if (!Number.isFinite(num)) return { price: null, asset: accept.asset ?? null }
  // x402 amounts are typically in smallest unit (USDC = 6 decimals)
  const price = num / 1_000_000
  return { price: Number.isFinite(price) ? price : null, asset: accept.asset ?? null }
}

function slugifyResource(resource: string): string {
  return `x402:${resource}`
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

const GENERIC_PATH_SEGMENTS = new Set([
  'api', 'apis', 'v1', 'v2', 'v3', 'v4', 'proxy', 'public',
  'rest', 'graph', 'graphql', 'rpc', 'service', 'services', 'endpoint',
])

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 1 ? w[0]!.toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(' ')
}

function cleanSegment(seg: string): string {
  return seg
    .replace(/-[a-f0-9]{4,12}$/i, '')   // strip hash suffix like "-184d0b"
    .replace(/[-_]+/g, ' ')
    .trim()
}

// Extract a meaningful display name from the resource URL.
// Falls back to hostname only if no useful path information exists.
// e.g. https://orbisapi.com/proxy/imdb-movie-tv-data-api-184d0b/details
//      → "Imdb Movie Tv Data Api · Details"
function extractDisplayName(resource: string, metadataName?: string): string {
  const m = metadataName?.trim()
  if (m && m.length > 1 && m.length < 140) return m

  try {
    const u = new URL(resource)
    const host = u.hostname.replace(/^www\./, '')
    const segments = u.pathname.split('/').filter(Boolean)
    const meaningful = segments.filter(
      (s) => !GENERIC_PATH_SEGMENTS.has(s.toLowerCase()) && s.length > 1,
    )

    if (meaningful.length === 0) return host

    const titled = meaningful
      .slice(0, 2)
      .map(cleanSegment)
      .filter((s) => s.length > 1)
      .map(titleCase)

    if (titled.length === 0) return host
    return titled.join(' · ')
  } catch {
    return resource.slice(0, 80)
  }
}

export const x402BazaarCrawler: Crawler = {
  source: 'x402-bazaar',
  description: 'Coinbase x402 Bazaar — global directory of x402-payable HTTP resources',
  async run(): Promise<CrawlerResult> {
    const items: CatalogItem[] = []
    let offset = 0
    const limit = 200
    const seen = new Set<string>()

    try {
      // Loop through pages until we exhaust or hit safety cap
      for (let page = 0; page < 20; page++) {
        const url = `${X402_BAZAAR_URL}?limit=${limit}&offset=${offset}`
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          if (offset === 0) {
            return { source: 'x402-bazaar', items: [], errorMessage: `Bazaar HTTP ${res.status}` }
          }
          break
        }

        const data = (await res.json()) as BazaarResponse
        const batch = data.items ?? []
        if (batch.length === 0) break

        for (const it of batch) {
          if (!it.resource) continue
          if (seen.has(it.resource)) continue
          seen.add(it.resource)

          const accept = it.accepts?.[0]
          const m = (it.metadata ?? {}) as Record<string, string>
          const { price, asset } = priceFromAccept(accept)

          const displayName = extractDisplayName(it.resource, m.name ? String(m.name) : undefined)

          const description = String(
            m.description ?? accept?.description ?? `x402 resource at ${it.resource}`,
          ).slice(0, 500)

          const protocols: CatalogProtocol[] = ['x402']
          if (it.type === 'http') protocols.push('http')

          items.push({
            sourceId: it.resource,
            slug: slugifyResource(it.resource),
            name: displayName,
            description,
            category: inferCategory(it),
            endpointUrl: it.resource,
            websiteUrl: m.documentationUrl ? String(m.documentationUrl) : null,
            protocol: 'x402',
            protocols,
            network: accept?.network ?? null,
            asset,
            payTo: accept?.payTo ?? null,
            pricePerQuery: price,
            priceCurrency: 'USD',
            scheme: accept?.scheme ?? 'exact',
            tags: m.tags ? String(m.tags).split(',').map((s) => s.trim()) : [],
            metadata: { type: it.type, lastUpdated: it.lastUpdated },
            iconUrl: m.icon ? String(m.icon) : null,
            popularity: 0,
            verified: true, // listed in canonical Bazaar
          })
        }

        const total = data.pagination?.total
        offset += batch.length
        if (typeof total === 'number' && offset >= total) break
        if (batch.length < limit) break
      }

      return { source: 'x402-bazaar', items }
    } catch (err) {
      return {
        source: 'x402-bazaar',
        items,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    }
  },
}
