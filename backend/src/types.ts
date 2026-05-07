import { z } from 'zod'

// ---- Submissions ----

const evmAddress = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Must be a valid EVM address (0x followed by 40 hex characters)'
)

const solanaAddress = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'Must be a valid Solana address (32-44 base58 characters)'
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
  solanaAddress: solanaAddress.optional(),
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
  solanaAddress: z.string().nullable(),
  creatorName: z.string(),
  logoUrl: z.string().nullable(),
  twitterHandle: z.string().nullable(),
  githubUrl: z.string().nullable(),
  status: z.string(),
  queryCount: z.number(),
  lastQueriedAt: z.string().nullable(),
  isVerified: z.boolean(),
  verifyFailCount: z.number(),
  lastVerifiedAt: z.string().nullable(),
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
  solanaAddress: solanaAddress.optional().or(z.literal('')),
  shortDescription: z.string().min(10).max(200).optional(),
  fullDescription: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  twitterHandle: z.string().optional(),
  githubUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional(),
})

// Response when creating — includes the one-time management token
export const SubmissionCreatedResponseSchema = SubmissionResponseSchema.extend({
  managementToken: z.string(),
  verificationToken: z.string(),
})

// Provider stats (requires management auth)
export const ProviderStatsSchema = z.object({
  queryCount: z.number(),
  lastQueriedAt: z.string().nullable(),
  estimatedRevenue: z.number(),
  pricePerQuery: z.number().nullable(),
  totalRequests: z.number().optional(),
  requestsLast24h: z.number().optional(),
  requestsLast7d: z.number().optional(),
  successRate: z.number().optional(),
  avgLatencyMs: z.number().optional(),
  errorCount: z.number().optional(),
})

// Endpoint validation response
export const ValidateEndpointResponseSchema = z.object({
  reachable: z.boolean(),
  statusCode: z.number().nullable(),
  responseTimeMs: z.number().nullable(),
  error: z.string().nullable(),
})

// Token recovery — 2-step flow
// Step 1: request OTP sent to creator's email
// NOTE: trim() runs before email() so leading/trailing whitespace from users
// copy/pasting doesn't fail validation. Case-insensitive comparison happens in the route.
export const RequestRecoverySchema = z.object({
  creatorEmail: z.string().trim().email('Must be a valid email'),
})
export type RequestRecovery = z.infer<typeof RequestRecoverySchema>

// Step 2: submit the 6-digit OTP code to get a new management token
export const RecoverTokenSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Must be a 6-digit code'),
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

export const VerifyEndpointResponseSchema = z.object({
  verified: z.boolean(),
  error: z.string().optional(),
})
export type VerifyEndpointResponse = z.infer<typeof VerifyEndpointResponseSchema>

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

// ---- Metrics ----

export const MetricsOverviewSchema = z.object({
  totalRequests: z.number(),
  requests24h: z.number(),
  requests7d: z.number(),
  requests30d: z.number(),
  successRate: z.number(),
  avgLatencyMs: z.number(),
  topServices: z.array(z.object({
    slug: z.string(),
    requestCount: z.number(),
  })),
  errorBreakdown: z.record(z.string(), z.number()),
})

export const ProviderMetricsSchema = z.object({
  queryCount: z.number(),
  lastQueriedAt: z.string().nullable(),
  estimatedRevenue: z.number(),
  pricePerQuery: z.number().nullable(),
  totalRequests: z.number(),
  requestsLast24h: z.number(),
  requestsLast7d: z.number(),
  successRate: z.number(),
  avgLatencyMs: z.number(),
  errorCount: z.number(),
})

export type MetricsOverview = z.infer<typeof MetricsOverviewSchema>
export type ProviderMetrics = z.infer<typeof ProviderMetricsSchema>

// ---- AP2 (Agent Payments Protocol) ----

export const AP2MandateTypeEnum = z.enum(['IntentMandate', 'CartMandate', 'PaymentMandate'])

