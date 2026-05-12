import { Hono } from 'hono'
import { prisma } from '../lib/db.js'
import { rateLimit } from '../lib/mpp.js'
import { runCrawler, runAllCrawlers, listCrawlers } from '../lib/catalog/runner.js'
import { calculateDiscount } from '../lib/solana-token.js'
import { getM32Balance } from '../lib/solana-token.js'
import { normalizeChain, chainDisplayName, isTestnet, type Chain } from '../lib/catalog/chain.js'

const catalogRouter = new Hono()

catalogRouter.use('*', rateLimit({ name: 'catalog', max: 120, windowMs: 60_000 }))

function parseJSON<T>(v: string | null): T | null {
  if (!v) return null
  try { return JSON.parse(v) as T } catch { return null }
}

function serializeService(s: any, discountPercent = 0) {
  const protocols = parseJSON<string[]>(s.protocols) ?? [s.protocol]
  const tags = parseJSON<string[]>(s.tags) ?? []
  const metadata = parseJSON<Record<string, unknown>>(s.metadata) ?? null
  const base = s.pricePerQuery ?? null
  const effective = base !== null && discountPercent > 0
    ? Number((base * (1 - discountPercent / 100)).toFixed(6))
    : base
  const chain = normalizeChain(s.network)
  return {
    id: s.id,
    slug: s.slug,
    source: s.source,
    name: s.name,
    description: s.description,
    category: s.category,
    endpointUrl: s.endpointUrl,
    websiteUrl: s.websiteUrl,
    protocol: s.protocol,
    protocols,
    network: s.network,
    chain,
    chainLabel: chainDisplayName(chain),
    testnet: isTestnet(chain),
    asset: s.asset,
    payTo: s.payTo,
    basePrice: base,
    effectivePrice: effective,
    priceCurrency: s.priceCurrency,
    scheme: s.scheme,
    tags,
    metadata,
    iconUrl: s.iconUrl,
    popularity: s.popularity,
    verified: s.verified,
    healthStatus: s.healthStatus ?? 'unknown',
    healthCheckedAt: s.healthCheckedAt?.toISOString?.() ?? s.healthCheckedAt ?? null,
    healthError: s.healthError ?? null,
    providerFeePayer: s.providerFeePayer ?? null,
    lastSeenAt: s.lastSeenAt?.toISOString?.() ?? s.lastSeenAt,
  }
}

// Map a requested chain key to the raw `network` values stored in the DB.
// Used for filtering — the DB has both CAIP-2 and short-name variants.
async function rawNetworksForChain(chain: Chain): Promise<string[]> {
  const rows = await prisma.externalService.findMany({
    where: { active: true },
    distinct: ['network'],
    select: { network: true },
  })
  return rows
    .map((r) => r.network)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .filter((n) => normalizeChain(n) === chain)
}

