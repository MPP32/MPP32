import { isX402Enabled } from './x402.js'
import { isAP2Enabled } from './ap2.js'
import { isACPEnabled } from './acp.js'
import { isAGTPEnabled } from './agtp.js'
import { getM32Balance, calculateDiscount, type DiscountResult } from './solana-token.js'

export type ProtocolId = 'tempo' | 'x402' | 'acp' | 'ap2' | 'agtp'

export interface ProtocolStatus {
  id: ProtocolId
  name: string
  type: 'payment' | 'authorization' | 'identity'
  enabled: boolean
  network: string
  currency: string
  settlementSpeed: string
  fees: string
  bestFor: string
}

export interface QuoteResult {
  service: string
  basePrice: string
  protocols: ProtocolQuote[]
  discount: DiscountResult
  recommended: ProtocolId
  reasoning: string
}

export interface ProtocolQuote {
  protocol: ProtocolId
  available: boolean
  effectivePrice: string
  currency: string
  estimatedSettlement: string
  headers: Record<string, string>
}

const PROTOCOL_META: Record<ProtocolId, Omit<ProtocolStatus, 'enabled'>> = {
  tempo: {
    id: 'tempo',
    name: 'Tempo (pathUSD)',
    type: 'payment',
    network: 'Ethereum L2',
    currency: 'pathUSD',
    settlementSpeed: '<1s',
    fees: 'Sub-cent',
    bestFor: 'High-frequency micropayments, EVM-native agents',
  },
  x402: {
    id: 'x402',
    name: 'x402 (USDC on Solana)',
    type: 'payment',
    network: 'Solana Mainnet',
    currency: 'USDC',
    settlementSpeed: '<400ms',
    fees: '<$0.01',
    bestFor: 'Solana-native agents, stablecoin payments',
  },
  acp: {
    id: 'acp',
    name: 'Agent Commerce Protocol',
    type: 'payment',
    network: 'Database-backed',
    currency: 'USD',
    settlementSpeed: 'Instant',
    fees: 'None',
    bestFor: 'Session-based purchases, checkout flows, cart operations',
  },
  ap2: {
    id: 'ap2',
    name: 'Agent Payments Protocol v2',
    type: 'authorization',
    network: 'Protocol-agnostic',
    currency: 'Any',
    settlementSpeed: 'Instant',
    fees: 'None',
    bestFor: 'W3C Verifiable Credential agents, enterprise compliance',
  },
  agtp: {
    id: 'agtp',
    name: 'Agent Transfer Protocol',
    type: 'identity',
    network: 'Protocol-agnostic',
    currency: 'Any',
    settlementSpeed: 'Instant',
    fees: 'None',
    bestFor: 'Agent identity verification, delegated authority, intent routing',
  },
}

export function getProtocolStatuses(): ProtocolStatus[] {
  return [
    { ...PROTOCOL_META.tempo, enabled: true },
    { ...PROTOCOL_META.x402, enabled: isX402Enabled() },
    { ...PROTOCOL_META.acp, enabled: isACPEnabled() },
    { ...PROTOCOL_META.ap2, enabled: isAP2Enabled() },
    { ...PROTOCOL_META.agtp, enabled: isAGTPEnabled() },
  ]
}

export function getEnabledProtocols(): ProtocolId[] {
  const enabled: ProtocolId[] = ['tempo']
  if (isX402Enabled()) enabled.push('x402')
  if (isACPEnabled()) enabled.push('acp')
  if (isAP2Enabled()) enabled.push('ap2')
  if (isAGTPEnabled()) enabled.push('agtp')
  return enabled
}

export function selectOptimalProtocol(
  agentCapabilities?: ProtocolId[],
  preferredProtocol?: ProtocolId,
): { protocol: ProtocolId; reasoning: string } {
  const enabled = getEnabledProtocols()

  if (preferredProtocol && enabled.includes(preferredProtocol)) {
    return { protocol: preferredProtocol, reasoning: `Using preferred protocol: ${preferredProtocol}` }
  }

  if (agentCapabilities?.length) {
    const compatible = agentCapabilities.filter((p) => enabled.includes(p))
    if (compatible.includes('x402')) {
      return { protocol: 'x402', reasoning: 'x402 selected — fastest Solana settlement with USDC' }
    }
    if (compatible.includes('tempo')) {
      return { protocol: 'tempo', reasoning: 'Tempo selected — sub-second EVM L2 settlement' }
    }
    if (compatible.includes('acp')) {
      return { protocol: 'acp', reasoning: 'ACP selected — session-based agent commerce' }
    }
    if (compatible.length > 0) {
      return { protocol: compatible[0]!, reasoning: `${compatible[0]} selected as best available match` }
    }
  }

  if (enabled.includes('x402')) {
    return { protocol: 'x402', reasoning: 'x402 default — native Solana USDC, fastest settlement' }
  }
  return { protocol: 'tempo', reasoning: 'Tempo fallback — always available EVM L2 payments' }
}

export async function getQuote(
  service: string,
  basePrice: string,
  walletAddress?: string,
  agentCapabilities?: ProtocolId[],
  preferredProtocol?: ProtocolId,
): Promise<QuoteResult> {
  const discount = walletAddress
    ? calculateDiscount(await getM32Balance(walletAddress), basePrice)
    : calculateDiscount(0, basePrice)

  const effectivePrice = discount.discountedPrice
  const enabled = getEnabledProtocols()
  const { protocol: recommended, reasoning } = selectOptimalProtocol(agentCapabilities, preferredProtocol)

  const protocols: ProtocolQuote[] = [
    {
      protocol: 'tempo',
      available: true,
      effectivePrice,
      currency: 'pathUSD',
      estimatedSettlement: '<1s',
      headers: { 'Authorization': 'Payment <tempo-receipt>' },
    },
    {
      protocol: 'x402',
      available: enabled.includes('x402'),
      effectivePrice,
      currency: 'USDC',
      estimatedSettlement: '<400ms',
      headers: { 'X-Payment': '<signed-solana-tx>' },
    },
    {
      protocol: 'acp',
      available: enabled.includes('acp'),
      effectivePrice,
      currency: 'USD',
      estimatedSettlement: 'Instant',
      headers: { 'X-ACP-Session': '<session-id>' },
    },
    {
      protocol: 'ap2',
      available: enabled.includes('ap2'),
      effectivePrice,
      currency: 'Any',
      estimatedSettlement: 'Instant',
      headers: { 'X-AP2-Mandate': '<base64-verifiable-credential>' },
    },
    {
      protocol: 'agtp',
      available: enabled.includes('agtp'),
      effectivePrice,
      currency: 'Any',
      estimatedSettlement: 'Instant',
      headers: {
        'Agent-ID': '<agent-id>',
        'Agent-Signature': '<hmac-sha256-sig>',
        'Agent-Timestamp': '<unix-epoch>',
      },
    },
  ]

  return {
    service,
    basePrice,
    protocols,
    discount,
    recommended,
    reasoning,
  }
}
