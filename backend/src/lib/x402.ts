import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'

export const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// The facilitator pays the SOL transaction fee on Solana, so its address has
// to appear as `extra.feePayer` in every challenge we issue. We discover this
// once via the facilitator's `/supported` endpoint and cache it. If that
// lookup fails at startup, we fall back to the public Coinbase-run mainnet
// fee-payer (documented at https://x402.org/facilitator).
//
// All access goes through `getSvmFeePayer()`, which kicks off the warm-up
// fetch on first call. We do not block server startup on the lookup — if the
// facilitator is slow, every challenge served before the response lands uses
// the hardcoded fallback, which the facilitator accepts because it IS the
// fallback's owner.
const HARDCODED_FACILITATOR_FEE_PAYER = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'
let cachedSvmFeePayer: string | null = null
let feePayerLookupInFlight: Promise<void> | null = null

interface FacilitatorSupportedResponse {
  // Coinbase's facilitator returns either { kinds: [{ scheme, network, extra: { feePayer } }] }
  // or { feePayers: { [network]: string } }. We tolerate both shapes — and
  // ignore the rest — so the lookup is liberal in what it accepts.
  kinds?: Array<{ scheme?: string; network?: string; extra?: { feePayer?: string } }>
  feePayers?: Record<string, string>
}

async function fetchSvmFeePayer(): Promise<void> {
  const url = `${env.X402_FACILITATOR_URL.replace(/\/+$/, '')}/supported`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      logger.warn('x402 facilitator /supported returned non-OK', { status: res.status })
      return
    }
    const body = (await res.json()) as FacilitatorSupportedResponse
    // Prefer an explicit map if the facilitator exposes one.
    const fromMap = body.feePayers?.[SOLANA_NETWORK]
    if (fromMap && typeof fromMap === 'string') {
      cachedSvmFeePayer = fromMap
      logger.info('x402 facilitator feePayer cached', { network: SOLANA_NETWORK, feePayer: fromMap, source: 'feePayers-map' })
      return
    }
    const fromKinds = body.kinds?.find(
      (k) => k.scheme === 'exact' && k.network === SOLANA_NETWORK && typeof k.extra?.feePayer === 'string',
    )?.extra?.feePayer
    if (fromKinds) {
      cachedSvmFeePayer = fromKinds
      logger.info('x402 facilitator feePayer cached', { network: SOLANA_NETWORK, feePayer: fromKinds, source: 'kinds' })
      return
    }
    logger.warn('x402 facilitator /supported did not advertise a feePayer for', { network: SOLANA_NETWORK })
  } catch (err) {
    logger.warn('x402 facilitator /supported lookup failed', { error: String(err) })
  }
}

export function getSvmFeePayer(): string {
  if (cachedSvmFeePayer) return cachedSvmFeePayer
  if (!feePayerLookupInFlight) {
    // Kick off the lookup but do not await — return the fallback immediately.
    // The next request after the lookup completes will benefit.
    feePayerLookupInFlight = fetchSvmFeePayer().catch(() => undefined)
  }
  return HARDCODED_FACILITATOR_FEE_PAYER
}

// Warm the cache at module load so the first challenge served includes the
// correct facilitator-advertised fee-payer when possible.
void (async () => {
  await fetchSvmFeePayer()
})()

export function isX402Enabled(): boolean {
  return env.X402_ENABLED === 'true' && !!env.X402_RECIPIENT_ADDRESS
}

export function isX402Request(c: Context): boolean {
  return !!(c.req.header('x-payment') || c.req.header('payment-signature'))
}

export function getX402PaymentHeader(c: Context): string | null {
  return c.req.header('x-payment') ?? c.req.header('payment-signature') ?? null
}

export interface PaymentRequirements {
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

function buildRequirements(price: string, recipientAddress: string, resource: string): PaymentRequirements {
  return {
    scheme: 'exact',
    network: SOLANA_NETWORK,
    maxAmountRequired: String(Math.ceil(parseFloat(price) * 1_000_000)),
    resource,
    description: `MPP32 API access — $${price} USDC`,
    mimeType: 'application/json',
    payTo: recipientAddress,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {
      // Required by the x402 `exact` SVM scheme: the facilitator's fee-payer
      // address. The client uses this to build a transaction the facilitator
      // can settle (the facilitator signs as feePayer; the client signs as
      // the token-account authority).
      feePayer: getSvmFeePayer(),
      // USDC decimals — clients should default to 6 when missing, but we send
      // it explicitly so that nothing depends on the default.
      decimals: 6,
    },
  }
}

export function createX402Challenge(
  price: string,
  recipientAddress: string,
  resource: string,
): string {
  const requirements = buildRequirements(price, recipientAddress, resource)
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

export interface X402EnvelopeVerifyResult {
  verified: boolean
  error?: string
  payer?: string
  envelope?: unknown
  requirements?: PaymentRequirements
}

export interface X402SettleResult {
  settled: boolean
  txSignature?: string
  payer?: string
  network?: string
  error?: string
  settleResponse?: Record<string, unknown>
}

function parseAndValidateEnvelope(
  paymentHeader: string,
): { ok: true; envelope: Record<string, unknown> } | { ok: false; error: string } {
  let envelope: unknown
  try {
    envelope = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))
  } catch {
    return { ok: false, error: 'X-Payment header is not base64-encoded JSON' }
  }
  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, error: 'X-Payment payload must be a JSON object' }
  }
  const e = envelope as Record<string, unknown>
  if (typeof e.scheme !== 'string') return { ok: false, error: 'X-Payment payload missing string "scheme"' }
  if (typeof e.network !== 'string') return { ok: false, error: 'X-Payment payload missing string "network"' }
  if (!e.payload || typeof e.payload !== 'object') {
    return { ok: false, error: 'X-Payment payload missing "payload" object' }
  }
  if (e.scheme !== 'exact') {
    return { ok: false, error: `Only the "exact" scheme is supported, got "${e.scheme}"` }
  }
  if (e.network !== SOLANA_NETWORK) {
    return { ok: false, error: `Payment must be on ${SOLANA_NETWORK}, got "${e.network}"` }
  }
  return { ok: true, envelope: e }
}

