import { fetchWithTimeout } from './fetch.js'

export interface JupiterPriceData {
  price: number
  confidenceLevel: 'high' | 'medium' | 'low'
  lastSwappedPrice?: number
}

export async function fetchJupiterPrice(tokenAddress: string): Promise<JupiterPriceData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.jup.ag/price/v2?ids=${tokenAddress}&showExtraInfo=true`,
      5000
    )
    if (!res.ok) return null
    const data = await res.json() as any
    const entry = data?.data?.[tokenAddress]
    if (!entry) return null
    return {
      price: parseFloat(entry.price ?? '0'),
      confidenceLevel: entry.extraInfo?.confidenceLevel ?? 'low',
      lastSwappedPrice: entry.extraInfo?.lastSwappedPrice?.lastJupiterSellPrice
        ? parseFloat(entry.extraInfo.lastSwappedPrice.lastJupiterSellPrice)
        : undefined,
    }
  } catch {
    return null
  }
}
