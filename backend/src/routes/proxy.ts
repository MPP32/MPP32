import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/hono'
import { createHash } from 'crypto'
import { env } from '../env.js'
import { mppx as _mppxRef, logger, rateLimit } from '../lib/mpp.js'
import { prisma } from '../lib/db.js'
import { isX402Enabled, isX402Request, getX402PaymentHeader, createX402Challenge, verifyX402Envelope, settleX402Payment, type PaymentRequirements } from '../lib/x402.js'
import { handleEscrowSettlement, buildEscrowHeaders, type EscrowSettlementOutcome } from '../lib/escrow.js'
import { isAP2Enabled, isAP2Request, getAP2MandateHeader, verifyAP2Mandate, createAP2Challenge } from '../lib/ap2.js'
import { isACPEnabled, isACPRequest, getACPSessionHeader, createACPChallenge, verifyACPSession } from '../lib/acp.js'
import { isAGTPEnabled, isAGTPRequest, getAGTPHeaders, getAGTPIntentMethod, createAGTPChallenge, verifyAGTPAgent } from '../lib/agtp.js'
import { checkUrlForSsrf } from '../lib/ssrf.js'

const MAX_BODY_BYTES = 1_048_576 // 1 MB

type MppxWrap = typeof _mppxRef

const mppxCache = new Map<string, MppxWrap>()

function getMppxInstance(slug: string, paymentAddress: string, price: number): MppxWrap {
  const key = `${slug}:${price}:${paymentAddress}`
  if (mppxCache.size > 1000) {
    const firstKey = mppxCache.keys().next().value
    if (firstKey) mppxCache.delete(firstKey)
  }
  if (mppxCache.has(key)) return mppxCache.get(key)!

  const secretKey = env.MPP_SECRET_KEY ?? (() => {
    console.warn('[proxy] MPP_SECRET_KEY not set — using insecure default')
    return 'mpp-default-secret-change-in-production'
  })()

  const instance = Mppx.create({
    secretKey,
    methods: [
      tempo.charge({
        currency: env.TEMPO_CURRENCY_ADDRESS as `0x${string}`,
        recipient: paymentAddress as `0x${string}`,
      }),
    ],
  }) as unknown as MppxWrap

  mppxCache.set(key, instance)
  return instance
}

// Idempotency cache: key -> { response body, status, contentType, expiresAt }
// Bounded with LRU eviction so a flood of unique idempotency keys cannot
// exhaust process memory. Map preserves insertion order, so we promote
// entries to MRU on read by re-inserting them.
interface CachedResponse {
  body: string
  status: number
  contentType: string
  expiresAt: number
}
const IDEMPOTENCY_CACHE_MAX = 5_000
const idempotencyCache = new Map<string, CachedResponse>()

function idempotencyGet(key: string): CachedResponse | undefined {
  const entry = idempotencyCache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    idempotencyCache.delete(key)
    return undefined
  }
  // Promote to most-recently-used by re-inserting.
  idempotencyCache.delete(key)
  idempotencyCache.set(key, entry)
  return entry
}

function idempotencySet(key: string, value: CachedResponse): void {
  if (idempotencyCache.has(key)) idempotencyCache.delete(key)
  idempotencyCache.set(key, value)
  while (idempotencyCache.size > IDEMPOTENCY_CACHE_MAX) {
    const oldest = idempotencyCache.keys().next().value
    if (!oldest) break
    idempotencyCache.delete(oldest)
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt <= now) idempotencyCache.delete(key)
  }
}, 60_000)

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504])

const proxyRouter = new Hono()

