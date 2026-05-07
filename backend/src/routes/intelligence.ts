import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { dualProtocolChargeWithDiscount } from '../lib/mpp.js'
import { fetchTokenPairs, getBestPair } from '../lib/dexscreener.js'
import { fetchCoinGeckoByAddress } from '../lib/coingecko.js'
import { calculateIntelligence } from '../lib/intelligence.js'
import { IntelligenceRequestSchema } from '../types.js'
import { env } from '../env.js'
import { logger, rateLimit } from '../lib/mpp.js'

const intelligence = new Hono()

async function buildResult(token: string) {
  const pairs = await fetchTokenPairs(token)
  const pair = getBestPair(pairs)
  if (!pair) return null

  const [cgResult] = await Promise.allSettled([
    fetchCoinGeckoByAddress(pair.baseToken.address),
  ])
  const cg = cgResult.status === 'fulfilled' ? cgResult.value : null

  const intelligenceData = calculateIntelligence(pair, cg)

  return {
    token: {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      priceUsd: cg?.priceUsd ? String(cg.priceUsd) : pair.priceUsd,
    },
    ...intelligenceData,
    coingeckoEnriched: cg !== null,
    timestamp: new Date().toISOString(),
    dataSource: 'DexScreener' as const,
  }
}

intelligence.post(
  '/',
  dualProtocolChargeWithDiscount(env.MPP_PRICE),
  zValidator('json', IntelligenceRequestSchema),
  async (c) => {
    const { token } = c.req.valid('json')
    const requestId = c.get('requestId') ?? 'unknown'
    try {
      const result = await buildResult(token)
      if (!result) return c.json({ error: { message: `No Solana trading pairs found for "${token}"`, code: 'TOKEN_NOT_FOUND' } }, 404)
      return c.json({ data: result })
    } catch (err) {
      logger.error('Intelligence query failed', { requestId, token, error: String(err) })
      return c.json({ error: { message: 'Failed to fetch token data', code: 'DATA_FETCH_ERROR' } }, 502)
    }
  },
)

intelligence.post(
  '/demo',
  rateLimit({ name: 'intelligence-demo', max: 10, windowMs: 60_000 }),
  zValidator('json', IntelligenceRequestSchema),
  async (c) => {
    const { token } = c.req.valid('json')
    const requestId = c.get('requestId') ?? 'unknown'
    try {
      const result = await buildResult(token)
      if (!result) return c.json({ error: { message: `No Solana trading pairs found for "${token}"`, code: 'TOKEN_NOT_FOUND' } }, 404)
      return c.json({ data: result })
    } catch (err) {
      logger.error('Intelligence demo query failed', { requestId, token, error: String(err) })
      return c.json({ error: { message: 'Failed to fetch token data', code: 'DATA_FETCH_ERROR' } }, 502)
    }
  }
)

export default intelligence
