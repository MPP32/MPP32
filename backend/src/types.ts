import { z } from 'zod'

// ---- Submissions ----

const SUBMISSION_CATEGORIES = [
  'token-scanner',
  'price-oracle',
  'sentiment-analysis',
  'data-feed',
  'trading-signal',
  'nft-intelligence',
  'defi-analytics',
  'other',
] as const

export const CreateSubmissionSchema = z.object({
  name: z.string().min(2).max(80),
  shortDescription: z.string().min(10).max(160),
  fullDescription: z.string().max(2000).optional(),
  category: z.enum(SUBMISSION_CATEGORIES),
  websiteUrl: z.string().url(),
  endpointUrl: z.string().url().optional(),
  pricePerQuery: z.number().min(0).max(1000).optional(),
  paymentAddress: z.string().optional(),
  creatorName: z.string().min(2).max(100),
  creatorEmail: z.string().email(),
  logoUrl: z.string().url().optional(),
  twitterHandle: z.string().max(50).optional(),
  githubUrl: z.string().url().optional(),
})

export const SubmissionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string().nullable(),
  category: z.string(),
  websiteUrl: z.string(),
  endpointUrl: z.string().nullable(),
  pricePerQuery: z.number().nullable(),
  paymentAddress: z.string().nullable(),
  creatorName: z.string(),
  logoUrl: z.string().nullable(),
  twitterHandle: z.string().nullable(),
  githubUrl: z.string().nullable(),
  status: z.string(),
  queryCount: z.number(),
  lastQueriedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SubmissionStatsSchema = z.object({
  total: z.number(),
  categories: z.record(z.string(), z.number()),
})

export type CreateSubmission = z.infer<typeof CreateSubmissionSchema>
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>
export type SubmissionStats = z.infer<typeof SubmissionStatsSchema>

// ---- Intelligence ----

export const IntelligenceRequestSchema = z.object({
  token: z.string().min(1).max(100).describe('Solana token address or ticker symbol'),
})

export const IntelligenceResponseSchema = z.object({
  token: z.object({
    address: z.string(),
    name: z.string(),
    symbol: z.string(),
    priceUsd: z.string(),
  }),
  alphaScore: z.number().min(0).max(100).describe('Alpha Intelligence Score 0-100'),
  riskRewardRatio: z.string().describe('e.g. "3.2:1"'),
  smartMoneySignals: z.array(z.string()).describe('List of detected signals'),
  pumpProbability24h: z.number().min(0).max(100).describe('Probability % of 24h pump'),
  projectedROI: z.object({
    low: z.string(),
    high: z.string(),
    timeframe: z.string(),
  }),
  whaleActivity: z.object({
    level: z.enum(['low', 'moderate', 'high', 'extreme']),
    recentBuys: z.number(),
    recentSells: z.number(),
    dominanceScore: z.number(),
  }),
  rugRisk: z.object({
    score: z.number().min(0).max(10),
    level: z.enum(['minimal', 'low', 'moderate', 'elevated', 'high', 'critical']),
    factors: z.array(z.string()),
  }),
  marketData: z.object({
    priceChange24h: z.number(),
    priceChange1h: z.number().nullable(),
    priceChange7d: z.number().nullable(),
    volume24h: z.number(),
    liquidity: z.number(),
    marketCap: z.number().nullable(),
    fdv: z.number().nullable(),
    pairAge: z.string(),
    dexId: z.string(),
    twitterFollowers: z.number().nullable().optional(),
  }),
  summary: z.string().describe('Professional 2-3 sentence intelligence summary'),
  jupiterPrice: z.number().nullable().optional(),
  priceConfidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  coingeckoEnriched: z.boolean().optional(),
  timestamp: z.string(),
  dataSource: z.literal('DexScreener'),
})

export type IntelligenceRequest = z.infer<typeof IntelligenceRequestSchema>
export type IntelligenceResponse = z.infer<typeof IntelligenceResponseSchema>
