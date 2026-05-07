import { fetchWithTimeout } from './fetch.js'

export interface CoinGeckoData {
  name: string
  symbol: string
  priceUsd: number
  volume24h: number
  marketCap: number
  priceChange1h: number | null
  priceChange24h: number | null
  priceChange7d: number | null
  twitterFollowers: number | null
  coingeckoScore: number | null
}

export async function fetchCoinGeckoByAddress(tokenAddress: string): Promise<CoinGeckoData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/coins/solana/contract/${tokenAddress}`,
      7000,
    )
    if (!res.ok) return null
    const d = await res.json() as any
    const md = d?.market_data ?? {}
    return {
      name: d.name ?? '',
      symbol: (d.symbol ?? '').toUpperCase(),
      priceUsd: md.current_price?.usd ?? 0,
      volume24h: md.total_volume?.usd ?? 0,
      marketCap: md.market_cap?.usd ?? 0,
      priceChange1h: md.price_change_percentage_1h_in_currency?.usd ?? null,
      priceChange24h: md.price_change_percentage_24h ?? null,
      priceChange7d: md.price_change_percentage_7d ?? null,
      twitterFollowers: d.community_data?.twitter_followers ?? null,
      coingeckoScore: d.coingecko_score ?? null,
    }
  } catch {
    return null
  }
}
