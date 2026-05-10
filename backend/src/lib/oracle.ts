import { fetchTokenPairs, getBestPair } from './dexscreener.js'
import { fetchCoinGeckoByAddress } from './coingecko.js'
import { calculateIntelligence } from './intelligence.js'

export interface OracleResult {
  token: { address: string; name: string; symbol: string; priceUsd: string }
  coingeckoEnriched: boolean
  timestamp: string
  dataSource: 'DexScreener'
  [key: string]: unknown
}

export async function buildOracleResult(token: string): Promise<OracleResult | null> {
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
