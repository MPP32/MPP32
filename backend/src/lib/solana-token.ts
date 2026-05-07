import { env } from '../env.js'
import { logger } from './mpp.js'

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

const balanceCache = new Map<string, { balance: number; fetchedAt: number }>()
const CACHE_TTL_MS = 300_000

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of balanceCache) {
    if (now - entry.fetchedAt > CACHE_TTL_MS) balanceCache.delete(key)
  }
}, CACHE_TTL_MS)

export async function getM32Balance(walletAddress: string): Promise<number> {
  if (!SOLANA_ADDRESS_RE.test(walletAddress)) return 0

  const cached = balanceCache.get(walletAddress)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.balance

  try {
    const res = await fetch(env.SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: env.M32_TOKEN_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      logger.warn('Solana RPC error', { status: res.status, wallet: walletAddress })
      return 0
    }

    const data = await res.json() as {
      result?: {
        value?: Array<{
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: { uiAmount: number; decimals: number }
                }
              }
            }
          }
        }>
      }
    }

    const accounts = data.result?.value ?? []
    const first = accounts[0]
    const balance = first
      ? first.account.data.parsed.info.tokenAmount.uiAmount
      : 0

    balanceCache.set(walletAddress, { balance, fetchedAt: Date.now() })
    return balance
  } catch (err) {
    logger.warn('M32 balance check failed', { wallet: walletAddress, error: String(err) })
    return 0
  }
}

export interface DiscountResult {
  originalPrice: string
  discountedPrice: string
  discountPercent: number
  tier: 'none' | 'holder_250k' | 'holder_1m'
}

export function calculateDiscount(balance: number, basePrice: string): DiscountResult {
  const price = parseFloat(basePrice)
  if (balance >= 1_000_000) {
    return { originalPrice: basePrice, discountedPrice: (price * 0.6).toFixed(4), discountPercent: 40, tier: 'holder_1m' }
  }
  if (balance >= 250_000) {
    return { originalPrice: basePrice, discountedPrice: (price * 0.8).toFixed(4), discountPercent: 20, tier: 'holder_250k' }
  }
  return { originalPrice: basePrice, discountedPrice: basePrice, discountPercent: 0, tier: 'none' }
}
