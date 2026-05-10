import { prisma } from '../db.js'
import type { Crawler, CatalogItem } from './types.js'
import { x402BazaarCrawler } from './crawlers/x402-bazaar.js'
import { mcpRegistryCrawler } from './crawlers/mcp-registry.js'
import { curatedSeedCrawler } from './crawlers/curated-seed.js'

const CRAWLERS: Crawler[] = [curatedSeedCrawler, x402BazaarCrawler, mcpRegistryCrawler]

function getCrawler(name: string): Crawler | undefined {
  return CRAWLERS.find((c) => c.source === name)
}

function serializeMaybe(v: unknown): string | null {
  if (v === undefined || v === null) return null
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

async function persistItem(source: string, item: CatalogItem): Promise<'added' | 'updated'> {
  const existing = await prisma.externalService.findUnique({
    where: { source_sourceId: { source, sourceId: item.sourceId } },
  })

  const data = {
    source,
    sourceId: item.sourceId,
    slug: item.slug,
    name: item.name,
    description: item.description ?? null,
    category: item.category ?? null,
    endpointUrl: item.endpointUrl ?? null,
    websiteUrl: item.websiteUrl ?? null,
    protocol: item.protocol,
    protocols: item.protocols ? JSON.stringify(item.protocols) : null,
    network: item.network ?? null,
    asset: item.asset ?? null,
    payTo: item.payTo ?? null,
    pricePerQuery: item.pricePerQuery ?? null,
    priceCurrency: item.priceCurrency ?? 'USD',
    scheme: item.scheme ?? null,
    tags: item.tags && item.tags.length ? JSON.stringify(item.tags) : null,
    metadata: serializeMaybe(item.metadata),
    iconUrl: item.iconUrl ?? null,
    popularity: item.popularity ?? 0,
    verified: item.verified ?? false,
    active: true,
    lastSeenAt: new Date(),
  }

  if (existing) {
    await prisma.externalService.update({
      where: { id: existing.id },
      data: { ...data, slug: existing.slug }, // preserve original slug to avoid uniqueness conflict
    })
    return 'updated'
  }

  // Avoid slug collision: append source-id hash if needed
  let slug = item.slug
  const slugHit = await prisma.externalService.findUnique({ where: { slug } })
  if (slugHit) {
    slug = `${item.slug}-${item.sourceId.slice(0, 8)}`
  }

  await prisma.externalService.create({ data: { ...data, slug } })
  return 'added'
}

export async function runCrawler(name: string): Promise<{
  source: string
  status: string
  itemsFound: number
  itemsAdded: number
  itemsUpdated: number
  durationMs: number
  errorMessage?: string
}> {
  const crawler = getCrawler(name)
  if (!crawler) {
    return {
      source: name,
      status: 'failed',
      itemsFound: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      durationMs: 0,
      errorMessage: `Unknown crawler: ${name}`,
    }
  }

  const run = await prisma.catalogCrawlRun.create({
    data: { source: name, status: 'running' },
  })

  const start = Date.now()
  let added = 0
  let updated = 0
  let result: Awaited<ReturnType<Crawler['run']>>

  try {
    result = await crawler.run()
    for (const item of result.items) {
      try {
        const r = await persistItem(name, item)
        if (r === 'added') added++
        else updated++
      } catch (err) {
        // Skip individual item failures so one bad row doesn't kill the whole crawl
        console.error(`[catalog] persist failed for ${item.slug}:`, err)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.catalogCrawlRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        errorMessage: msg,
        durationMs: Date.now() - start,
        finishedAt: new Date(),
      },
    })
    return {
      source: name,
      status: 'failed',
      itemsFound: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      durationMs: Date.now() - start,
      errorMessage: msg,
    }
  }

  const durationMs = Date.now() - start
  const status = result.errorMessage ? 'partial' : 'success'

  await prisma.catalogCrawlRun.update({
    where: { id: run.id },
    data: {
      status,
      itemsFound: result.items.length,
      itemsAdded: added,
      itemsUpdated: updated,
      durationMs,
      errorMessage: result.errorMessage ?? null,
      finishedAt: new Date(),
    },
  })

  return {
    source: name,
    status,
    itemsFound: result.items.length,
    itemsAdded: added,
    itemsUpdated: updated,
    durationMs,
    errorMessage: result.errorMessage,
  }
}

export async function runAllCrawlers() {
  const results = []
  for (const c of CRAWLERS) {
    results.push(await runCrawler(c.source))
  }
  return results
}

export function listCrawlers() {
  return CRAWLERS.map((c) => ({ source: c.source, description: c.description }))
}
