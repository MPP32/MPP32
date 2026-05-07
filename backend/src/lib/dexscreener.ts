import { fetchWithTimeout } from './fetch.js'

const BASE_URL = 'https://api.dexscreener.com'

export interface DexPair {
  chainId: string
  dexId: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceNative: string
  priceUsd: string
  volume: { h24: number; h6: number; h1: number; m5: number }
  priceChange: { h24: number; h6: number; h1: number; m5: number }
  txns: {
    h24: { buys: number; sells: number }
    h6: { buys: number; sells: number }
    h1: { buys: number; sells: number }
    m5: { buys: number; sells: number }
  }
  liquidity: { usd: number; base: number; quote: number }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: {
    websites?: { url: string }[]
    socials?: { type: string; url: string }[]
    imageUrl?: string
  }
  boosts?: { active?: number }
}

function isSolanaAddress(input: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)
}

export async function fetchTokenPairs(tokenInput: string): Promise<DexPair[]> {
  if (isSolanaAddress(tokenInput)) {
    // Direct address lookup using token-pairs/v1 (returns real-time volume)
    const res = await fetchWithTimeout(`${BASE_URL}/token-pairs/v1/solana/${tokenInput}`)
    if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`)
    const data = await res.json() as DexPair[] | { pairs?: DexPair[] }
    return Array.isArray(data) ? data : (data.pairs ?? [])
  } else {
    // Search by ticker/name → extract token address → use token-pairs/v1
    const res = await fetchWithTimeout(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(tokenInput)}`)
    if (!res.ok) throw new Error(`DexScreener search error: ${res.status}`)
    const data = await res.json() as { pairs?: DexPair[] }
    const solanaPairs = (data.pairs ?? []).filter((p: DexPair) => p.chainId === 'solana')
    if (solanaPairs.length === 0) return []

    // Filter to exact ticker matches, then pick by transaction count (real trading activity)
    const exactMatches = solanaPairs.filter((p: DexPair) =>
      p.baseToken.symbol.toUpperCase() === tokenInput.toUpperCase()
    )
    const searchPool = exactMatches.length > 0 ? exactMatches : solanaPairs
    const topPair = searchPool.reduce((best: DexPair, p: DexPair) => {
      const bTxns = (best.txns?.h24?.buys ?? 0) + (best.txns?.h24?.sells ?? 0)
      const pTxns = (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0)
      return pTxns > bTxns ? p : best
    })
    const tokenAddress = topPair.baseToken.address

    // Fetch fresh data from token-pairs/v1 with a shorter timeout; fall back to search results on failure
    try {
      const res2 = await fetchWithTimeout(`${BASE_URL}/token-pairs/v1/solana/${tokenAddress}`, 5000)
      if (!res2.ok) return solanaPairs
      const data2 = await res2.json() as DexPair[] | { pairs?: DexPair[] }
      const freshPairs = Array.isArray(data2) ? data2 : (data2.pairs ?? [])
      return freshPairs.length > 0 ? freshPairs : solanaPairs
    } catch {
      // Timeout or network error on secondary fetch — return search results immediately
      return solanaPairs
    }
  }
}

export function getBestPair(pairs: DexPair[]): DexPair | null {
  if (pairs.length === 0) return null
  // Score pairs by a blend of volume (primary) and liquidity (secondary)
  // This avoids picking dormant LP pools with high TVL but no trading activity
  const score = (p: DexPair) => {
    const vol = p.volume?.h24 ?? 0
    const liq = p.liquidity?.usd ?? 0
    const txns = (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0)
    return vol * 0.6 + liq * 0.3 + txns * 10
  }
  return pairs.reduce((best, pair) => score(pair) > score(best) ? pair : best)
}
