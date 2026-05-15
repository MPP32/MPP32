import { Hono } from 'hono'
import { z } from 'zod'
import { requireM32, M32_EXCLUSIVE_APIS } from '../lib/m32-gate.js'
import { rateLimit, logger } from '../lib/mpp.js'
import { fetchTokenPairs, getBestPair, type DexPair } from '../lib/dexscreener.js'
import { buildOracleResult, type OracleResult } from '../lib/oracle.js'
import { env } from '../env.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LargestAccountEntry {
  address: string
  amount: string
  decimals: number
  uiAmount: number
  uiAmountString: string
}

interface TokenSupplyValue {
  amount: string
  decimals: number
  uiAmount: number
  uiAmountString: string
}

interface ParsedTokenAccountInfo {
  mint: string
  owner: string
  tokenAmount: {
    amount: string
    decimals: number
    uiAmount: number
    uiAmountString: string
  }
}

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const WhaleTrackerInput = z.object({
  token: z.string().min(1).max(100).describe('Solana token address or ticker symbol'),
})

const CompareInput = z.object({
  tokenA: z.string().min(1).max(100).describe('First Solana token address or ticker'),
  tokenB: z.string().min(1).max(100).describe('Second Solana token address or ticker'),
})

const PortfolioInput = z.object({
  wallet: z
    .string()
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Must be a valid Solana wallet address'),
})

// ---------------------------------------------------------------------------
// Solana RPC helpers
// ---------------------------------------------------------------------------

async function rpcCall<T>(method: string, params: unknown[], timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(env.SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: { value?: T }; error?: unknown }
    return data.result?.value ?? null
  } catch (err) {
    logger.warn('Solana RPC call failed', { method, error: String(err) })
    return null
  }
}

// ---------------------------------------------------------------------------
// Whale Tracker helpers
// ---------------------------------------------------------------------------

function calculateConcentration(holders: { balance: number; percentOfSupply: number }[]) {
  const sorted = [...holders].sort((a, b) => b.percentOfSupply - a.percentOfSupply)
  const top1 = sorted[0]?.percentOfSupply ?? 0
  const top5 = sorted.slice(0, 5).reduce((sum, h) => sum + h.percentOfSupply, 0)
  const top10 = sorted.slice(0, 10).reduce((sum, h) => sum + h.percentOfSupply, 0)
  const top20 = sorted.reduce((sum, h) => sum + h.percentOfSupply, 0)

  // Gini-like coefficient: higher = more concentrated
  let risk: 'low' | 'moderate' | 'high' | 'extreme' = 'low'
  if (top5 > 80) risk = 'extreme'
  else if (top5 > 60) risk = 'high'
  else if (top5 > 40) risk = 'moderate'

  return {
    top1Percent: Math.round(top1 * 100) / 100,
    top5Percent: Math.round(top5 * 100) / 100,
    top10Percent: Math.round(top10 * 100) / 100,
    top20Percent: Math.round(top20 * 100) / 100,
    concentrationRisk: risk,
  }
}

function analyzeActivity(pair: DexPair) {
  const m5 = pair.txns?.m5 ?? { buys: 0, sells: 0 }
  const h1 = pair.txns?.h1 ?? { buys: 0, sells: 0 }
  const h6 = pair.txns?.h6 ?? { buys: 0, sells: 0 }
  const h24 = pair.txns?.h24 ?? { buys: 0, sells: 0 }

  const buyPressure = (buys: number, sells: number) => {
    const total = buys + sells
    return total > 0 ? Math.round((buys / total) * 10000) / 100 : 50
  }

  const vol1h = pair.volume?.h1 ?? 0
  const vol24h = pair.volume?.h24 ?? 0
  const expectedHourly = vol24h / 24

  // Volume spike: 1h volume > 2x expected hourly average
  const volumeSpike = expectedHourly > 0 && vol1h > expectedHourly * 2

  // Net flow: based on 1h buy/sell ratio
  const total1h = h1.buys + h1.sells
  const buyRatio1h = total1h > 0 ? h1.buys / total1h : 0.5
  let netFlow: 'accumulating' | 'distributing' | 'neutral' = 'neutral'
  if (buyRatio1h > 0.6) netFlow = 'accumulating'
  else if (buyRatio1h < 0.4) netFlow = 'distributing'

  return {
    buyPressure5m: buyPressure(m5.buys, m5.sells),
    buyPressure1h: buyPressure(h1.buys, h1.sells),
    buyPressure24h: buyPressure(h24.buys, h24.sells),
    volumeSpike,
    netFlow,
    recentBuys: h1.buys,
    recentSells: h1.sells,
  }
}

