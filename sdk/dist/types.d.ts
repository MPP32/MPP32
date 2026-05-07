export type PaymentMethod = 'tempo' | 'x402' | 'auto';
export interface MPP32Config {
    apiUrl?: string;
    tempoPrivateKey?: string;
    solanaPrivateKey?: string;
    preferredMethod?: PaymentMethod;
}
export interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    priceUsd: string;
}
export interface WhaleActivity {
    level: 'low' | 'moderate' | 'high' | 'extreme';
    recentBuys: number;
    recentSells: number;
    dominanceScore: number;
}
export interface RugRisk {
    score: number;
    level: 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
    factors: string[];
}
export interface ProjectedROI {
    low: string;
    high: string;
    timeframe: string;
}
export interface MarketData {
    priceChange24h: number;
    priceChange1h: number | null;
    priceChange7d: number | null;
    volume24h: number;
    liquidity: number;
    marketCap: number | null;
    fdv: number | null;
    pairAge: string;
    dexId: string;
    twitterFollowers?: number;
}
export interface IntelligenceResult {
    token: TokenInfo;
    alphaScore: number;
    riskRewardRatio: string;
    smartMoneySignals: string[];
    pumpProbability24h: number;
    projectedROI: ProjectedROI;
    whaleActivity: WhaleActivity;
    rugRisk: RugRisk;
    marketData: MarketData;
    summary: string;
    jupiterPrice: number | null;
    priceConfidence: 'high' | 'medium' | 'low' | null;
    coingeckoEnriched: boolean;
    timestamp: string;
    dataSource: string;
}
export interface ServiceInfo {
    name: string;
    slug: string;
    shortDescription: string;
    category: string;
    pricePerQuery: number;
    paymentAddress: string;
    creatorName: string;
    logoUrl: string | null;
    queryCount: number;
}
export interface PaymentChallenge {
    protocol: 'tempo' | 'x402';
    rawHeader: string;
    params: Record<string, string>;
}
