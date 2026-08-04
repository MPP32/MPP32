export type PaymentMethod = 'tempo' | 'x402' | 'auto'

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
}

export interface MPP32Config {
  apiUrl?: string
  /** EVM private key — used for Tempo pathUSD and x402-on-Base/Ethereum payments. */
  tempoPrivateKey?: string
  /** Solana private key (base58, JSON byte array, or hex) — for x402 USDC on Solana. */
  solanaPrivateKey?: string
  /** Optional Solana RPC override used when signing x402 SVM transactions. Defaults to MPP32_SOLANA_RPC_URL or mainnet-beta. */
  solanaRpcUrl?: string
  /**
   * MPP32 agent key (mpp32_agent_...). Enables the free tier, dashboard usage
   * tracking, and federated-catalog access WITHOUT a wallet. Sent as the
   * X-Agent-Key header. Defaults to the MPP32_AGENT_KEY env var.
   */
  agentKey?: string
  preferredMethod?: PaymentMethod
  headers?: Record<string, string>
  retry?: boolean | Partial<RetryConfig>
}

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  priceUsd: string
}

export interface WhaleActivity {
  level: 'low' | 'moderate' | 'high' | 'extreme'
  recentBuys: number
  recentSells: number
  dominanceScore: number
}

export interface RugRisk {
  score: number
  level: 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical'
  factors: string[]
}

export interface ProjectedROI {
  low: string
  high: string
  timeframe: string
}

export interface MarketData {
  priceChange24h: number
  priceChange1h: number | null
  priceChange7d: number | null
  volume24h: number
  liquidity: number
  marketCap: number | null
  fdv: number | null
  pairAge: string
  dexId: string
  twitterFollowers?: number
}

export interface IntelligenceResult {
  token: TokenInfo
  alphaScore: number
  riskRewardRatio: string
  smartMoneySignals: string[]
  pumpProbability24h: number
  projectedROI: ProjectedROI
  whaleActivity: WhaleActivity
  rugRisk: RugRisk
  marketData: MarketData
  summary: string
  jupiterPrice: number | null
  priceConfidence: 'high' | 'medium' | 'low' | null
  coingeckoEnriched: boolean
  timestamp: string
  dataSource: string
}

export interface ServiceInfo {
  name: string
  slug: string
  shortDescription: string
  category: string
  pricePerQuery: number
  paymentAddress: string
  creatorName: string
  logoUrl: string | null
  queryCount: number
}

export interface PaymentChallenge {
  protocol: 'tempo' | 'x402'
  rawHeader: string
  params: Record<string, string>
}