function detectWhaleSignals(
  pair: DexPair,
  concentration: ReturnType<typeof calculateConcentration>,
  activity: ReturnType<typeof analyzeActivity>,
): string[] {
  const signals: string[] = []

  if (concentration.concentrationRisk === 'extreme')
    signals.push('EXTREME concentration: Top 5 holders control >80% of supply')
  else if (concentration.concentrationRisk === 'high')
    signals.push('HIGH concentration: Top 5 holders control >60% of supply')

  if (concentration.top1Percent > 30)
    signals.push(`Single wallet holds ${concentration.top1Percent.toFixed(1)}% of supply`)

  if (activity.volumeSpike) signals.push('Volume spike detected: 1h volume >2x average hourly')

  if (activity.netFlow === 'accumulating' && activity.buyPressure1h > 65)
    signals.push('Whale accumulation pattern: strong buy pressure with high concentration')

  if (activity.netFlow === 'distributing' && activity.buyPressure1h < 35)
    signals.push('Potential whale distribution: sell pressure with concentrated holdings')

  const vol1h = pair.volume?.h1 ?? 0
  const liq = pair.liquidity?.usd ?? 0
  if (liq > 0 && vol1h / liq > 1)
    signals.push('Volume-to-liquidity ratio >1x: large-account-driven trading')

  if (activity.buyPressure5m > 75 && activity.recentBuys > 5)
    signals.push('5-minute buy pressure spike: possible whale entry')

  if (signals.length === 0) signals.push('No significant whale signals at this time')

  return signals
}

function calculateWhaleScore(
  concentration: ReturnType<typeof calculateConcentration>,
  activity: ReturnType<typeof analyzeActivity>,
  signals: string[],
): number {
  let score = 50

  // Concentration factor (up to +/- 20)
  if (concentration.concentrationRisk === 'extreme') score += 20
  else if (concentration.concentrationRisk === 'high') score += 10
  else if (concentration.concentrationRisk === 'moderate') score += 5
  else score -= 5

  // Activity factor (up to +/- 15)
  if (activity.volumeSpike) score += 10
  if (activity.netFlow === 'accumulating') score += 5
  else if (activity.netFlow === 'distributing') score -= 5

  // Buy pressure (up to +/- 10)
  score += Math.round((activity.buyPressure1h - 50) * 0.2)

  // Signal count factor
  const meaningfulSignals = signals.filter(
    (s) => !s.startsWith('No significant'),
  ).length
  score += meaningfulSignals * 3

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ---------------------------------------------------------------------------
// Compare helpers
// ---------------------------------------------------------------------------

type ComparisonWinner = 'A' | 'B' | 'tie'

interface MetricComparison {
  winner: ComparisonWinner
  aValue: number
  bValue: number
}

function compareMetric(
  aVal: number,
  bVal: number,
  higherWins = true,
): MetricComparison {
  const diff = Math.abs(aVal - bVal)
  // Treat as tie if very close (within 1% of the larger value)
  const threshold = Math.max(aVal, bVal) * 0.01
  if (diff <= threshold) return { winner: 'tie', aValue: aVal, bValue: bVal }
  if (higherWins) {
    return { winner: aVal > bVal ? 'A' : 'B', aValue: aVal, bValue: bVal }
  }
  return { winner: aVal < bVal ? 'A' : 'B', aValue: aVal, bValue: bVal }
}

function buildVerdict(comparison: Record<string, MetricComparison>, oA: OracleResult, oB: OracleResult) {
  let aWins = 0
  let bWins = 0
  for (const m of Object.values(comparison)) {
    if (m.winner === 'A') aWins++
    else if (m.winner === 'B') bWins++
  }

  const total = aWins + bWins
  const winner: ComparisonWinner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie'
  const score = `${aWins}-${bWins}`
  const symbolA = oA.token.symbol
  const symbolB = oB.token.symbol

  let summary: string
  if (winner === 'tie') {
    summary = `${symbolA} and ${symbolB} are closely matched across key metrics with a ${score} score. Neither token holds a decisive edge.`
  } else {
    const winSymbol = winner === 'A' ? symbolA : symbolB
    const loseSymbol = winner === 'A' ? symbolB : symbolA
    summary = `${winSymbol} outperforms ${loseSymbol} with a ${score} score across ${total} key metrics. `
    if (winner === 'A') {
      summary += `${symbolA} shows stronger fundamentals with an alpha score of ${(oA as any).alphaScore ?? 'N/A'} vs ${(oB as any).alphaScore ?? 'N/A'}.`
    } else {
      summary += `${symbolB} shows stronger fundamentals with an alpha score of ${(oB as any).alphaScore ?? 'N/A'} vs ${(oA as any).alphaScore ?? 'N/A'}.`
    }
  }

  return { winner, score, summary }
}

// ---------------------------------------------------------------------------
// Known stablecoin mints (excluded from portfolio scan)
// ---------------------------------------------------------------------------

const STABLECOIN_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
])

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const m32Router = new Hono()

