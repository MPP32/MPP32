import { Mppx, tempo } from 'mppx/hono'
import { createMiddleware } from 'hono/factory'
import { timingSafeEqual } from 'crypto'
import { env } from '../env.js'
import {
  isX402Enabled,
  isX402Request,
  getX402PaymentHeader,
  createX402Challenge,
  verifyX402Envelope,
  settleX402Payment,
} from './x402.js'
import { handleEscrowSettlement, buildEscrowHeaders } from './escrow.js'
import {
  isAP2Enabled,
  isAP2Request,
  getAP2MandateHeader,
  verifyAP2Mandate,
  createAP2Challenge,
} from './ap2.js'
import {
  isACPEnabled,
  isACPRequest,
  getACPSessionHeader,
  createACPChallenge,
  verifyACPSession,
} from './acp.js'
import {
  isAGTPEnabled,
  isAGTPRequest,
  getAGTPHeaders,
  getAGTPIntentMethod,
  getAGTPSignature,
  createAGTPChallenge,
  verifyAGTPAgent,
} from './agtp.js'
import { getM32Balance, calculateDiscount } from './solana-token.js'

// ---- MPP Payment Config ----

const secretKey = env.MPP_SECRET_KEY ?? (() => {
  if (env.NODE_ENV === 'production') {
    console.error('[mpp] FATAL: MPP_SECRET_KEY is required in production but is not set. Refusing to start.')
    process.exit(1)
  }
  console.warn('[mpp] MPP_SECRET_KEY not set — using insecure development fallback. NEVER deploy this way.')
  return 'mpp-default-secret-change-in-production'
})()

export const mppx = Mppx.create({
  secretKey,
  methods: [
    tempo.charge({
      currency: env.TEMPO_CURRENCY_ADDRESS as `0x${string}`,
      recipient: env.TEMPO_RECIPIENT_ADDRESS as `0x${string}`,
    }),
  ],
})

// ---- Universal Protocol Charge Middleware (Tempo + x402 + AP2 + ACP + AGTP) ----

// Tempo emits its own WWW-Authenticate header via mppx middleware. When
// TEMPO_ENABLED=false we must (a) suppress that header on outgoing 402s and
// (b) avoid invoking the Tempo charge middleware at all — otherwise it leaks
// a Tempo branch into a payments envelope that should only advertise x402.
export function isTempoEnabled(): boolean {
  return env.TEMPO_ENABLED === 'true'
}

function buildPaymentMethodsList(): string {
  const methods: string[] = []
  if (isTempoEnabled()) methods.push('tempo')
  if (isX402Enabled()) methods.push('x402')
  if (isACPEnabled()) methods.push('acp')
  if (isAP2Enabled()) methods.push('ap2')
  if (isAGTPEnabled()) methods.push('agtp')
  return methods.join(', ')
}

// Strip any Tempo-flavored headers that mppx might have set on a 402.
function stripTempoHeaders(headers: Headers) {
  headers.delete('WWW-Authenticate')
  headers.delete('Www-Authenticate')
}

function addProtocolChallenges(headers: Headers, resource: string, amount: string) {
  const x402Active = isX402Enabled()
  const ap2Active = isAP2Enabled()
  const acpActive = isACPEnabled()
  const agtpActive = isAGTPEnabled()

  if (!isTempoEnabled()) stripTempoHeaders(headers)

  headers.set('X-Payment-Methods', buildPaymentMethodsList())

  if (x402Active) {
    headers.set('Payment-Required', createX402Challenge(amount, env.X402_RECIPIENT_ADDRESS ?? '', resource))
  }
  if (ap2Active) {
    headers.set('X-AP2-Requirements', createAP2Challenge(resource))
    headers.set('X-AP2-Supported', 'true')
  }
  if (acpActive) {
    headers.set('X-ACP-Requirements', createACPChallenge(resource, amount))
    headers.set('X-ACP-Supported', 'true')
  }
  if (agtpActive) {
    headers.set('X-AGTP-Requirements', createAGTPChallenge(resource))
    headers.set('X-AGTP-Supported', 'true')
  }
}