// GET /api/proxy/:slug/info — returns service info without requiring payment
proxyRouter.get('/:slug/info', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      category: true,
      pricePerQuery: true,
      paymentAddress: true,
      solanaAddress: true,
      creatorName: true,
      logoUrl: true,
      status: true,
      queryCount: true,
      isVerified: true,
    },
  })

  if (!submission || !['approved', 'featured'].includes(submission.status)) {
    return c.json({ error: { message: 'Service not found', code: 'NOT_FOUND' } }, 404)
  }

  return c.json({
    data: {
      name: submission.name,
      slug: submission.slug,
      shortDescription: submission.shortDescription,
      category: submission.category,
      pricePerQuery: submission.pricePerQuery,
      paymentAddress: submission.paymentAddress,
      solanaAddress: submission.solanaAddress,
      creatorName: submission.creatorName,
      logoUrl: submission.logoUrl,
      queryCount: submission.queryCount,
      isVerified: submission.isVerified,
    },
  })
})

// ALL /api/proxy/:slug — the actual MPP-gated proxy
proxyRouter.all(
  '/:slug',
  rateLimit({ name: 'proxy', max: 60, windowMs: 60_000 }),
  async (c) => {
    const requestId = c.get('requestId') ?? 'unknown'
    const startTime = Date.now()
    const slug = c.req.param('slug')
    const clientIp = getClientIp(c)
    const ipHashed = hashIp(clientIp)

    const submission = await prisma.submission.findUnique({ where: { slug } })

    if (!submission || !['approved', 'featured'].includes(submission.status)) {
      return c.json({ error: { message: 'Service not found', code: 'NOT_FOUND' } }, 404)
    }

    if (!submission.isVerified) {
      return c.json(
        { error: { message: 'This service has not completed endpoint verification', code: 'ENDPOINT_UNVERIFIED' } },
        403
      )
    }

    if (!submission.endpointUrl) {
      return c.json(
        { error: { message: 'This service has no endpoint configured', code: 'NO_ENDPOINT' } },
        422
      )
    }

    // SSRF guard: a malicious or compromised submission could point at
    // 169.254.169.254 (cloud metadata), localhost, or RFC1918 space. Re-check
    // on every request — admins approve URLs once, but DNS can drift, and
    // we cannot trust `isVerified` to cover this.
    const ssrf = checkUrlForSsrf(submission.endpointUrl)
    if (!ssrf.ok) {
      logger.warn('Proxy SSRF guard rejected endpointUrl', {
        requestId,
        slug,
        endpointUrl: submission.endpointUrl,
        reason: ssrf.reason,
      })
      return c.json(
        { error: { message: `Endpoint URL is not allowed: ${ssrf.reason}`, code: 'ENDPOINT_BLOCKED' } },
        422
      )
    }

    if (!submission.paymentAddress) {
      return c.json(
        { error: { message: 'This service has no payment address configured', code: 'NO_PAYMENT_ADDRESS' } },
        422
      )
    }

    const price = submission.pricePerQuery ?? 0.001
    const x402Active = isX402Enabled()
    const x402Recipient = submission.solanaAddress ?? env.X402_RECIPIENT_ADDRESS ?? ''
    const ap2Active = isAP2Enabled()
    const acpActive = isACPEnabled()
    const agtpActive = isAGTPEnabled()

    // Payment challenge FIRST — before body validation (MPPScan requirement)
    const hasTempoAuth = !!c.req.header('authorization')?.startsWith('Payment ')
    const hasX402Auth = isX402Request(c)
    const hasAP2Auth = isAP2Request(c)
    const hasACPAuth = isACPRequest(c)
    const hasAGTPAuth = isAGTPRequest(c)
    const hasAuth = hasTempoAuth || hasX402Auth || (hasACPAuth && acpActive)

    // Authorization layers: AP2 + AGTP (identity/auth, not payment)
    let ap2MandateType: string | null = null
    let ap2MandateVerified = false
    let ap2AgentId: string | null = null
    let acpSessionId: string | null = null
    let acpVerified = false
    let agtpIntentMethod: string | null = null
    let agtpAgentCertId: string | null = null
    let agtpVerified = false
    let protocolUsed: string | null = null

    // Layer 1: AP2 authorization
    if (hasAP2Auth && ap2Active) {
      const mandateHeader = getAP2MandateHeader(c)!
      const resource = new URL(c.req.url).pathname
      const ap2Result = await verifyAP2Mandate(mandateHeader, resource, String(price))
      if (!ap2Result.verified) {
        logApiRequest(requestId, slug, c.req.method, 400, Date.now() - startTime, false, ap2Result.errorCode ?? 'AP2_INVALID_MANDATE', ipHashed, null, false, null, null, false, null, null, false, null)
        return c.json(
          { error: { message: ap2Result.error ?? 'AP2 mandate verification failed', code: ap2Result.errorCode ?? 'AP2_INVALID_MANDATE' } },
          400,
        )
      }
      ap2MandateType = ap2Result.mandateType ?? null
      ap2MandateVerified = true
      ap2AgentId = ap2Result.agentId ?? null
    }

    if (!hasAP2Auth && ap2Active && env.AP2_REQUIRE_MANDATE === 'true') {
      logApiRequest(requestId, slug, c.req.method, 400, Date.now() - startTime, false, 'AP2_MANDATE_REQUIRED', ipHashed, null, false, null, null, false, null, null, false, null)
      return c.json(
        { error: { message: 'AP2 mandate required for this endpoint', code: 'AP2_MANDATE_REQUIRED' } },
        400,
      )
    }

    // Layer 2: AGTP agent identity
    if (hasAGTPAuth && agtpActive) {
      const agtpHeaders = getAGTPHeaders(c)
      if (agtpHeaders) {
        const resource = new URL(c.req.url).pathname
        const agtpResult = await verifyAGTPAgent(agtpHeaders, resource, String(price))
        if (!agtpResult.verified) {
          logApiRequest(requestId, slug, c.req.method, 400, Date.now() - startTime, false, agtpResult.errorCode ?? 'AGTP_AGENT_UNVERIFIED', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, null, false, null, null, false, null)
          return c.json(
            { error: { message: agtpResult.error ?? 'AGTP agent verification failed', code: agtpResult.errorCode ?? 'AGTP_AGENT_UNVERIFIED' } },
            400,
          )
        }
        agtpIntentMethod = getAGTPIntentMethod(c)
        agtpAgentCertId = agtpResult.agentId ?? null
        agtpVerified = true
      }
    }

    // Layer 3: ACP payment
    if (hasACPAuth && acpActive) {
      const sessionHeader = getACPSessionHeader(c)!
      const resource = new URL(c.req.url).pathname
      const acpResult = await verifyACPSession(sessionHeader, resource, String(price))
      if (!acpResult.verified) {
        logApiRequest(requestId, slug, c.req.method, 402, Date.now() - startTime, false, acpResult.errorCode ?? 'ACP_INVALID_SESSION', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, null, false, agtpIntentMethod, agtpAgentCertId, agtpVerified, null)
        return c.json(
          { error: { message: acpResult.error ?? 'ACP session verification failed', code: acpResult.errorCode ?? 'ACP_INVALID_SESSION' } },
          402,
        )
      }
      acpSessionId = acpResult.sessionId ?? null
      acpVerified = true
      protocolUsed = 'acp'
    }

    let mppInstance: ReturnType<typeof getMppxInstance>
    try {
      mppInstance = getMppxInstance(submission.slug, submission.paymentAddress, price)
    } catch (err) {
      logger.error('Failed to create mppx instance', { requestId, slug, error: String(err) })
      return c.json(
        { error: { message: 'Invalid payment address configuration', code: 'INVALID_PAYMENT_ADDRESS' } },
        422
      )
    }

    // Escrow-402: verify the x402 envelope but DO NOT settle yet.
    // Settlement is deferred until after the upstream response passes quality checks.
    let escrowHold: { envelope: unknown; requirements: PaymentRequirements; payer?: string } | null = null
    if (hasX402Auth && x402Active) {
      const paymentHeader = getX402PaymentHeader(c)!
      const resource = new URL(c.req.url).pathname
      const result = await verifyX402Envelope(paymentHeader, String(price), x402Recipient, resource)
      if (!result.verified) {
        logApiRequest(requestId, slug, c.req.method, 402, Date.now() - startTime, false, 'X402_PAYMENT_FAILED', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, null, null, null)
        return c.json(
          { error: { message: result.error ?? 'x402 payment verification failed', code: 'PAYMENT_FAILED' } },
          402,
        )
      }
      escrowHold = { envelope: result.envelope!, requirements: result.requirements!, payer: result.payer }
      protocolUsed = 'x402'
    }

    // If no auth header, return 402 challenge with all protocol headers
    if (!hasAuth) {
      const chargeMiddleware = mppInstance.charge({ amount: String(price) })
      const tempoResponse = await chargeMiddleware(c, async () => {})
      if (tempoResponse instanceof Response && tempoResponse.status === 402) {
        const headers = new Headers(tempoResponse.headers)
        const resource = new URL(c.req.url).pathname
        const methods = ['tempo']
        if (x402Active) {
          methods.push('x402')
          headers.set('Payment-Required', createX402Challenge(String(price), x402Recipient, resource))
        }
        if (acpActive) {
          methods.push('acp')
          headers.set('X-ACP-Requirements', createACPChallenge(resource, String(price)))
          headers.set('X-ACP-Supported', 'true')
        }
        if (ap2Active) methods.push('ap2')
        if (agtpActive) methods.push('agtp')
        headers.set('X-Payment-Methods', methods.join(', '))
        if (ap2Active) {
          headers.set('X-AP2-Requirements', createAP2Challenge(resource))
          headers.set('X-AP2-Supported', 'true')
        }
        if (agtpActive) {
          headers.set('X-AGTP-Requirements', createAGTPChallenge(resource))
          headers.set('X-AGTP-Supported', 'true')
        }
        logApiRequest(requestId, slug, c.req.method, 402, Date.now() - startTime, false, 'PAYMENT_REQUIRED', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, null)
        return new Response(tempoResponse.body, { status: 402, headers })
      }
      return tempoResponse
    }

    // Body size limit enforcement (only after payment auth is present)
    const contentLength = c.req.header('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return c.json(
        { error: { message: 'Request body too large. Maximum size is 1MB.', code: 'PAYLOAD_TOO_LARGE' } },
        413
      )
    }

    const bodyText = c.req.method !== 'GET' && c.req.method !== 'HEAD'
      ? await c.req.text()
      : undefined

    if (bodyText && bodyText.length > MAX_BODY_BYTES) {
      return c.json(
        { error: { message: 'Request body too large. Maximum size is 1MB.', code: 'PAYLOAD_TOO_LARGE' } },
        413
      )
    }

    // Idempotency: check cache before charging
    let idempotencyKey = c.req.header('idempotency-key')
    if (idempotencyKey) {
      const cacheKey = `${slug}:${idempotencyKey}`
      const cached = idempotencyGet(cacheKey)
      if (cached) {
        logger.info('Idempotency cache hit', { requestId, slug, idempotencyKey })
        return new Response(cached.body, {
          status: cached.status,
          headers: {
            'Content-Type': cached.contentType,
            'X-MPP32-Proxied': '1',
            'X-MPP32-Idempotent': '1',
            'X-Request-ID': requestId,
          },
        })
      }
    }

    let proxyResult: Response | null = null
    let paymentVerified = hasX402Auth || acpVerified
    let upstreamMeta: { status: number; bodyLength: number } | null = null

    async function doProxy() {
      paymentVerified = true
      if (!protocolUsed) protocolUsed = 'tempo'

      // Auto-generate idempotency key for all paid requests so they get retry protection
      if (!idempotencyKey) {
        idempotencyKey = `auto-${crypto.randomUUID()}`
        logger.info('Auto-generated idempotency key for paid request', { requestId, slug, idempotencyKey })
      }

      const incomingUrl = new URL(c.req.url)
      const target = new URL(submission!.endpointUrl!)
      for (const [key, value] of incomingUrl.searchParams.entries()) {
        target.searchParams.append(key, value)
      }

      const incomingXff = c.req.header('x-forwarded-for')
      const directClientIp =
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-real-ip') ??
        'unknown'
      const outgoingXff = incomingXff
        ? `${incomingXff}, ${directClientIp}`
        : directClientIp

      const forwardedHost =
        c.req.header('x-forwarded-host') ?? incomingUrl.host
      const forwardedProto =
        c.req.header('x-forwarded-proto') ?? incomingUrl.protocol.replace(':', '')

      const fetchOpts: RequestInit & { signal: AbortSignal } = {
        method: c.req.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Forwarded-By': 'mpp32-proxy',
          'X-MPP32-Service': slug,
          'X-Forwarded-For': outgoingXff,
          'X-Forwarded-Host': forwardedHost,
          'X-Forwarded-Proto': forwardedProto,
        },
        body: bodyText ?? undefined,
        signal: AbortSignal.timeout(10_000),
      }

      // Attempt upstream request with one retry for transient failures
      let upstream: Response | null = null
      let lastError: unknown = null

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          upstream = await fetch(target.toString(), fetchOpts)
          if (!RETRYABLE_STATUSES.has(upstream.status) || attempt === 1) break
          // Retryable status — only retry GET or requests with idempotency key
          if (c.req.method !== 'GET' && !idempotencyKey) break
          logger.warn('Retrying upstream request', {
            requestId, slug, attempt, status: upstream.status,
          })
          await new Promise((r) => setTimeout(r, 500))
        } catch (err: unknown) {
          lastError = err
          if (attempt === 0 && (c.req.method === 'GET' || idempotencyKey)) {
            logger.warn('Retrying after upstream error', { requestId, slug, attempt, error: String(err) })
            await new Promise((r) => setTimeout(r, 500))
            continue
          }
          break
        }
      }

      if (!upstream) {
        const message = lastError instanceof Error && lastError.name === 'TimeoutError'
          ? 'Upstream service timed out'
          : 'Upstream service is unreachable'
        const errorCode = 'UPSTREAM_ERROR'
        logger.error('Upstream failure', { requestId, slug, error: String(lastError) })

        logApiRequest(requestId, slug, c.req.method, 502, Date.now() - startTime, paymentVerified, errorCode, ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, protocolUsed)

        proxyResult = new Response(
          JSON.stringify({ error: { message, code: errorCode } }),
          { status: 502, headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
        )
        return
      }

      // Async query count increment
      prisma.submission
        .update({
          where: { id: submission!.id },
          data: { queryCount: { increment: 1 }, lastQueriedAt: new Date() },
        })
        .catch((e) => logger.error('Failed to update queryCount', { requestId, slug, error: String(e) }))

      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      const responseBody = await upstream.text()
      upstreamMeta = { status: upstream.status, bodyLength: responseBody.length }

      // Cache for idempotency (only cache non-5xx responses)
      if (idempotencyKey && upstream.status < 500) {
        idempotencySet(`${slug}:${idempotencyKey}`, {
          body: responseBody,
          status: upstream.status,
          contentType,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })
      }

      if (!escrowHold) {
        logApiRequest(requestId, slug, c.req.method, upstream.status, Date.now() - startTime, paymentVerified, null, ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, protocolUsed)
      }

      proxyResult = new Response(responseBody, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'X-MPP32-Proxied': '1',
          'X-Request-ID': requestId,
        },
      })
    }

    // x402 or ACP path: already verified above, go straight to proxy
    if (hasX402Auth || acpVerified) {
      await doProxy()

      // Escrow-402: conditionally settle x402 payment based on upstream quality.
      // TS cannot track proxyResult/upstreamMeta across the doProxy() closure, so
      // we cast explicitly — doProxy() always sets these on a non-error path.
      let escrowOutcome: EscrowSettlementOutcome | null = null
      const currentProxy = proxyResult as Response | null
      if (escrowHold && currentProxy) {
        const hold = escrowHold
        const meta = upstreamMeta as { status: number; bodyLength: number } | null
        escrowOutcome = await handleEscrowSettlement(
          meta?.status ?? 0,
          meta?.bodyLength ?? 0,
          () => settleX402Payment(hold.envelope, hold.requirements),
        )
        paymentVerified = escrowOutcome.escrowStatus === 'settled'

        const escrowHeaders = buildEscrowHeaders(escrowOutcome)
        const newHeaders = new Headers(currentProxy.headers)
        for (const [k, v] of Object.entries(escrowHeaders)) newHeaders.set(k, v)
        proxyResult = new Response(currentProxy.clone().body, { status: currentProxy.status, headers: newHeaders })
      }

      if (proxyResult) {
        logApiRequest(requestId, slug, c.req.method, proxyResult.status, Date.now() - startTime, paymentVerified, null, ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, protocolUsed, escrowOutcome?.escrowStatus ?? null, escrowOutcome?.skipReason ?? null)
        return proxyResult
      }
      logApiRequest(requestId, slug, c.req.method, 500, Date.now() - startTime, paymentVerified, 'PROXY_ERROR', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, protocolUsed, null, null)
      return c.json({ error: { message: 'Proxy error', code: 'PROXY_ERROR' } }, 500)
    }

    // Tempo path: verify payment then proxy
    const chargeMiddleware = mppInstance.charge({ amount: String(price) })
    const chargeResult = await chargeMiddleware(c, doProxy)

    if (chargeResult instanceof Response) {
      logApiRequest(requestId, slug, c.req.method, 402, Date.now() - startTime, false, 'PAYMENT_REQUIRED', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, null)
      return chargeResult
    }
    if (proxyResult) return proxyResult

    logApiRequest(requestId, slug, c.req.method, 500, Date.now() - startTime, paymentVerified, 'PROXY_ERROR', ipHashed, ap2MandateType, ap2MandateVerified, ap2AgentId, acpSessionId, acpVerified, agtpIntentMethod, agtpAgentCertId, agtpVerified, protocolUsed)
    return c.json({ error: { message: 'Proxy error', code: 'PROXY_ERROR' } }, 500)
  }
)