export const AP2ConstraintsSchema = z.object({
  maxAmount: z.string().optional(),
  currency: z.string().optional(),
  resource: z.string().optional(),
  validUntil: z.string().optional(),
  validFrom: z.string().optional(),
})

export const AP2CredentialSubjectSchema = z.object({
  type: AP2MandateTypeEnum,
  agentId: z.string().min(1),
  constraints: AP2ConstraintsSchema.optional(),
  merchantOffer: z.object({
    merchantId: z.string(),
    offerId: z.string(),
    amount: z.string(),
    currency: z.string(),
  }).optional(),
})

export const AP2ProofSchema = z.object({
  type: z.string().min(1),
  created: z.string().min(1),
  verificationMethod: z.string().min(1),
  proofPurpose: z.enum(['assertionMethod', 'authentication']),
  proofValue: z.string().min(1),
})

export const AP2MandateSchema = z.object({
  '@context': z.array(z.string()),
  type: z.array(z.string()).refine(
    (types) => types.includes('VerifiableCredential') && types.includes('AP2Mandate'),
    'Must include VerifiableCredential and AP2Mandate types',
  ),
  issuer: z.string().min(1),
  issuanceDate: z.string().min(1),
  expirationDate: z.string().optional(),
  credentialSubject: AP2CredentialSubjectSchema,
  proof: AP2ProofSchema,
})

export const AP2VerificationResultSchema = z.object({
  verified: z.boolean(),
  mandateType: z.enum(['intent', 'cart', 'payment']).optional(),
  agentId: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
})

export type AP2Constraints = z.infer<typeof AP2ConstraintsSchema>
export type AP2CredentialSubject = z.infer<typeof AP2CredentialSubjectSchema>
export type AP2Proof = z.infer<typeof AP2ProofSchema>
export type AP2Mandate = z.infer<typeof AP2MandateSchema>
export type AP2VerificationResult = z.infer<typeof AP2VerificationResultSchema>
export type AP2MandateType = 'intent' | 'cart' | 'payment'

// ---- ACP (Agent Commerce Protocol) ----

export const ACPSessionStatusEnum = z.enum(['incomplete', 'ready_for_payment', 'completed', 'canceled', 'expired'])

export const ACPVerificationResultSchema = z.object({
  verified: z.boolean(),
  sessionId: z.string().optional(),
  status: ACPSessionStatusEnum.optional(),
  merchantId: z.string().optional(),
  amount: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
})

export type ACPSessionStatus = z.infer<typeof ACPSessionStatusEnum>
export type ACPVerificationResult = z.infer<typeof ACPVerificationResultSchema>

// ---- AGTP (Agent Transfer Protocol) ----

export const AGTPIntentMethodEnum = z.enum([
  'QUERY', 'SUMMARIZE', 'BOOK', 'SCHEDULE', 'LEARN',
  'DELEGATE', 'COLLABORATE', 'CONFIRM', 'ESCALATE',
  'NOTIFY', 'DESCRIBE', 'SUSPEND',
])

export const AGTPHeadersSchema = z.object({
  agentId: z.string().min(1),
  principalId: z.string().optional(),
  authorityScope: z.string().optional(),
  sessionId: z.string().optional(),
  taskId: z.string().optional(),
  delegationChain: z.string().optional(),
  budgetLimit: z.string().optional(),
})

export const AGTPVerificationResultSchema = z.object({
  verified: z.boolean(),
  agentId: z.string().optional(),
  intentMethod: z.string().optional(),
  principalId: z.string().optional(),
  authorityScope: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
})

export type AGTPIntentMethod = z.infer<typeof AGTPIntentMethodEnum>
export type AGTPHeaders = z.infer<typeof AGTPHeadersSchema>
export type AGTPVerificationResult = z.infer<typeof AGTPVerificationResultSchema>

// ---- Contact Messages ----

export const ContactMessageSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
})

export const ContactMessageResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
})

export type ContactMessage = z.infer<typeof ContactMessageSchema>
export type ContactMessageResponse = z.infer<typeof ContactMessageResponseSchema>
