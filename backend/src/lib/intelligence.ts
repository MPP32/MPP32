import type { DexPair } from './dexscreener.js'
import type { CoinGeckoData } from './coingecko.js'
import type { IntelligenceResponse } from '../types.js'

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function formatAge(createdAt: number): string {
  const ageMs = Date.now() - createdAt
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  if (days < 1) return `${Math.floor(ageMs / (1000 * 60 * 60))}h`
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

export function calculateIntelligence(
  pair: DexPair,
  cg: CoinGeckoData | null = null,
): Omit<IntelligenceResponse, 'token' | 'timestamp' | 'dataSource'> {
  // Prefer CoinGecko's global volume; fall back to DexScreener single-pair volume
  const vol24h = cg?.volume24h && cg.volume24h > 0 ? cg.volume24h : (pair.volume?.h24 ?? 0)
  const vol6h = pair.volume?.h6 ?? 0
  const vol1h = pair.volume?.h1 ?? 0
  const vol5m = pair.volume?.m5 ?? 0
  const liquidity = pair.liquidity?.usd ?? 0
  const txns24h = pair.txns?.h24 ?? { buys: 0, sells: 0 }
  const txns1h = pair.txns?.h1 ?? { buys: 0, sells: 0 }
  const txns5m = pair.txns?.m5 ?? { buys: 0, sells: 0 }
  // Prefer CoinGecko for price changes (more accurate, global data)
  const priceChange24h = cg?.priceChange24h ?? pair.priceChange?.h24 ?? 0
  const priceChange1h = cg?.priceChange1h ?? pair.priceChange?.h1 ?? 0
  const priceChange6h = pair.priceChange?.h6 ?? 0
  const priceChange7d = cg?.priceChange7d ?? null
  const marketCap = cg?.marketCap ?? pair.marketCap ?? pair.fdv ?? 0
  void vol6h

  // --- Alpha Intelligence Score (0-100) ---
  let alphaScore = 50 // baseline

  // Volume momentum (max 20 pts): is recent volume accelerating?
  const expectedHourlyVol = vol24h / 24
  const volMomentum = expectedHourlyVol > 0 ? vol1h / expectedHourlyVol : 1
  alphaScore += clamp((volMomentum - 1) * 10, -20, 20)

  // Buy pressure (max 15 pts)
  const totalTxns1h = txns1h.buys + txns1h.sells
  const buyRatio1h = totalTxns1h > 0 ? txns1h.buys / totalTxns1h : 0.5
  alphaScore += clamp((buyRatio1h - 0.5) * 30, -15, 15)

  // Price momentum (max 15 pts)
  const priceMomentum = (priceChange1h * 3 + priceChange6h) / 4
  alphaScore += clamp(priceMomentum * 0.5, -15, 15)

  // Liquidity score (max 10 pts): log scale, 100k USD = 5pts, 1M = 8pts
  const liqScore = liquidity > 0 ? Math.min(10, Math.log10(liquidity) - 3) : -5
  alphaScore += clamp(liqScore, -5, 10)

  // Social presence (max 5 pts)
  const hasWebsite = (pair.info?.websites?.length ?? 0) > 0
  const hasSocials = (pair.info?.socials?.length ?? 0) > 0
  if (hasWebsite) alphaScore += 2
  if (hasSocials) alphaScore += 3

  // Pair age bonus/penalty
  const ageMs = Date.now() - (pair.pairCreatedAt ?? Date.now())
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < 1) alphaScore -= 10 // brand new = risky
  else if (ageDays > 30) alphaScore += 5 // established = safer

  alphaScore = Math.round(clamp(alphaScore, 0, 100))

  // --- Risk-Reward Ratio ---
  const upside = Math.max(0, priceMomentum * 3 + volMomentum * 5)
  const downside = Math.max(1, 10 - (liquidity > 1_000_000 ? 5 : liquidity > 100_000 ? 3 : 0))
  const rrRaw = (upside + 1) / downside
  const riskRewardRatio = `${clamp(rrRaw, 0.1, 20).toFixed(1)}:1`

  // --- Smart Money Signals ---
  const smartMoneySignals: string[] = []
  if (vol5m > vol1h / 12) smartMoneySignals.push('Volume spike detected in last 5 minutes')
  if (buyRatio1h > 0.65) smartMoneySignals.push('Strong buy-side dominance (>65% buy txns)')
  if (volMomentum > 2) smartMoneySignals.push('Volume 2x+ above 24h average')
  if (priceChange1h > 5) smartMoneySignals.push('Momentum breakout detected (1h price surge)')
  if (liquidity > 1_000_000 && priceChange1h > 2) smartMoneySignals.push('High-liquidity accumulation pattern')
  if (txns5m.buys > txns5m.sells * 1.5) smartMoneySignals.push('Recent 5m candle: 1.5x buy/sell imbalance')
  if (pair.boosts?.active) smartMoneySignals.push('Active boost/promotion detected on DexScreener')
  if (smartMoneySignals.length === 0) {
    if (buyRatio1h > 0.5) smartMoneySignals.push('Mild buy-side pressure present')
    else smartMoneySignals.push('No significant smart money signals detected')
  }

  // --- 24h Pump Probability ---
  let pumpProbability24h = 40 // baseline
  pumpProbability24h += clamp(volMomentum * 5, -15, 20)
  pumpProbability24h += clamp((buyRatio1h - 0.5) * 40, -20, 20)
  pumpProbability24h += clamp(priceChange1h * 1.5, -10, 15)
  if (ageDays < 7) pumpProbability24h += 5 // new tokens more volatile
  pumpProbability24h = Math.round(clamp(pumpProbability24h, 5, 95))

  // --- Projected ROI ---
  const baseROI = pumpProbability24h * 0.3
  const projectedROI = {
    low: `+${Math.round(baseROI * 0.5)}%`,
    high: `+${Math.round(baseROI * 2.5)}%`,
    timeframe: '24h',
  }

  // --- Whale Activity ---
  const volToLiqRatio = liquidity > 0 ? vol1h / liquidity : 0
  let whaleLevel: 'low' | 'moderate' | 'high' | 'extreme' = 'low'
  if (volToLiqRatio > 2) whaleLevel = 'extreme'
  else if (volToLiqRatio > 1) whaleLevel = 'high'
  else if (volToLiqRatio > 0.3) whaleLevel = 'moderate'

  const whaleActivity = {
    level: whaleLevel,
    recentBuys: txns1h.buys,
    recentSells: txns1h.sells,
    dominanceScore: Math.round(buyRatio1h * 100),
  }

  // --- Rug Risk (0-10, 10 = extreme risk) ---
  let rugRiskScore = 0
  const rugFactors: string[] = []

  if (ageDays < 1) { rugRiskScore += 3; rugFactors.push('Pair created less than 24 hours ago') }
  else if (ageDays < 7) { rugRiskScore += 1; rugFactors.push('Pair is less than 7 days old') }

  if (liquidity < 10_000) { rugRiskScore += 3; rugFactors.push('Critically low liquidity (<$10K)') }
  else if (liquidity < 50_000) { rugRiskScore += 2; rugFactors.push('Low liquidity (<$50K)') }
  else if (liquidity < 100_000) { rugRiskScore += 1; rugFactors.push('Below-average liquidity') }

  if (!hasWebsite) { rugRiskScore += 1; rugFactors.push('No official website detected') }
  if (!hasSocials) { rugRiskScore += 1; rugFactors.push('No social presence detected') }

  if (marketCap > 0 && liquidity / marketCap < 0.03) {
    rugRiskScore += 2; rugFactors.push('Liquidity-to-market cap ratio critically low (<3%)')
  }

  if (txns24h.sells > txns24h.buys * 1.5) { rugRiskScore += 1; rugFactors.push('Heavy sell pressure over 24h') }

  rugRiskScore = clamp(rugRiskScore, 0, 10)
  const rugLevelStr =
    rugRiskScore <= 1 ? 'minimal' :
    rugRiskScore <= 2 ? 'low' :
    rugRiskScore <= 4 ? 'moderate' :
    rugRiskScore <= 6 ? 'elevated' :
    rugRiskScore <= 8 ? 'high' : 'critical'

  if (rugFactors.length === 0) rugFactors.push('No significant risk factors detected')

  const rugRisk = {
    score: rugRiskScore,
    level: rugLevelStr as 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical',
    factors: rugFactors,
  }

  // --- Market Data ---
  const marketData = {
    priceChange24h,
    priceChange1h,
    priceChange7d,
    volume24h: vol24h,
    liquidity,
    marketCap: cg?.marketCap ?? pair.marketCap ?? null,
    fdv: pair.fdv ?? null,
    pairAge: formatAge(pair.pairCreatedAt ?? Date.now()),
    dexId: pair.dexId,
    twitterFollowers: cg?.twitterFollowers ?? null,
  }

  // --- Summary ---
  const sentimentWord = alphaScore >= 70 ? 'bullish' : alphaScore >= 50 ? 'neutral-to-bullish' : alphaScore >= 35 ? 'cautious' : 'bearish'
  const rugWord = rugRiskScore <= 2 ? 'low rug risk' : rugRiskScore <= 5 ? 'moderate risk profile' : 'elevated rug risk'
  const summary = `${pair.baseToken.symbol} is showing ${sentimentWord} on-chain signals with an Alpha Score of ${alphaScore}/100 and ${rugWord}. ` +
    `24h volume of ${vol24h >= 1_000_000 ? `$${(vol24h / 1_000_000).toFixed(1)}M` : vol24h >= 1_000 ? `$${(vol24h / 1_000).toFixed(0)}K` : `$${vol24h.toFixed(0)}`} with ${Math.round(buyRatio1h * 100)}% buy-side pressure; ` +
    `24h pump probability estimated at ${pumpProbability24h}%.`

  return {
    alphaScore,
    riskRewardRatio,
    smartMoneySignals,
    pumpProbability24h,
    projectedROI,
    whaleActivity,
    rugRisk,
    marketData,
    summary,
  }
}
