import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'

// ─────────────────────────────────────────────────────────────────────────────
// Network configuration
//
// The CAIP-2 network ID lives in `env.X402_NETWORK`, defaulting to Solana
// mainnet. `SOLANA_NETWORK` is re-exported so the OpenAPI document, the A2A
// agent card, and any other advertisement read a single source of truth.
// One env var changes every announcement.
// ─────────────────────────────────────────────────────────────────────────────

export const SOLANA_NETWORK = env.X402_NETWORK
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// PayAI mainnet fee-payer, used only when a probe has not yet landed at the
// instant of the first inbound request. Once the startup validator completes
// (which happens before the server accepts traffic), the cached value from
// the facilitator's /supported response takes over.
const PAYAI_MAINNET_FEE_PAYER_FALLBACK = '2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4'

interface FacilitatorSupportedResponse {
  // Tolerates both shapes the ecosystem ships today:
  //   { kinds: [{ scheme, network, extra: { feePayer } }] }   (PayAI / Coinbase CDP)
  //   { feePayers: { [network]: string } }                     (older clients)
  kinds?: Array<{ scheme?: string; network?: string; extra?: { feePayer?: string } }>
  feePayers?: Record<string, string>
}

interface ProbeOk {
  ok: true
  url: string
  feePayer: string
  supportedNetworks: string[]
}
interface ProbeFail {
  ok: false
  url: string
  reason: string
  supportedNetworks: string[]
}
type ProbeResult = ProbeOk | ProbeFail

// ─────────────────────────────────────────────────────────────────────────────
// Facilitator probe
//
// Calls a facilitator's `/supported` endpoint, then verifies it advertises
// `env.X402_NETWORK`. Returns the network's fee-payer on success, an error
// reason on failure. Does NOT throw — callers decide how to react.
// ─────────────────────────────────────────────────────────────────────────────