function validatePriceAndRecipient(
  price: string,
  recipientAddress: string,
): string | null {
  const expectedAmountMicro = Math.ceil(parseFloat(price) * 1_000_000)
  if (isNaN(expectedAmountMicro) || expectedAmountMicro <= 0) return 'Invalid price configuration'
  if (!recipientAddress || recipientAddress.length < 32) return 'Invalid recipient address configuration'
  return null
}

export async function verifyX402Envelope(
  paymentHeader: string,
  price: string,
  recipientAddress: string,
  resource: string,
): Promise<X402EnvelopeVerifyResult> {
  const configError = validatePriceAndRecipient(price, recipientAddress)
  if (configError) return { verified: false, error: configError }

  const parsed = parseAndValidateEnvelope(paymentHeader)
  if (!parsed.ok) return { verified: false, error: parsed.error }

  const requirements = buildRequirements(price, recipientAddress, resource)

  try {
    const verifyRes = await fetch(`${env.X402_FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: parsed.envelope, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => '')
      logger.warn('x402 verify failed', { status: verifyRes.status, body: text })
      return { verified: false, error: `Facilitator verify returned ${verifyRes.status}: ${text.slice(0, 200)}` }
    }

    const verifyResult = (await verifyRes.json()) as {
      isValid?: boolean
      valid?: boolean
      payer?: string
      invalidReason?: string
    }
    const isValid = verifyResult.isValid ?? verifyResult.valid ?? false
    if (!isValid) {
      return { verified: false, error: verifyResult.invalidReason ?? 'Payment verification failed at facilitator' }
    }

    return {
      verified: true,
      payer: verifyResult.payer,
      envelope: parsed.envelope,
      requirements,
    }
  } catch (err) {
    logger.error('x402 envelope verification error', { error: String(err) })
    return { verified: false, error: String(err) }
  }
}

export async function settleX402Payment(
  envelope: unknown,
  requirements: PaymentRequirements,
): Promise<X402SettleResult> {
  try {
    const settleRes = await fetch(`${env.X402_FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: envelope, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!settleRes.ok) {
      const text = await settleRes.text().catch(() => '')
      logger.warn('x402 settle failed', { status: settleRes.status, body: text })
      return { settled: false, error: `Facilitator settle returned ${settleRes.status}: ${text.slice(0, 200)}` }
    }

    const settleJson = (await settleRes.json().catch(() => ({}))) as Record<string, unknown>
    const txSignature =
      (settleJson.txHash as string | undefined) ??
      (settleJson.transaction as string | undefined) ??
      (settleJson.signature as string | undefined) ??
      undefined
    const network =
      (settleJson.networkId as string | undefined) ??
      (settleJson.network as string | undefined) ??
      SOLANA_NETWORK

    logger.info('x402 payment settled', { txSignature, resource: requirements.resource })
    return { settled: true, txSignature, network, settleResponse: settleJson }
  } catch (err) {
    logger.error('x402 settlement error', { error: String(err) })
    return { settled: false, error: String(err) }
  }
}

export async function verifyX402Payment(
  paymentHeader: string,
  price: string,
  recipientAddress: string,
  resource: string,
): Promise<X402VerifyResult> {
  const envelopeResult = await verifyX402Envelope(paymentHeader, price, recipientAddress, resource)
  if (!envelopeResult.verified) {
    return { verified: false, error: envelopeResult.error }
  }

  const settleResult = await settleX402Payment(envelopeResult.envelope!, envelopeResult.requirements!)
  if (!settleResult.settled) {
    return { verified: false, error: settleResult.error }
  }

  logger.info('x402 payment verified and settled', {
    resource,
    price,
    recipient: recipientAddress,
    txSignature: settleResult.txSignature,
  })
  return {
    verified: true,
    txSignature: settleResult.txSignature,
    payer: envelopeResult.payer,
    network: settleResult.network,
    settleResponse: settleResult.settleResponse,
  }
}