// GET /api/catalog — paginated browse with filters
catalogRouter.get('/', async (c) => {
  const protocol = c.req.query('protocol')
  const category = c.req.query('category')
  const source = c.req.query('source')
  const networkRaw = c.req.query('network')?.trim()
  const chainParam = c.req.query('chain')?.trim().toLowerCase() as Chain | undefined
  const q = c.req.query('q')?.trim()
  const wallet = c.req.query('wallet')
  // `health` filter:
  //   working (default) — challenge_valid or payment_verified
  //   any               — show everything including unknown
  //   broken            — only failing listings
  //   unchecked         — only services we haven't health-checked yet
  const health = (c.req.query('health') ?? 'working').toLowerCase()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0)

  const where: any = { active: true }
  if (protocol) where.protocol = protocol
  if (category) where.category = category
  if (source) where.source = source
  if (networkRaw) where.network = networkRaw
  if (health === 'working') {
    where.healthStatus = { in: ['challenge_valid', 'payment_verified', 'reachable'] }
  } else if (health === 'broken') {
    where.healthStatus = 'broken'
  } else if (health === 'unchecked') {
    where.healthStatus = 'unknown'
  }
  // health === 'any' applies no filter
  if (chainParam) {
    const networks = await rawNetworksForChain(chainParam)
    if (networks.length === 0) {
      // No matching networks — short-circuit to an empty result.
      return c.json({
        data: {
          services: [],
          total: 0,
          limit,
          offset,
          filters: { protocol, category, source, network: networkRaw, chain: chainParam, health, q },
          discountPercent: 0,
        },
      })
    }
    where.network = { in: networks }
  }
  if (q && q.length > 0) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { tags: { contains: q } },
      { category: { contains: q } },
    ]
  }

  let discountPercent = 0
  if (wallet) {
    const balance = await getM32Balance(wallet)
    const d = calculateDiscount(balance, '0.008')
    discountPercent = d.discountPercent
  }

  const [services, total] = await Promise.all([
    prisma.externalService.findMany({
      where,
      orderBy: [{ verified: 'desc' }, { popularity: 'desc' }, { name: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.externalService.count({ where }),
  ])

  return c.json({
    data: {
      services: services.map((s) => serializeService(s, discountPercent)),
      total,
      limit,
      offset,
      filters: { protocol, category, source, network: networkRaw, chain: chainParam, health, q },
      discountPercent,
    },
  })
})

// GET /api/catalog/stats — high-level catalog metrics
catalogRouter.get('/stats', async (c) => {
  const [total, byProtocol, byCategory, bySource, byNetwork, byHealthRaw, lastRuns] = await Promise.all([
    prisma.externalService.count({ where: { active: true } }),
    prisma.externalService.groupBy({
      by: ['protocol'],
      where: { active: true },
      _count: true,
    }),
    prisma.externalService.groupBy({
      by: ['category'],
      where: { active: true, category: { not: null } },
      _count: true,
    }),
    prisma.externalService.groupBy({
      by: ['source'],
      where: { active: true },
      _count: true,
    }),
    prisma.externalService.groupBy({
      by: ['network'],
      where: { active: true },
      _count: true,
    }),
    prisma.externalService.groupBy({
      by: ['healthStatus'],
      where: { active: true },
      _count: true,
    }),
    prisma.catalogCrawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ])

  // Roll raw networks up into normalized chain buckets so the UI can offer a
  // clean filter (Base / Solana / Stellar / …) instead of exposing the raw mix
  // of CAIP-2 strings and short names.
  const chainTotals = new Map<Chain, number>()
  for (const row of byNetwork) {
    const chain = normalizeChain(row.network)
    chainTotals.set(chain, (chainTotals.get(chain) ?? 0) + row._count)
  }
  const byChain = Array.from(chainTotals.entries())
    .map(([chain, count]) => ({
      chain,
      label: chainDisplayName(chain),
      testnet: isTestnet(chain),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return c.json({
    data: {
      total,
      byProtocol: byProtocol.map((p) => ({ protocol: p.protocol, count: p._count })),
      byCategory: byCategory.map((p) => ({ category: p.category, count: p._count })),
      bySource: bySource.map((p) => ({ source: p.source, count: p._count })),
      byChain,
      byHealth: byHealthRaw.map((h) => ({ status: h.healthStatus, count: h._count })),
      recentCrawls: lastRuns.map((r) => ({
        id: r.id,
        source: r.source,
        status: r.status,
        itemsFound: r.itemsFound,
        itemsAdded: r.itemsAdded,
        itemsUpdated: r.itemsUpdated,
        durationMs: r.durationMs,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
    },
  })
})

// GET /api/catalog/sources — list available crawler sources
catalogRouter.get('/sources', (c) => {
  return c.json({ data: { sources: listCrawlers() } })
})

// GET /api/catalog/:slug — single service detail
catalogRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const wallet = c.req.query('wallet')
  const service = await prisma.externalService.findUnique({ where: { slug } })
  if (!service) return c.json({ error: { message: 'Service not found', code: 'NOT_FOUND' } }, 404)

  let discountPercent = 0
  if (wallet) {
    const balance = await getM32Balance(wallet)
    const d = calculateDiscount(balance, '0.008')
    discountPercent = d.discountPercent
  }

  return c.json({ data: serializeService(service, discountPercent) })
})

// POST /api/catalog/refresh — trigger one or all crawlers (admin-ish, rate-limited)
catalogRouter.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const source = body?.source as string | undefined
  if (source) {
    const result = await runCrawler(source)
    return c.json({ data: result })
  }
  const results = await runAllCrawlers()
  return c.json({ data: { runs: results } })
})

export { catalogRouter }
