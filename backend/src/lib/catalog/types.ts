export type CatalogProtocol = 'tempo' | 'x402' | 'acp' | 'ap2' | 'agtp' | 'mcp' | 'http'

export interface CatalogItem {
  sourceId: string
  slug: string
  name: string
  description?: string | null
  category?: string | null
  endpointUrl?: string | null
  websiteUrl?: string | null
  protocol: CatalogProtocol
  protocols?: CatalogProtocol[]
  network?: string | null
  asset?: string | null
  payTo?: string | null
  pricePerQuery?: number | null
  priceCurrency?: string
  scheme?: string | null
  tags?: string[]
  metadata?: Record<string, unknown> | null
  iconUrl?: string | null
  popularity?: number
  verified?: boolean
}

export interface CrawlerResult {
  source: string
  items: CatalogItem[]
  errorMessage?: string
}

export interface Crawler {
  source: string
  description: string
  run(): Promise<CrawlerResult>
}