async function probeFacilitator(url: string): Promise<ProbeResult> {
  const trimmed = url.replace(/\/+$/, '')
  try {
    const res = await fetch(`${trimmed}/supported`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      return { ok: false, url: trimmed, reason: `HTTP ${res.status} from /supported`, supportedNetworks: [] }
    }
    const body = (await res.json()) as FacilitatorSupportedResponse
    const supportedNetworks: string[] = []

    // Map shape (older facilitators):
    if (body.feePayers && typeof body.feePayers === 'object') {
      for (const net of Object.keys(body.feePayers)) supportedNetworks.push(net)
      const direct = body.feePayers[env.X402_NETWORK]
      if (direct && typeof direct === 'string') {
        return { ok: true, url: trimmed, feePayer: direct, supportedNetworks }
      }
    }
    // Kinds shape (current PayAI / CDP):
    if (Array.isArray(body.kinds)) {
      for (const k of body.kinds) {
        if (k.network) supportedNetworks.push(k.network)
      }
      const exact = body.kinds.find(
        (k) =>
          k.scheme === 'exact' &&
          k.network === env.X402_NETWORK &&
          typeof k.extra?.feePayer === 'string',
      )
      if (exact?.extra?.feePayer) {
        return { ok: true, url: trimmed, feePayer: exact.extra.feePayer, supportedNetworks }
      }
    }

    return {
      ok: false,
      url: trimmed,
      reason: `facilitator does not advertise scheme="exact" for network="${env.X402_NETWORK}"`,
      supportedNetworks,
    }
  } catch (err) {
    return {
      ok: false,
      url: trimmed,
      reason: err instanceof Error ? err.message : String(err),
      supportedNetworks: [],
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Active facilitator state
//
// `activeFacilitator` is the URL we hit for /verify and /settle. The startup
// validator picks it (primary if it supports our network, else fallback).
// `failoverFacilitator` is the secondary URL, tried only on request-time
// transport failures against the primary.
//
// `cachedFeePayer` is what we drop into outgoing challenges' `extra.feePayer`.
// It is updated whenever a probe succeeds.
// ─────────────────────────────────────────────────────────────────────────────

let activeFacilitator: string = env.X402_FACILITATOR_URL.replace(/\/+$/, '')
let failoverFacilitator: string | null =
  env.X402_FACILITATOR_FALLBACK_URL && env.X402_FACILITATOR_FALLBACK_URL !== env.X402_FACILITATOR_URL
    ? env.X402_FACILITATOR_FALLBACK_URL.replace(/\/+$/, '')
    : null
let cachedFeePayer: string | null = null

export function getSvmFeePayer(): string {
  return cachedFeePayer ?? PAYAI_MAINNET_FEE_PAYER_FALLBACK
}

export function getActiveFacilitator(): string {
  return activeFacilitator
}

export function getFailoverFacilitator(): string | null {
  return failoverFacilitator
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup validator
//
// Probes the primary facilitator and (if needed) the fallback before the
// server accepts traffic. Promotes whichever one advertises support for the
// configured network. In production, exits non-zero if neither qualifies so
// the platform never serves challenges it cannot settle. In development,
// prints the same banner but keeps the process alive for offline iteration.
// ─────────────────────────────────────────────────────────────────────────────

export async function validateFacilitatorAtBoot(): Promise<void> {
  if (env.X402_ENABLED !== 'true') {
    console.log('ℹ️  x402 disabled — skipping facilitator boot probe')
    return
  }

  const isProduction = env.NODE_ENV === 'production'
  const primary = await probeFacilitator(env.X402_FACILITATOR_URL)

  if (primary.ok) {
    activeFacilitator = primary.url
    cachedFeePayer = primary.feePayer
    console.log(
      `✅ x402 facilitator validated: ${primary.url} supports ${env.X402_NETWORK} (feePayer: ${primary.feePayer.slice(0, 8)}…)`,
    )
    // Still probe the failover so we have a confirmed alternate before we
    // actually need it. Best-effort — don't block startup on failover health.
    if (failoverFacilitator && failoverFacilitator !== primary.url) {
      probeFacilitator(failoverFacilitator)
        .then((fb) => {
          if (fb.ok) {
            console.log(
              `✅ x402 fallback facilitator confirmed: ${fb.url} also supports ${env.X402_NETWORK}`,
            )
          } else {
            console.warn(
              `⚠️  x402 fallback facilitator (${fb.url}) does not support ${env.X402_NETWORK}: ${fb.reason}. ` +
                `Primary is healthy so this is non-fatal, but you have no redundancy.`,
            )
            failoverFacilitator = null
          }
        })
        .catch(() => {
          failoverFacilitator = null
        })
    }
    return
  }

  // Primary failed — try the fallback as the active.
  logger.warn('x402 primary facilitator probe failed', {
    url: primary.url,
    reason: primary.reason,
    supported: primary.supportedNetworks,
  })

  if (failoverFacilitator) {
    const fb = await probeFacilitator(failoverFacilitator)
    if (fb.ok) {
      activeFacilitator = fb.url
      cachedFeePayer = fb.feePayer
      failoverFacilitator = null // already promoted; no further failover
      console.warn(
        `⚠️  x402 PRIMARY facilitator (${primary.url}) failed probe: ${primary.reason}. ` +
          `Promoted fallback ${fb.url} to active (supports ${env.X402_NETWORK}, feePayer: ${fb.feePayer.slice(0, 8)}…).`,
      )
      return
    }
    logger.error('x402 fallback facilitator probe ALSO failed', {
      url: fb.url,
      reason: fb.reason,
      supported: fb.supportedNetworks,
    })
  }

  // Neither primary nor fallback advertises the configured network. Refuse
  // the boot in production so settlement reliability is a hard guarantee at
  // process start, not a runtime accident.
  const banner = [
    '',
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║  No x402 facilitator advertises support for the configured network  ║',
    '╚══════════════════════════════════════════════════════════════════════╝',
    '',
    `   Configured network: ${env.X402_NETWORK}`,
    `   Primary URL:        ${env.X402_FACILITATOR_URL}`,
    `   Fallback URL:       ${env.X402_FACILITATOR_FALLBACK_URL ?? '(none)'}`,
    '',
    '   Resolve one of:',
    `     - Set X402_FACILITATOR_URL to a facilitator that supports ${env.X402_NETWORK}`,
    '     - Set X402_NETWORK to a network the configured facilitator supports',
    '     - Set X402_ENABLED=false to run without x402 settlement',
    '',
    '   PayAI (https://facilitator.payai.network) advertises Solana mainnet',
    `   (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) with no API key required.`,
    '',
  ].join('\n')

  if (isProduction) {
    console.error(banner)
    process.exit(1)
  } else {
    console.warn(banner)
    console.warn(
      '   (Development mode — keeping server alive so you can iterate. ' +
        'This would fatal-exit in production.)',
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public surface used by the request path
// ─────────────────────────────────────────────────────────────────────────────

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
    network: env.X402_NETWORK,
    maxAmountRequired: String(Math.ceil(parseFloat(price) * 1_000_000)),
    resource,
    description: `MPP32 API access — $${price} USDC`,
    mimeType: 'application/json',
    payTo: recipientAddress,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {
      // Facilitator's fee-payer per the x402 `exact` SVM scheme. Resolved at
      // boot by validateFacilitatorAtBoot() against the active facilitator.
      feePayer: getSvmFeePayer(),
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
  facilitatorUsed?: string
}

export interface X402SettleResult {
  settled: boolean
  txSignature?: string
  payer?: string
  network?: string
  error?: string
  settleResponse?: Record<string, unknown>
  facilitatorUsed?: string
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
  if (e.network !== env.X402_NETWORK) {
    return {
      ok: false,
      error: `Payment must be on ${env.X402_NETWORK}, got "${e.network}"`,
    }
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

// Call a facilitator endpoint with per-request failover: primary first; if it
// errors at the transport layer or returns a 5xx, retry against the failover.
// Per-request state (which facilitator handled `/verify`) is returned so the
// caller can pin `/settle` to the same one.
async function callFacilitator(
  path: '/verify' | '/settle',
  body: unknown,
  preferred?: string,
): Promise<{ ok: true; data: Record<string, unknown>; facilitatorUsed: string } | { ok: false; error: string; facilitatorUsed: string }> {
  const order: string[] = []
  if (preferred) order.push(preferred)
  if (!order.includes(activeFacilitator)) order.push(activeFacilitator)
  if (failoverFacilitator && !order.includes(failoverFacilitator)) order.push(failoverFacilitator)

  let lastErr = 'no facilitator configured'
  let lastUrl = order[0] ?? activeFacilitator
  for (const url of order) {
    lastUrl = url
    try {
      const res = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        lastErr = `Facilitator ${path} returned ${res.status}: ${text.slice(0, 200)}`
        // Only failover on 5xx; 4xx is "your request was rejected" — failover
        // would just produce the same rejection.
        if (res.status >= 500) continue
        return { ok: false, error: lastErr, facilitatorUsed: url }
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return { ok: true, data, facilitatorUsed: url }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      // Transport-layer error → try the next facilitator.
      continue
    }
  }
  return { ok: false, error: lastErr, facilitatorUsed: lastUrl }
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

  const call = await callFacilitator('/verify', {
    payload: parsed.envelope,
    paymentRequirements: requirements,
  })
  if (!call.ok) {
    logger.warn('x402 verify failed', { error: call.error, facilitator: call.facilitatorUsed })
    return { verified: false, error: call.error, facilitatorUsed: call.facilitatorUsed }
  }

  const verifyResult = call.data as { isValid?: boolean; valid?: boolean; payer?: string; invalidReason?: string }
  const isValid = verifyResult.isValid ?? verifyResult.valid ?? false
  if (!isValid) {
    return {
      verified: false,
      error: verifyResult.invalidReason ?? 'Payment verification failed at facilitator',
      facilitatorUsed: call.facilitatorUsed,
    }
  }

  return {
    verified: true,
    payer: verifyResult.payer,
    envelope: parsed.envelope,
    requirements,
    facilitatorUsed: call.facilitatorUsed,
  }
}

export async function settleX402Payment(
  envelope: unknown,
  requirements: PaymentRequirements,
  preferredFacilitator?: string,
): Promise<X402SettleResult> {
  const call = await callFacilitator(
    '/settle',
    { payload: envelope, paymentRequirements: requirements },
    preferredFacilitator,
  )
  if (!call.ok) {
    logger.warn('x402 settle failed', { error: call.error, facilitator: call.facilitatorUsed })
    return { settled: false, error: call.error, facilitatorUsed: call.facilitatorUsed }
  }
  const settleJson = call.data
  const txSignature =
    (settleJson.txHash as string | undefined) ??
    (settleJson.transaction as string | undefined) ??
    (settleJson.signature as string | undefined) ??
    undefined
  const network =
    (settleJson.networkId as string | undefined) ??
    (settleJson.network as string | undefined) ??
    env.X402_NETWORK

  logger.info('x402 payment settled', {
    txSignature,
    resource: requirements.resource,
    facilitator: call.facilitatorUsed,
  })
  return {
    settled: true,
    txSignature,
    network,
    settleResponse: settleJson,
    facilitatorUsed: call.facilitatorUsed,
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

  const settleResult = await settleX402Payment(
    envelopeResult.envelope!,
    envelopeResult.requirements!,
    envelopeResult.facilitatorUsed,
  )
  if (!settleResult.settled) {
    return { verified: false, error: settleResult.error }
  }

  logger.info('x402 payment verified and settled', {
    resource,
    price,
    recipient: recipientAddress,
    txSignature: settleResult.txSignature,
    facilitator: settleResult.facilitatorUsed,
  })
  return {
    verified: true,
    txSignature: settleResult.txSignature,
    payer: envelopeResult.payer,
    network: settleResult.network,
    settleResponse: settleResult.settleResponse,
  }
}