// Build a stand-alone x402-only 402 response without invoking Tempo middleware.
// Used whenever TEMPO_ENABLED=false so nothing Tempo-shaped ends up on the wire.
function buildCleanPaymentRequired(resource: string, amount: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/problem+json',
    'Cache-Control': 'no-store',
  })
  addProtocolChallenges(headers, resource, amount)
  const body = JSON.stringify({
    type: 'https://x402.org/problems/payment-required',
    title: 'Payment Required',
    status: 402,
    detail: 'Payment is required. Sign the Payment-Required challenge and retry with the X-Payment header.',
  })
  return new Response(body, { status: 402, headers })
}

async function verifyAuthorizationLayers(c: any, amount: string) {
  const resource = new URL(c.req.url).pathname
  const ap2Active = isAP2Enabled()
  const agtpActive = isAGTPEnabled()

  // Layer 1: AP2 authorization
  if (isAP2Request(c) && ap2Active) {
    const mandateHeader = getAP2MandateHeader(c)!
    const ap2Result = await verifyAP2Mandate(mandateHeader, resource, amount)
    if (!ap2Result.verified) {
      return c.json(
        { error: { message: ap2Result.error ?? 'AP2 mandate verification failed', code: ap2Result.errorCode ?? 'AP2_INVALID_MANDATE' } },
        400,
      )
    }
    c.set('ap2MandateVerified' as never, true as never)
    c.set('ap2MandateType' as never, ap2Result.mandateType as never)
    c.set('ap2AgentId' as never, ap2Result.agentId as never)
  }

  if (!isAP2Request(c) && ap2Active && env.AP2_REQUIRE_MANDATE === 'true') {
    return c.json(
      { error: { message: 'AP2 mandate required for this endpoint', code: 'AP2_MANDATE_REQUIRED' } },
      400,
    )
  }

  // Layer 2: AGTP agent identity (requires cryptographic signature)
  if (isAGTPRequest(c) && agtpActive) {
    const agtpHeaders = getAGTPHeaders(c)
    if (agtpHeaders) {
      const signatureData = getAGTPSignature(c)
      const httpMethod = c.req.method
      const agtpResult = await verifyAGTPAgent(agtpHeaders, resource, amount, httpMethod, signatureData)
      if (!agtpResult.verified) {
        return c.json(
          { error: { message: agtpResult.error ?? 'AGTP agent verification failed', code: agtpResult.errorCode ?? 'AGTP_AGENT_UNVERIFIED' } },
          400,
        )
      }
      c.set('agtpVerified' as never, true as never)
      c.set('agtpAgentId' as never, (agtpResult.agentId ?? '') as never)
      c.set('agtpIntentMethod' as never, (getAGTPIntentMethod(c) ?? '') as never)
      c.set('agtpPrincipalId' as never, (agtpResult.principalId ?? '') as never)
    }
  }

  return null // no error
}