// Global rate limit for all M32 APIs
m32Router.use('*', rateLimit({ name: 'm32-apis', max: 60, windowMs: 60_000 }))

// GET /info -- list all M32-exclusive APIs and their requirements
m32Router.get('/info', (c) => {
  return c.json({
    data: {
      apis: M32_EXCLUSIVE_APIS,
      token: {
        symbol: 'M32',
        mint: env.M32_TOKEN_MINT,
        dexScreenerUrl:
          'https://dexscreener.com/solana/5hcopuqeoyairegeqvm9hdkgxyhwute8d1vhahvcltxs',
        buyUrl:
          'https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump',
      },
    },
  })
})

// =========================================================================
// 1. POST /whale-tracker  (requires 1M M32)
// =========================================================================

m32Router.post(
  '/whale-tracker',
  requireM32(1_000_000, 'Whale Tracker'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = WhaleTrackerInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: 'Invalid input. Provide { "token": "<solana token address or ticker>" }',
            code: 'VALIDATION_ERROR',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      )
    }

    const { token } = parsed.data

    try {
      // Fetch DexScreener pairs and pick the best
      const pairs = await fetchTokenPairs(token)
      const pair = getBestPair(pairs)
      if (!pair) {
        return c.json(
          {
            error: {
              message: `No trading pairs found for "${token}". Ensure you are providing a valid Solana token address or ticker.`,
              code: 'TOKEN_NOT_FOUND',
            },
          },
          404,
        )
      }

      const tokenMintAddress = pair.baseToken.address

      // Fetch top holders and total supply in parallel
      const [holdersResult, supplyResult] = await Promise.allSettled([
        rpcCall<LargestAccountEntry[]>('getTokenLargestAccounts', [tokenMintAddress], 8000),
        rpcCall<TokenSupplyValue>('getTokenSupply', [tokenMintAddress], 5000),
      ])

      const rawHolders =
        holdersResult.status === 'fulfilled' && holdersResult.value
          ? holdersResult.value
          : []
      const totalSupply =
        supplyResult.status === 'fulfilled' && supplyResult.value
          ? supplyResult.value.uiAmount
          : 0

      // Build top holders list
      const topHolders = rawHolders.map((h) => {
        const balance = h.uiAmount
        const percentOfSupply = totalSupply > 0 ? (balance / totalSupply) * 100 : 0
        return {
          address: h.address,
          balance,
          percentOfSupply: Math.round(percentOfSupply * 100) / 100,
        }
      })

      const concentration = calculateConcentration(topHolders)
      const activity = analyzeActivity(pair)
      const signals = detectWhaleSignals(pair, concentration, activity)
      const whaleScore = calculateWhaleScore(concentration, activity, signals)

      // Build summary
      const symbol = pair.baseToken.symbol
      const concWord =
        concentration.concentrationRisk === 'extreme'
          ? 'extremely concentrated'
          : concentration.concentrationRisk === 'high'
            ? 'highly concentrated'
            : concentration.concentrationRisk === 'moderate'
              ? 'moderately concentrated'
              : 'well-distributed'
      const flowWord =
        activity.netFlow === 'accumulating'
          ? 'accumulation'
          : activity.netFlow === 'distributing'
            ? 'distribution'
            : 'neutral flow'

      const summary = `${symbol} has a whale score of ${whaleScore}/100 with ${concWord} holdings (top 5 hold ${concentration.top5Percent.toFixed(1)}%). Current activity shows ${flowWord} with ${activity.buyPressure1h.toFixed(0)}% buy pressure over the last hour.`

      return c.json({
        data: {
          token: {
            address: pair.baseToken.address,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            priceUsd: pair.priceUsd,
          },
          topHolders,
          concentration,
          activity,
          signals,
          whaleScore,
          summary,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      logger.error('Whale tracker error', { token, error: String(err) })
      return c.json(
        {
          error: {
            message: 'Failed to analyze whale activity. Please try again.',
            code: 'WHALE_TRACKER_ERROR',
          },
        },
        502,
      )
    }
  },
)

// =========================================================================
// 2. POST /compare  (requires 2.5M M32)
// =========================================================================

m32Router.post(
  '/compare',
  requireM32(2_500_000, 'Token Comparison'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = CompareInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message:
              'Invalid input. Provide { "tokenA": "<address or ticker>", "tokenB": "<address or ticker>" }',
            code: 'VALIDATION_ERROR',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      )
    }

    const { tokenA, tokenB } = parsed.data

    try {
      const [resultA, resultB] = await Promise.allSettled([
        Promise.race([
          buildOracleResult(tokenA),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Oracle timeout')), 10_000),
          ),
        ]),
        Promise.race([
          buildOracleResult(tokenB),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Oracle timeout')), 10_000),
          ),
        ]),
      ])

      const oracleA =
        resultA.status === 'fulfilled' ? resultA.value : null
      const oracleB =
        resultB.status === 'fulfilled' ? resultB.value : null

      if (!oracleA && !oracleB) {
        return c.json(
          {
            error: {
              message: `No data found for either token. tokenA="${tokenA}", tokenB="${tokenB}"`,
              code: 'TOKENS_NOT_FOUND',
            },
          },
          404,
        )
      }
      if (!oracleA) {
        return c.json(
          {
            error: {
              message: `No data found for tokenA="${tokenA}". Ensure it is a valid Solana token.`,
              code: 'TOKEN_A_NOT_FOUND',
            },
          },
          404,
        )
      }
      if (!oracleB) {
        return c.json(
          {
            error: {
              message: `No data found for tokenB="${tokenB}". Ensure it is a valid Solana token.`,
              code: 'TOKEN_B_NOT_FOUND',
            },
          },
          404,
        )
      }

      // Extract comparable numeric values
      const aAlpha = (oracleA as any).alphaScore ?? 0
      const bAlpha = (oracleB as any).alphaScore ?? 0
      const aRug = (oracleA as any).rugRisk?.score ?? 0
      const bRug = (oracleB as any).rugRisk?.score ?? 0
      const aVol = (oracleA as any).marketData?.volume24h ?? 0
      const bVol = (oracleB as any).marketData?.volume24h ?? 0
      const aLiq = (oracleA as any).marketData?.liquidity ?? 0
      const bLiq = (oracleB as any).marketData?.liquidity ?? 0
      const aPump = (oracleA as any).pumpProbability24h ?? 0
      const bPump = (oracleB as any).pumpProbability24h ?? 0

      // Buy pressure from whale activity dominance score
      const aBuy = (oracleA as any).whaleActivity?.dominanceScore ?? 50
      const bBuy = (oracleB as any).whaleActivity?.dominanceScore ?? 50

      const comparison = {
        alphaScore: compareMetric(aAlpha, bAlpha, true),
        rugRisk: compareMetric(aRug, bRug, false), // lower rug risk wins
        volume24h: compareMetric(aVol, bVol, true),
        liquidity: compareMetric(aLiq, bLiq, true),
        pumpProbability: compareMetric(aPump, bPump, true),
        buyPressure: compareMetric(aBuy, bBuy, true),
      }

      const verdict = buildVerdict(comparison, oracleA, oracleB)

      return c.json({
        data: {
          tokenA: oracleA,
          tokenB: oracleB,
          comparison,
          verdict,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      logger.error('Token comparison error', { tokenA, tokenB, error: String(err) })
      return c.json(
        {
          error: {
            message: 'Failed to compare tokens. Please try again.',
            code: 'COMPARE_ERROR',
          },
        },
        502,
      )
    }
  },
)

