import { z } from 'zod'

// ---- Submissions ----

// Reusable EVM (Ethereum-style) address validator.
// Matches "0x" followed by exactly 40 hex characters.
const evmAddress = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Must be a valid Ethereum-style address (0x followed by 40 hex characters)'
)

const SUBMISSION_CATEGORIES = [
  // AI & Machine Learning
  'ai-inference',
  'image-generation',
  'image-analysis',
  'speech-tts',
  'speech-stt',
  'translation',
  'embeddings',
  'summarization',
  'sentiment-analysis',
  // Data & Intelligence
  'web-search',
  'web-scraping',
  'news-feed',
  'social-data',
  'financial-data',
  'market-data',
  'sports-data',
  'weather',
  'geolocation',
  'real-estate',
  // Crypto / Web3
  'token-scanner',
  'price-oracle',
  'trading-signal',
  'nft-intelligence',
  'defi-analytics',
  'wallet-intelligence',
  'on-chain-data',
  'risk-compliance',
  // Utility APIs
  'ocr',
  'document-parsing',
  'email-verification',
  'phone-verification',
  'identity-kyc',
  'fraud-detection',
  'sms-messaging',
  // Business
  'data-enrichment',
  'crm-lookup',
  'analytics',
  'seo-tools',
  'advertising-data',
  // Developer Tools
  'code-intelligence',
  'security-scanning',
  'uptime-monitoring',
  // Media & Entertainment
  'gaming-data',
  'music-media',
  'sports-odds',
  // Generic
  'data-feed',
  'other',
] as const

export const CreateSubmissionSchema = z.object({
  name: z.string().min(2).max(80),
  shortDescription: z.string().min(10).max(160),
  fullDescription: z.string().max(2000).optional(),
  category: z.enum(SUBMISSION_CATEGORIES),
  websiteUrl: z.string().url(),
  endpointUrl: z.string().url(),
  pricePerQuery: z.number().min(0.001).max(1000),
  paymentAddress: evmAddress,
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

// For updating a provider listing (all fields optional)
export const UpdateSubmissionSchema = z.object({
  endpointUrl: z.string().url('Must be a valid URL').optional(),
  pricePerQuery: z.number().min(0.001).max(1000).optional(),
  paymentAddress: evmAddress.optional(),
  shortDescription: z.string().min(10).max(200).optional(),
  fullDescription: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  twitterHandle: z.string().optional(),
  githubUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional(),
})

// Response when creating — includes the one-time management token
export const SubmissionCreatedResponseSchema = SubmissionResponseSchema.extend({
  managementToken: z.string(), // 64-char hex, shown ONCE
})

// Provider stats (requires management auth)
export const ProviderStatsSchema = z.object({
  queryCount: z.number(),
  lastQueriedAt: z.string().nullable(),
  estimatedRevenue: z.number(),
  pricePerQuery: z.number().nullable(),
})

// Endpoint validation response
export const ValidateEndpointResponseSchema = z.object({
  reachable: z.boolean(),
  statusCode: z.number().nullable(),
  responseTimeMs: z.number().nullable(),
  error: z.string().nullable(),
})

// Token recovery — request body and response
// NOTE: trim() runs before email() so leading/trailing whitespace from users
// copy/pasting doesn't fail validation. Case-insensitive comparison happens in the route.
export const RecoverTokenSchema = z.object({
  creatorEmail: z.string().trim().email('Must be a valid email'),
})
export type RecoverToken = z.infer<typeof RecoverTokenSchema>

export const RecoverTokenResponseSchema = z.object({
  managementToken: z.string(),
  slug: z.string(),
})
export type RecoverTokenResponse = z.infer<typeof RecoverTokenResponseSchema>

export type CreateSubmission = z.infer<typeof CreateSubmissionSchema>
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>
export type SubmissionStats = z.infer<typeof SubmissionStatsSchema>
export type UpdateSubmission = z.infer<typeof UpdateSubmissionSchema>
export type SubmissionCreatedResponse = z.infer<typeof SubmissionCreatedResponseSchema>
export type ProviderStats = z.infer<typeof ProviderStatsSchema>
export type ValidateEndpointResponse = z.infer<typeof ValidateEndpointResponseSchema>

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
  verifiedPrice: z.number().nullable().optional(),
  priceConfidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  enriched: z.boolean().optional(),
  timestamp: z.string(),
  dataSource: z.string(),
})

export type IntelligenceRequest = z.infer<typeof IntelligenceRequestSchema>
export type IntelligenceResponse = z.infer<typeof IntelligenceResponseSchema>