export function universalProtocolCharge(amount: string, recipientOverride?: string) {
  const x402Recipient = recipientOverride ?? env.X402_RECIPIENT_ADDRESS ?? ''
  const x402Active = isX402Enabled()
  const acpActive = isACPEnabled()
  const tempoActive = isTempoEnabled()
  // Tempo charge middleware is only created when we actually plan to use it.
  // Constructing it unconditionally previously caused Tempo's WWW-Authenticate
  // header to leak into Solana-only 402 envelopes.
  const tempoCharge = tempoActive ? mppx.charge({ amount }) : null

  return createMiddleware(async (c, next) => {
    // Authorization layers (AP2 + AGTP) — only run when those protocols are on.
    const authError = await verifyAuthorizationLayers(c, amount)
    if (authError) return authError

    const resource = new URL(c.req.url).pathname

    // Payment layer: ACP
    if (acpActive && isACPRequest(c)) {
      const sessionHeader = getACPSessionHeader(c)!
      const acpResult = await verifyACPSession(sessionHeader, resource, amount)
      if (!acpResult.verified) {
        return c.json(
          { error: { message: acpResult.error ?? 'ACP session verification failed', code: acpResult.errorCode ?? 'ACP_INVALID_SESSION' } },
          402,
        )
      }
      c.set('paymentMethod' as never, 'acp' as never)
      c.set('acpSessionId' as never, (acpResult.sessionId ?? '') as never)
      c.set('acpVerified' as never, true as never)
      await next()
      return
    }

    // Escrow-402: verify the x402 envelope first, run the handler, then settle
    // only if the handler returned a successful response.
    if (x402Active && isX402Request(c)) {
      const paymentHeader = getX402PaymentHeader(c)!
      const envelopeResult = await verifyX402Envelope(paymentHeader, amount, x402Recipient, resource)
      if (!envelopeResult.verified) {
        return c.json(
          { error: { message: envelopeResult.error ?? 'Payment verification failed', code: 'PAYMENT_FAILED' } },
          402,
        )
      }

      c.set('paymentMethod' as never, 'x402' as never)
      await next()

      const resStatus = c.res?.status ?? 500
      const escrowOutcome = await handleEscrowSettlement(
        resStatus,
        0,
        () => settleX402Payment(envelopeResult.envelope!, envelopeResult.requirements!),
      )

      const escrowHeaders = buildEscrowHeaders(escrowOutcome)
      for (const [k, v] of Object.entries(escrowHeaders)) {
        c.res.headers.set(k, v)
      }
      if (escrowOutcome.escrowStatus === 'settled' && escrowOutcome.txSignature) {
        c.set('settlementTxSignature' as never, (escrowOutcome.txSignature ?? '') as never)
        c.res.headers.set('X-Payment-Response', Buffer.from(JSON.stringify({
          method: 'x402',
          txSignature: escrowOutcome.txSignature,
          payer: envelopeResult.payer,
          network: escrowOutcome.network,
          amount,
        })).toString('base64'))
      }
      return
    }

    // Payment layer: Tempo (only when explicitly enabled)
    const hasTempoAuth = !!c.req.header('authorization')?.startsWith('Payment ')
    if (tempoActive && tempoCharge && hasTempoAuth) {
      c.set('paymentMethod' as never, 'tempo' as never)
      c.header('X-Settlement-Method', 'tempo')
      return tempoCharge(c, next)
    }

    // No payment — return 402 with only the enabled protocols' challenges.
    if (tempoActive && tempoCharge) {
      const tempoResponse = await tempoCharge(c, async () => {})
      if (tempoResponse instanceof Response && tempoResponse.status === 402) {
        const headers = new Headers(tempoResponse.headers)
        addProtocolChallenges(headers, resource, amount)
        return new Response(tempoResponse.body, { status: 402, headers })
      }
      return tempoResponse
    }
    return buildCleanPaymentRequired(resource, amount)
  })
}

export const dualProtocolCharge = universalProtocolCharge

// SECURITY: This used to read `x-wallet-address` from the request and apply a
// 20–40% discount based on M32 balance — but that header is spoofable, so
// anyone could claim the discount by sending someone else's wallet. The
// discount is gated behind M32_DISCOUNT_ENABLED until SIWS wallet-signature
// verification ships and we can require proof of ownership.
export function universalProtocolChargeWithDiscount(baseAmount: string) {
  return createMiddleware(async (c, next) => {
    const wallet = c.req.header('x-wallet-address')
    let effectiveAmount = baseAmount
    let discountPercent = 0

    if (wallet && env.M32_DISCOUNT_ENABLED === 'true') {
      // ⚠ This path will only be reachable once SIWS is wired up. Until then,
      // the env gate keeps it off.
      const balance = await getM32Balance(wallet)
      const result = calculateDiscount(balance, baseAmount)
      effectiveAmount = result.discountedPrice
      discountPercent = result.discountPercent
    }

    const charge = universalProtocolCharge(effectiveAmount)
    const response = await charge(c, next)

    if (response instanceof Response) {
      response.headers.set('X-M32-Discount', String(discountPercent))
      return response
    }

    c.header('X-M32-Discount', String(discountPercent))
  })
}

export const dualProtocolChargeWithDiscount = universalProtocolChargeWithDiscount