function logApiRequest(
  requestId: string,
  submissionSlug: string,
  method: string,
  statusCode: number,
  latencyMs: number,
  paymentVerified: boolean,
  errorCode: string | null,
  ipHash: string,
  ap2MandateType?: string | null,
  ap2MandateVerified?: boolean,
  ap2AgentId?: string | null,
  acpSessionId?: string | null,
  acpVerified?: boolean,
  agtpIntentMethod?: string | null,
  agtpAgentCertId?: string | null,
  agtpVerified?: boolean,
  protocolUsed?: string | null,
  escrowStatus?: string | null,
  escrowSkipReason?: string | null,
) {
  prisma.apiRequest
    .create({
      data: {
        requestId, submissionSlug, method, statusCode, latencyMs, paymentVerified, errorCode, ipHash,
        ap2MandateType: ap2MandateType ?? null,
        ap2MandateVerified: ap2MandateVerified ?? false,
        ap2AgentId: ap2AgentId ?? null,
        acpSessionId: acpSessionId ?? null,
        acpVerified: acpVerified ?? false,
        agtpIntentMethod: agtpIntentMethod ?? null,
        agtpAgentCertId: agtpAgentCertId ?? null,
        agtpVerified: agtpVerified ?? false,
        protocolUsed: protocolUsed ?? null,
        escrowStatus: escrowStatus ?? null,
        escrowSkipReason: escrowSkipReason ?? null,
      },
    })
    .catch((e) => logger.error('Failed to log API request', { requestId, error: String(e) }))
}

export { proxyRouter }