// =========================================================================
// 3. POST /portfolio  (requires 5M M32)
// =========================================================================

m32Router.post(
  '/portfolio',
  requireM32(5_000_000, 'Portfolio Scanner'),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = PortfolioInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message:
              'Invalid input. Provide { "wallet": "<solana wallet address>" }',
            code: 'VALIDATION_ERROR',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      )
    }

    const { wallet } = parsed.data

    try {
      // Fetch all SPL token accounts for the wallet
      const rpcRes = await fetch(env.SOLANA_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            wallet,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!rpcRes.ok) {
        return c.json(
          {
            error: {
              message: 'Failed to fetch wallet token accounts from Solana RPC.',
              code: 'RPC_ERROR',
            },
          },
          502,
        )
      }

      const rpcData = (await rpcRes.json()) as {
        result?: {
          value?: Array<{
            account: {
              data: {
                parsed: {
                  info: ParsedTokenAccountInfo
                }
              }
            }
          }>
        }
        error?: { message: string }
      }

      if (rpcData.error) {
        return c.json(
          {
            error: {
              message: `Solana RPC error: ${rpcData.error.message}`,
              code: 'RPC_ERROR',
            },
          },
          502,
        )
      }

      const accounts = rpcData.result?.value ?? []

      // Extract mint + balance, filter zero balances and stablecoins
      const tokenAccounts = accounts
        .map((a) => {
          const info = a.account.data.parsed.info
          return {
            mint: info.mint,
            balance: info.tokenAmount.uiAmount,
          }
        })
        .filter((t) => t.balance > 0 && !STABLECOIN_MINTS.has(t.mint))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10) // Cap at 10 to avoid overloading

      const totalTokens = tokenAccounts.length

      if (totalTokens === 0) {
        return c.json({
          data: {
            wallet,
            totalTokens: 0,
            analyzedTokens: 0,
            holdings: [],
            portfolio: {
              estimatedTotalValueUsd: 0,
              avgAlphaScore: 0,
              avgRugRisk: 0,
              riskLevel: 'low' as const,
              highestRiskToken: null,
              bestAlphaToken: null,
              diversificationScore: 0,
            },
            summary: 'No non-stablecoin SPL tokens found in this wallet.',
            timestamp: new Date().toISOString(),
          },
        })
      }

      // Run buildOracleResult on each token in parallel with individual timeouts
      const oraclePromises = tokenAccounts.map(async (t) => {
        try {
          const result = await Promise.race([
            buildOracleResult(t.mint),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
          ])
          return { mint: t.mint, balance: t.balance, oracle: result }
        } catch (err) {
          logger.warn('Portfolio oracle call failed', { mint: t.mint, error: String(err) })
          return { mint: t.mint, balance: t.balance, oracle: null }
        }
      })

      const oracleResults = await Promise.allSettled(oraclePromises)

      const holdings: Array<{
        mint: string
        symbol: string
        name: string
        balance: number
        estimatedValueUsd: number | null
        alphaScore: number
        rugRisk: { score: number; level: string }
        whaleActivity: string
        pumpProbability24h: number
      }> = []

      let totalValueUsd = 0
      let alphaSum = 0
      let rugSum = 0
      let analyzedCount = 0
      let highestRisk: { symbol: string; rugScore: number } | null = null
      let bestAlpha: { symbol: string; alphaScore: number } | null = null
      let meaningfulValueCount = 0

      for (const settled of oracleResults) {
        if (settled.status !== 'fulfilled') continue
        const { mint, balance, oracle } = settled.value

        if (!oracle) {
          // Token could not be analyzed -- include it with defaults
          holdings.push({
            mint,
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            balance,
            estimatedValueUsd: null,
            alphaScore: 0,
            rugRisk: { score: 0, level: 'unknown' },
            whaleActivity: 'unknown',
            pumpProbability24h: 0,
          })
          continue
        }

        analyzedCount++
        const priceUsd = parseFloat(oracle.token.priceUsd || '0')
        const estimatedValue = priceUsd > 0 ? priceUsd * balance : null
        if (estimatedValue !== null) {
          totalValueUsd += estimatedValue
          if (estimatedValue > 1) meaningfulValueCount++
        }

        const alpha = (oracle as any).alphaScore ?? 0
        const rug = (oracle as any).rugRisk ?? { score: 0, level: 'unknown' }
        const whale = (oracle as any).whaleActivity?.level ?? 'unknown'
        const pump = (oracle as any).pumpProbability24h ?? 0

        alphaSum += alpha
        rugSum += rug.score

        if (!highestRisk || rug.score > highestRisk.rugScore) {
          highestRisk = { symbol: oracle.token.symbol, rugScore: rug.score }
        }
        if (!bestAlpha || alpha > bestAlpha.alphaScore) {
          bestAlpha = { symbol: oracle.token.symbol, alphaScore: alpha }
        }

        holdings.push({
          mint,
          symbol: oracle.token.symbol,
          name: oracle.token.name,
          balance,
          estimatedValueUsd: estimatedValue !== null ? Math.round(estimatedValue * 100) / 100 : null,
          alphaScore: alpha,
          rugRisk: { score: rug.score, level: rug.level },
          whaleActivity: whale,
          pumpProbability24h: pump,
        })
      }

      // Sort holdings by estimated value descending (nulls last)
      holdings.sort((a, b) => {
        const va = a.estimatedValueUsd ?? -1
        const vb = b.estimatedValueUsd ?? -1
        return vb - va
      })

      const avgAlpha = analyzedCount > 0 ? Math.round((alphaSum / analyzedCount) * 10) / 10 : 0
      const avgRug = analyzedCount > 0 ? Math.round((rugSum / analyzedCount) * 10) / 10 : 0

      let riskLevel: 'low' | 'moderate' | 'high' | 'critical' = 'low'
      if (avgRug > 7) riskLevel = 'critical'
      else if (avgRug > 5) riskLevel = 'high'
      else if (avgRug > 3) riskLevel = 'moderate'

      // Diversification score 1-10 based on count of tokens with meaningful value (>$1)
      const diversificationScore = Math.max(1, Math.min(10, meaningfulValueCount))

      const totalValueStr =
        totalValueUsd >= 1_000_000
          ? `$${(totalValueUsd / 1_000_000).toFixed(2)}M`
          : totalValueUsd >= 1_000
            ? `$${(totalValueUsd / 1_000).toFixed(1)}K`
            : `$${totalValueUsd.toFixed(2)}`

      const summary = `Portfolio analysis for ${wallet.slice(0, 4)}...${wallet.slice(-4)}: ${totalTokens} tokens found, ${analyzedCount} analyzed. Estimated total value: ${totalValueStr}. Average alpha score: ${avgAlpha}/100, average rug risk: ${avgRug}/10 (${riskLevel}). Diversification score: ${diversificationScore}/10.`

      return c.json({
        data: {
          wallet,
          totalTokens,
          analyzedTokens: analyzedCount,
          holdings,
          portfolio: {
            estimatedTotalValueUsd: Math.round(totalValueUsd * 100) / 100,
            avgAlphaScore: avgAlpha,
            avgRugRisk: avgRug,
            riskLevel,
            highestRiskToken: highestRisk,
            bestAlphaToken: bestAlpha,
            diversificationScore,
          },
          summary,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      logger.error('Portfolio scanner error', { wallet, error: String(err) })
      return c.json(
        {
          error: {
            message: 'Failed to scan portfolio. Please try again.',
            code: 'PORTFOLIO_ERROR',
          },
        },
        502,
      )
    }
  },
)

export { m32Router }