export function universalProtocolChargeForProxy(
  mppInstance: ReturnType<typeof Mppx.create>,
  amount: string,
  x402Recipient: string,
) {
  const x402Active = isX402Enabled()
  const acpActive = isACPEnabled()
  const tempoActive = isTempoEnabled()
  const tempoCharge = tempoActive ? (mppInstance as any).charge({ amount }) : null

  return createMiddleware(async (c, next) => {
    const authError = await verifyAuthorizationLayers(c, amount)
    if (authError) return authError

    const resource = new URL(c.req.url).pathname

    if (acpActive && isACPRequest(c)) {
      const sessionHeader = getACPSessionHeader(c)!
      const acpResult = await verifyACPSession(sessionHeader, resource, amount)
      if (!acpResult.verified) {
        return c.json(
          { error: { message: acpResult.error ?? 'ACP session verification failed', code: acpResult.errorCode ?? 'ACP_INVALID_SESSION' } },
          402,
        )
      }
      c.set('paymentMethod' as never, 'acp' as never)
      c.set('acpSessionId' as never, (acpResult.sessionId ?? '') as never)
      c.set('acpVerified' as never, true as never)
      await next()
      return
    }

    if (x402Active && isX402Request(c)) {
      const paymentHeader = getX402PaymentHeader(c)!
      const envelopeResult = await verifyX402Envelope(paymentHeader, amount, x402Recipient, resource)
      if (!envelopeResult.verified) {
        return c.json(
          { error: { message: envelopeResult.error ?? 'Payment verification failed', code: 'PAYMENT_FAILED' } },
          402,
        )
      }
      c.set('paymentMethod' as never, 'x402' as never)
      await next()

      const resStatus = c.res?.status ?? 500
      const escrowOutcome = await handleEscrowSettlement(
        resStatus,
        0,
        () => settleX402Payment(envelopeResult.envelope!, envelopeResult.requirements!),
      )
      const escrowHeaders = buildEscrowHeaders(escrowOutcome)
      for (const [k, v] of Object.entries(escrowHeaders)) {
        c.res.headers.set(k, v)
      }
      return
    }

    const hasTempoAuth = !!c.req.header('authorization')?.startsWith('Payment ')
    if (tempoActive && tempoCharge && hasTempoAuth) {
      c.set('paymentMethod' as never, 'tempo' as never)
      return tempoCharge(c, next)
    }

    if (tempoActive && tempoCharge) {
      const tempoResponse = await tempoCharge(c, async () => {})
      if (tempoResponse instanceof Response && tempoResponse.status === 402) {
        const headers = new Headers(tempoResponse.headers)
        addProtocolChallenges(headers, resource, amount)
        return new Response(tempoResponse.body, { status: 402, headers })
      }
      return tempoResponse
    }
    return buildCleanPaymentRequired(resource, amount)
  })
}

export const dualProtocolChargeForProxy = universalProtocolChargeForProxy

// ---- Structured Logger ----

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? LEVELS.info

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
}

// ---- Rate Limiter ----

interface RateWindow { count: number; resetAt: number }
const stores = new Map<string, Map<string, RateWindow>>()

function getStore(name: string): Map<string, RateWindow> {
  let store = stores.get(name)
  if (!store) { store = new Map(); stores.set(name, store) }
  return store
}

setInterval(() => {
  const now = Date.now()
  for (const store of stores.values()) {
    for (const [key, w] of store) { if (w.resetAt <= now) store.delete(key) }
  }
}, 5 * 60 * 1000)

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export function rateLimit(opts: { name: string; max: number; windowMs: number }) {
  const store = getStore(opts.name)
  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c)
    const now = Date.now()
    let w = store.get(ip)
    if (!w || w.resetAt <= now) { w = { count: 0, resetAt: now + opts.windowMs }; store.set(ip, w) }
    w.count++

    c.header('X-RateLimit-Limit', String(opts.max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.max - w.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(w.resetAt / 1000)))

    if (w.count > opts.max) {
      const retryAfter = Math.ceil((w.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        { error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' } },
        429,
      )
    }
    await next()
  })
}

// Rate limit keyed off the X-Agent-Key header (per-session) instead of IP.
// Falls back to IP if no key present so unauthenticated requests still get limited.
export function rateLimitByKey(opts: { name: string; max: number; windowMs: number; headerName?: string }) {
  const store = getStore(opts.name)
  const headerName = opts.headerName ?? 'x-agent-key'
  return createMiddleware(async (c, next) => {
    const headerKey = c.req.header(headerName)
    const key = headerKey ? `key:${headerKey}` : `ip:${getClientIp(c)}`
    const now = Date.now()
    let w = store.get(key)
    if (!w || w.resetAt <= now) { w = { count: 0, resetAt: now + opts.windowMs }; store.set(key, w) }
    w.count++

    c.header('X-RateLimit-Limit', String(opts.max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.max - w.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(w.resetAt / 1000)))

    if (w.count > opts.max) {
      const retryAfter = Math.ceil((w.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        { error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' } },
        429,
      )
    }
    await next()
  })
}

// ---- Admin Secret Verification (timing-safe) ----

export function verifyAdminSecret(provided: string | undefined): boolean {
  const expected = process.env.MPP_SECRET_KEY
  if (!provided || !expected) return false
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}
