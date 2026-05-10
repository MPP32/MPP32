import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'

export const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export function isX402Enabled(): boolean {
  return env.X402_ENABLED === 'true' && !!env.X402_RECIPIENT_ADDRESS
}

export function isX402Request(c: Context): boolean {
  return !!(c.req.header('x-payment') || c.req.header('payment-signature'))
}

export function getX402PaymentHeader(c: Context): string | null {
  return c.req.header('x-payment') ?? c.req.header('payment-signature') ?? null
}

interface PaymentRequirements {
  scheme: string
  network: string
  maxAmountRequired: string
  resource: string
  description: string
  mimeType: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
  outputSchema?: unknown
  extra?: Record<string, unknown>
}

export function createX402Challenge(
  price: string,
  recipientAddress: string,
  resource: string,
): string {
  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: SOLANA_NETWORK,
    maxAmountRequired: String(Math.ceil(parseFloat(price) * 1_000_000)),
    resource,
    description: `MPP32 API access — $${price} USDC`,
    mimeType: 'application/json',
    payTo: recipientAddress,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
  }
  return Buffer.from(JSON.stringify(requirements)).toString('base64')
}

export interface X402VerifyResult {
  verified: boolean
  error?: string
  txSignature?: string
  payer?: string
  network?: string
  settleResponse?: Record<string, unknown>
}

export async function verifyX402Payment(
  paymentHeader: string,
  price: string,
  recipientAddress: string,
  resource: string,
): Promise<X402VerifyResult> {
  const facilitatorUrl = env.X402_FACILITATOR_URL
  const expectedAmountMicro = Math.ceil(parseFloat(price) * 1_000_000)

  if (isNaN(expectedAmountMicro) || expectedAmountMicro <= 0) {
    return { verified: false, error: 'Invalid price configuration' }
  }

  if (!recipientAddress || recipientAddress.length < 32) {
    return { verified: false, error: 'Invalid recipient address configuration' }
  }

  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: SOLANA_NETWORK,
    maxAmountRequired: String(expectedAmountMicro),
    resource,
    description: `MPP32 API access — $${price} USDC`,
    mimeType: 'application/json',
    payTo: recipientAddress,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))
  } catch {
    return { verified: false, error: 'Invalid payment header encoding' }
  }

  // Local pre-validation: ensure payload has required structure
  if (!payload || typeof payload !== 'object') {
    return { verified: false, error: 'Payment payload must be a JSON object' }
  }

  const p = payload as Record<string, unknown>

  // Validate the payment targets the correct recipient and asset
  if (p.payTo && p.payTo !== recipientAddress) {
    logger.warn('x402 recipient mismatch', { expected: recipientAddress, got: p.payTo })
    return { verified: false, error: 'Payment recipient does not match' }
  }
  if (p.asset && p.asset !== USDC_MINT) {
    return { verified: false, error: 'Payment asset must be USDC' }
  }
  if (p.network && p.network !== SOLANA_NETWORK) {
    return { verified: false, error: 'Payment must be on Solana mainnet' }
  }

  try {
    const verifyRes = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => '')
      logger.warn('x402 verify failed', { status: verifyRes.status, body: text })
      return { verified: false, error: `Facilitator verify returned ${verifyRes.status}` }
    }

    const verifyResult = await verifyRes.json() as { isValid?: boolean; valid?: boolean; payer?: string }
    const isValid = verifyResult.isValid ?? verifyResult.valid ?? false

    if (!isValid) {
      return { verified: false, error: 'Payment verification failed at facilitator' }
    }

    const settleRes = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!settleRes.ok) {
      const text = await settleRes.text().catch(() => '')
      logger.warn('x402 settle failed', { status: settleRes.status, body: text })
      return { verified: false, error: `Facilitator settle returned ${settleRes.status}` }
    }

    const settleJson = await settleRes.json().catch(() => ({})) as Record<string, unknown>
    const txSignature =
      (settleJson.txHash as string | undefined) ??
      (settleJson.transaction as string | undefined) ??
      (settleJson.signature as string | undefined) ??
      undefined
    const network =
      (settleJson.networkId as string | undefined) ??
      (settleJson.network as string | undefined) ??
      SOLANA_NETWORK

    logger.info('x402 payment verified and settled', { resource, price, recipient: recipientAddress, txSignature })
    return {
      verified: true,
      txSignature,
      payer: verifyResult.payer,
      network,
      settleResponse: settleJson,
    }
  } catch (err) {
    logger.error('x402 verification error', { error: String(err) })
    return { verified: false, error: String(err) }
  }
}
