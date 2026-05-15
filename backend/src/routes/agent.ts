import { Hono } from 'hono'
import { z } from 'zod'
import { createHash } from 'crypto'
import { prisma } from '../lib/db.js'
import { rateLimit, rateLimitByKey, logger } from '../lib/mpp.js'
import {
  getProtocolStatuses,
  getEnabledProtocols,
  getQuote,
  selectOptimalProtocol,
  type ProtocolId,
} from '../lib/agent-router.js'
import { getM32Balance, calculateDiscount, type DiscountResult } from '../lib/solana-token.js'
import { M32_EXCLUSIVE_APIS } from '../lib/m32-gate.js'
import { checkUrlForSsrf } from '../lib/ssrf.js'
import { env } from '../env.js'

const agentRouter = new Hono()

const CreateSessionSchema = z.object({
  agentId: z.string().min(1).max(256),
  agentName: z.string().max(100).optional(),
  walletAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).optional(),
  preferredProtocol: z.enum(['tempo', 'x402', 'acp', 'ap2', 'agtp']).optional(),
  budgetLimitUsd: z.number().positive().max(1_000_000).optional(),
  velocityLimitUsd: z.number().positive().max(1_000_000).optional(),
  alertThresholdPercent: z.number().int().min(1).max(100).optional(),
})

const UpdateBudgetSchema = z.object({
  budgetLimitUsd: z.number().positive().max(1_000_000).nullable().optional(),
  velocityLimitUsd: z.number().positive().max(1_000_000).nullable().optional(),
  alertThresholdPercent: z.number().int().min(1).max(100).nullable().optional(),
})

const QuoteRequestSchema = z.object({
  service: z.string().min(1),
  walletAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).optional(),
  capabilities: z.array(z.enum(['tempo', 'x402', 'acp', 'ap2', 'agtp'])).optional(),
  preferredProtocol: z.enum(['tempo', 'x402', 'acp', 'ap2', 'agtp']).optional(),
})

const ExecuteRequestSchema = z.object({
  service: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
  // Path appended to the resolved service base URL for external entries that
  // store only a base URL (e.g. https://api.exa.ai with path /search). For
  // native services that already store a full path, this is ignored.
  // Must start with `/`, no `..` segments, no schemes.
  path: z
    .string()
    .max(2048)
    .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/\-?#]*$/, 'Path must start with "/" and contain only URL-safe characters')
    .refine((p) => !p.includes('..'), 'Path must not contain ".."')
    .refine((p) => !/^\/{2,}/.test(p), 'Path must not start with multiple slashes')
    .optional(),
  body: z.any().optional(),
  query: z.record(z.string(), z.string()).optional(),
  protocol: z.enum(['tempo', 'x402', 'acp', 'ap2', 'agtp']).optional(),
})

agentRouter.use('*', rateLimit({ name: 'agent', max: 240, windowMs: 60_000 }))

// GET /wallet-balance?wallet=... — preview-only M32 balance + projected discount.
// Lets users check eligibility *before* creating a session. Discounts only
// activate after SIWS verification, so the response is informational.
agentRouter.get('/wallet-balance', async (c) => {
  const wallet = c.req.query('wallet')?.trim()
  if (!wallet) {
    return c.json({ error: { message: 'wallet query parameter is required', code: 'VALIDATION_ERROR' } }, 400)
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return c.json({ error: { message: 'Invalid Solana wallet address', code: 'INVALID_WALLET' } }, 400)
  }

  let m32Balance = 0
  let lookupFailed = false
  try {
    m32Balance = await getM32Balance(wallet)
  } catch {
    lookupFailed = true
  }
  const d = calculateDiscount(m32Balance, env.MPP_PRICE)

  return c.json({
    data: {
      wallet,
      m32Balance,
      projectedDiscountPercent: d.discountPercent,
      tier: d.discountPercent === 40 ? '1M+' : d.discountPercent === 20 ? '250K+' : 'none',
      walletVerified: false,
      discountActive: false,
      lookupFailed,
      note: 'Preview only. Discounts activate after SIWS wallet-signature verification (on the roadmap).',
    },
  })
})

// GET /protocols — list all protocols and their status
agentRouter.get('/protocols', (c) => {
  const protocols = getProtocolStatuses()
  const enabled = getEnabledProtocols()
  return c.json({
    data: {
      protocols,
      enabledCount: enabled.length,
      totalCount: 5,
      recommendation: selectOptimalProtocol().reasoning,
    },
  })
})

// POST /sessions — create an agent session.
// NOTE: walletAddress is stored UNVERIFIED until SIWS lands. Discounts only apply
// when the wallet ownership has been signature-verified (walletVerified=true).
agentRouter.post('/sessions', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { message: 'Invalid request', code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } }, 400)
  }

  const { agentId, agentName, walletAddress, preferredProtocol, budgetLimitUsd, velocityLimitUsd, alertThresholdPercent } = parsed.data

  // Plaintext API key is returned to the caller exactly once and never stored.
  // We persist only the sha256 hash so a database leak does not yield live keys.
  const apiKey = `mpp32_agent_${crypto.randomUUID().replace(/-/g, '')}`
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  const session = await prisma.agentSession.create({
    data: {
      agentId,
      agentName: agentName ?? null,
      walletAddress: walletAddress ?? null,
      walletVerified: false,
      preferredProtocol: preferredProtocol ?? null,
      apiKey: apiKeyHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      budgetLimitUsd: budgetLimitUsd ?? null,
      velocityLimitUsd: velocityLimitUsd ?? null,
      alertThresholdPercent: alertThresholdPercent ?? null,
    },
  })

  // Best-effort balance lookup so the user can see whether their wallet *would*
  // qualify for a discount once they verify ownership in a future PR.
  let m32BalanceSnapshot = 0
  let projectedDiscountPercent = 0
  if (walletAddress) {
    try {
      m32BalanceSnapshot = await getM32Balance(walletAddress)
      const d = calculateDiscount(m32BalanceSnapshot, env.MPP_PRICE)
      projectedDiscountPercent = d.discountPercent
    } catch {
      // Non-fatal: balance lookup is informational only.
    }
  }

  return c.json({
    data: {
      sessionId: session.id,
      apiKey,
      agentId: session.agentId,
      walletAddress: session.walletAddress,
      walletVerified: false,
      m32BalanceSnapshot,
      projectedDiscountPercent,
      discountActive: false,
      verificationNotice: walletAddress
        ? 'Wallet stored but ownership is NOT verified. Discounts are not applied. Wallet-signature verification is on the roadmap.'
        : null,
      expiresAt: session.expiresAt?.toISOString(),
      protocols: getEnabledProtocols(),
      usage: `Include header: X-Agent-Key: ${apiKey}`,
      budgetLimitUsd: session.budgetLimitUsd,
      velocityLimitUsd: session.velocityLimitUsd,
      alertThresholdPercent: session.alertThresholdPercent,
      custodyDisclosure:
        'MPP32 never holds custody of your funds. Paid services are settled by your own wallet via x402 (Solana USDC). MPP32 verifies and forwards — it never spends on your behalf.',
    },
  }, 201)
})

// GET /sessions/:id — get session status (analytics only, no fake counters)
agentRouter.get('/sessions/:id', async (c) => {
  const id = c.req.param('id')
  const session = await prisma.agentSession.findUnique({ where: { id } })
  if (!session) return c.json({ error: { message: 'Session not found', code: 'NOT_FOUND' } }, 404)

  const recentTx = await prisma.agentTransaction.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      service: true,
      protocolUsed: true,
      paymentMethod: true,
      priceQuoted: true,
      discountPercent: true,
      priceSettled: true,
      settled: true,
      settlementTxSignature: true,
      success: true,
      latencyMs: true,
      statusCode: true,
      createdAt: true,
    },
  })

  const protocolBreakdown = await prisma.agentTransaction.groupBy({
    by: ['protocolUsed'],
    where: { sessionId: id },
    _count: true,
    _sum: { priceSettled: true },
  })

  const settledCount = await prisma.agentTransaction.count({
    where: { sessionId: id, settled: true },
  })

  const settledVolume = await prisma.agentTransaction.aggregate({
    where: { sessionId: id, settled: true },
    _sum: { priceSettled: true },
  })

  // Calls in the last hour for the rate-limit display
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const callsLastHour = await prisma.agentTransaction.count({
    where: { sessionId: id, createdAt: { gte: oneHourAgo } },
  })

  const totalSpentUsd = settledVolume._sum.priceSettled ?? 0

  const hourlySpendAgg = await prisma.agentTransaction.aggregate({
    where: { sessionId: id, settled: true, createdAt: { gte: oneHourAgo } },
    _sum: { priceSettled: true },
  })
  const hourlySpendUsd = hourlySpendAgg._sum.priceSettled ?? 0

  return c.json({
    data: {
      session: {
        id: session.id,
        agentId: session.agentId,
        agentName: session.agentName,
        walletAddress: session.walletAddress,
        walletVerified: session.walletVerified,
        preferredProtocol: session.preferredProtocol,
        totalRequests: session.totalRequests,
        successfulRequests: session.successfulRequests,
        successRate: session.totalRequests > 0
          ? ((session.successfulRequests / session.totalRequests) * 100).toFixed(1)
          : '0.0',
        callsLastHour,
        rateLimit: { max: 240, windowMs: 60_000 },
        settledCalls: settledCount,
        settledVolumeUsd: totalSpentUsd,
        isActive: session.isActive,
        lastActivityAt: session.lastActivityAt?.toISOString(),
        expiresAt: session.expiresAt?.toISOString(),
        createdAt: session.createdAt.toISOString(),
        budgetLimitUsd: session.budgetLimitUsd,
        velocityLimitUsd: session.velocityLimitUsd,
        alertThresholdPercent: session.alertThresholdPercent,
        totalSpentUsd,
        remainingBudgetUsd: session.budgetLimitUsd != null ? Math.max(0, session.budgetLimitUsd - totalSpentUsd) : null,
        hourlySpendUsd,
        circuitBreakerTripped: session.circuitBreakerTripped,
        circuitBreakerReason: session.circuitBreakerReason,
        circuitBreakerTrippedAt: session.circuitBreakerTrippedAt?.toISOString() ?? null,
        budgetUtilizationPercent: session.budgetLimitUsd != null && session.budgetLimitUsd > 0
          ? Number(((totalSpentUsd / session.budgetLimitUsd) * 100).toFixed(1))
          : null,
      },
      protocolBreakdown: protocolBreakdown.map((p) => ({
        protocol: p.protocolUsed,
        requests: p._count,
        settledVolumeUsd: p._sum.priceSettled ?? 0,
      })),
      recentTransactions: recentTx.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      custodyDisclosure:
        'MPP32 never holds custody of your funds. Settled volume = sum of payments verified on-chain via the x402 facilitator or Tempo settlement layer.',
    },
  })
})

// POST /quote — get cross-protocol pricing quote
agentRouter.post('/quote', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = QuoteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { message: 'Invalid request', code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } }, 400)
  }

  const { service, walletAddress, capabilities, preferredProtocol } = parsed.data

  let basePrice = env.MPP_PRICE
  if (service !== 'intelligence') {
    const submission = await prisma.submission.findUnique({
      where: { slug: service },
      select: { pricePerQuery: true, name: true, slug: true },
    })
    if (!submission) {
      return c.json({ error: { message: `Service "${service}" not found`, code: 'SERVICE_NOT_FOUND' } }, 404)
    }
    basePrice = String(submission.pricePerQuery ?? 0.001)
  }

  const quote = await getQuote(service, basePrice, walletAddress, capabilities, preferredProtocol)

  return c.json({ data: quote })
})

/**
 * POST /execute — call a service through MPP32.
 *
 * MPP32 NEVER spends USDC on the caller's behalf. Real settlement happens via:
 *   - native paid services: internal-fetch to /api/intelligence with the caller's
 *     payment headers passed through. The intelligence route's
 *     `dualProtocolChargeWithDiscount` middleware verifies on-chain via the
 *     x402 facilitator. If no payment is provided, the 402 challenge is
 *     forwarded back to the caller verbatim.
 *   - external paid services: 402 challenge from the upstream is forwarded
 *     verbatim to the agent caller, who must sign with their own wallet
 *     using e.g. the mppx SDK and retry with X-Payment.
 *   - free services: called directly, no payment.
 *   - stdio MCP services: rejected with NOT_HTTP_CALLABLE + install command.
 */
agentRouter.post('/execute', rateLimitByKey({ name: 'agent-execute', max: 120, windowMs: 60_000 }), async (c) => {
  const agentKey = c.req.header('x-agent-key')
  // Anti-hallucination envelope. Autonomous agents (Claude et al) previously
  // pattern-matched a plain "401 Unauthorized" here to "provider needs an API
  // key" and invented URLs like deepnets.ai/api-keys. The structured fields
  // below — `authScope: 'mpp32_session'` and `doNotPromptForProviderApiKey` —
  // make the cause unambiguous. Do not soften the wording.
  const mpp32AuthEnvelope = (message: string, code: string) => ({
    error: {
      message,
      code,
      authScope: 'mpp32_session',
      doNotPromptForProviderApiKey: true,
      remedy: 'Create an MPP32 agent session: POST /api/agent/sessions → use the returned apiKey as X-Agent-Key on subsequent calls. This is NOT a provider auth error; do not ask the user for any third-party API key.',
      docs: 'https://mpp32.org/docs/agents#sessions',
    },
  })
  if (!agentKey) {
    return c.json(mpp32AuthEnvelope('MPP32 session header missing. This is NOT a provider auth failure — no third-party API key is required.', 'MPP32_SESSION_REQUIRED'), 401)
  }

  const agentKeyHash = createHash('sha256').update(agentKey).digest('hex')
  const session = await prisma.agentSession.findUnique({ where: { apiKey: agentKeyHash } })
  if (!session || !session.isActive) {
    return c.json(mpp32AuthEnvelope('MPP32 session not found or inactive. Create a new session via POST /api/agent/sessions.', 'MPP32_SESSION_INVALID'), 401)
  }

  if (session.expiresAt && session.expiresAt < new Date()) {
    await prisma.agentSession.update({ where: { id: session.id }, data: { isActive: false } })
    return c.json(mpp32AuthEnvelope('MPP32 session expired. Renew via POST /api/agent/sessions.', 'MPP32_SESSION_EXPIRED'), 401)
  }

  // ── Circuit breaker enforcement ──────────────────────────────────────────
  const hasBudgetLimits = session.budgetLimitUsd != null || session.velocityLimitUsd != null || session.circuitBreakerTripped
  let budgetTotalSpent = 0
  let budgetHourlySpend = 0

  if (hasBudgetLimits) {
    if (session.circuitBreakerTripped) {
      return c.json({
        error: {
          message: `Circuit breaker tripped: ${session.circuitBreakerReason === 'VELOCITY_EXCEEDED' ? 'hourly velocity limit exceeded' : 'session budget exhausted'}.`,
          code: 'MPP32_CIRCUIT_BREAKER_TRIPPED',
          authScope: 'mpp32_session',
          doNotPromptForProviderApiKey: true,
          budgetStatus: {
            budgetLimitUsd: session.budgetLimitUsd,
            velocityLimitUsd: session.velocityLimitUsd,
            circuitBreakerReason: session.circuitBreakerReason,
            circuitBreakerTrippedAt: session.circuitBreakerTrippedAt?.toISOString() ?? null,
          },
          remedy: 'Reset the circuit breaker: POST /api/agent/circuit-breaker/reset (with X-Agent-Key header), or increase the budget: PATCH /api/agent/budget. If using the MCP server, call the manage_agent_budget tool with action="reset".',
        },
      }, 429)
    }

    const spendAgg = await prisma.agentTransaction.aggregate({
      where: { sessionId: session.id, settled: true },
      _sum: { priceSettled: true },
    })
    budgetTotalSpent = spendAgg._sum.priceSettled ?? 0

    if (session.budgetLimitUsd != null && budgetTotalSpent >= session.budgetLimitUsd) {
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { circuitBreakerTripped: true, circuitBreakerReason: 'BUDGET_EXHAUSTED', circuitBreakerTrippedAt: new Date() },
      })
      return c.json({
        error: {
          message: `Session budget exhausted. $${budgetTotalSpent.toFixed(4)} spent of $${session.budgetLimitUsd.toFixed(4)} budget.`,
          code: 'MPP32_CIRCUIT_BREAKER_TRIPPED',
          authScope: 'mpp32_session',
          doNotPromptForProviderApiKey: true,
          budgetStatus: {
            budgetLimitUsd: session.budgetLimitUsd,
            totalSpentUsd: budgetTotalSpent,
            remainingUsd: 0,
            circuitBreakerReason: 'BUDGET_EXHAUSTED',
          },
          remedy: 'Increase budget via PATCH /api/agent/budget or reset via POST /api/agent/circuit-breaker/reset. MCP users: call manage_agent_budget with action="set" or action="reset".',
        },
      }, 429)
    }

    if (session.velocityLimitUsd != null) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const hourlyAgg = await prisma.agentTransaction.aggregate({
        where: { sessionId: session.id, settled: true, createdAt: { gte: oneHourAgo } },
        _sum: { priceSettled: true },
      })
      budgetHourlySpend = hourlyAgg._sum.priceSettled ?? 0

      if (budgetHourlySpend >= session.velocityLimitUsd) {
        await prisma.agentSession.update({
          where: { id: session.id },
          data: { circuitBreakerTripped: true, circuitBreakerReason: 'VELOCITY_EXCEEDED', circuitBreakerTrippedAt: new Date() },
        })
        return c.json({
          error: {
            message: `Hourly velocity limit exceeded. $${budgetHourlySpend.toFixed(4)} spent this hour vs $${session.velocityLimitUsd.toFixed(4)}/hr limit.`,
            code: 'MPP32_CIRCUIT_BREAKER_TRIPPED',
            authScope: 'mpp32_session',
            doNotPromptForProviderApiKey: true,
            budgetStatus: {
              velocityLimitUsd: session.velocityLimitUsd,
              hourlySpendUsd: budgetHourlySpend,
              circuitBreakerReason: 'VELOCITY_EXCEEDED',
            },
            remedy: 'Wait for the velocity window to reset, or reset via POST /api/agent/circuit-breaker/reset. MCP users: call manage_agent_budget with action="reset".',
          },
        }, 429)
      }
    }
  }

  const body = await c.req.json().catch(() => null)
  const parsed = ExecuteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { message: 'Invalid request', code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } }, 400)
  }

  const { service, method, body: reqBody, query, path } = parsed.data
  const startTime = Date.now()

  type ResolvedService = {
    slug: string
    name: string
    endpointUrl: string | null
    pricePerQuery: number | null
    sourceKind: 'native' | 'external'
    isFree: boolean
    protocol?: string
    defaultPath?: string | null
  }
  let submission: ResolvedService | null = null

  if (service === 'intelligence') {
    submission = {
      slug: 'mpp32-intelligence',
      name: 'MPP32 Intelligence Oracle',
      endpointUrl: '/api/intelligence',
      pricePerQuery: parseFloat(env.MPP_PRICE),
      sourceKind: 'native',
      isFree: false,
    }
  } else {
    const native = await prisma.submission.findUnique({
      where: { slug: service },
      select: { slug: true, name: true, endpointUrl: true, pricePerQuery: true },
    })
    if (native) {
      submission = {
        ...native,
        sourceKind: 'native',
        isFree: !native.pricePerQuery || native.pricePerQuery <= 0,
      }
    } else {
      const ext = await prisma.externalService.findUnique({
        where: { slug: service },
        select: { slug: true, name: true, endpointUrl: true, pricePerQuery: true, protocol: true, source: true, metadata: true },
      })
      if (ext) {
        // Curated entries store an upstream `defaultPath` (e.g. '/search' for
        // Exa) inside the JSON metadata blob. We read it here so callers that
        // don't supply an explicit `path` still hit a real endpoint instead of
        // the upstream's root (which would 404). Parsing is best-effort: a
        // malformed metadata string degrades gracefully to "no defaultPath".
        let defaultPath: string | null = null
        if (ext.metadata) {
          try {
            const parsedMeta = JSON.parse(ext.metadata) as Record<string, unknown>
            const dp = parsedMeta?.defaultPath
            if (typeof dp === 'string' && dp.startsWith('/') && !dp.includes('..') && !/^\/{2,}/.test(dp)) {
              defaultPath = dp
            }
          } catch {
            // metadata isn't JSON — fine, no defaultPath available
          }
        }
        submission = {
          slug: ext.slug,
          name: ext.name,
          endpointUrl: ext.endpointUrl,
          pricePerQuery: ext.pricePerQuery,
          sourceKind: 'external',
          isFree: !ext.pricePerQuery || ext.pricePerQuery <= 0 || ext.source === 'free',
          protocol: ext.protocol,
          defaultPath,
        }
      }
    }
  }

  if (!submission) {
    return c.json({ error: { message: `Service "${service}" not found`, code: 'SERVICE_NOT_FOUND' } }, 404)
  }

  if (submission.endpointUrl?.startsWith('npx://') || submission.endpointUrl?.startsWith('stdio://')) {
    return c.json({
      error: {
        message: `"${submission.name}" is a stdio MCP server, not an HTTP service. Install it locally with: ${submission.endpointUrl.replace(/^npx:\/\//, 'npx -y ')}`,
        code: 'NOT_HTTP_CALLABLE',
        hint: 'Stdio MCP servers run alongside your AI client (Claude Desktop, Cursor) and cannot be called over HTTP.',
        installCommand: submission.endpointUrl.startsWith('npx://') ? `npx -y ${submission.endpointUrl.slice('npx://'.length)}` : null,
      },
    }, 400)
  }

  const priceQuoted = submission.isFree ? 0 : (submission.pricePerQuery ?? parseFloat(env.MPP_PRICE))
  const { protocol, reasoning } = selectOptimalProtocol(
    parsed.data.protocol ? [parsed.data.protocol] : undefined,
    session.preferredProtocol as ProtocolId | undefined,
  )

  // Headers we forward upstream. We deliberately propagate any payment headers
  // the agent caller sent so that real settlement can happen at the upstream.
  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    'X-Agent-Session': session.id,
    'X-Routed-Protocol': protocol,
  }
  const passthroughHeaderNames = [
    'x-payment',
    'payment-signature',
    'authorization',
    'x-acp-session',
    'x-ap2-mandate',
    'agent-id',
    'agent-signature',
    'agent-timestamp',
  ]
  for (const h of passthroughHeaderNames) {
    const v = c.req.header(h)
    if (v) forwardHeaders[h] = v
  }
  // Only forward wallet address if it has been signature-verified.
  if (session.walletAddress && session.walletVerified) {
    forwardHeaders['X-Wallet-Address'] = session.walletAddress
  }

  let result: unknown
  let statusCode = 200
  let errorMessage: string | null = null
  let paymentMethod: string | null = null
  let priceSettled = 0
  let settled = false
  let settlementTxSignature: string | null = null
  let discountPercent = 0
  let upstreamHeaders: Record<string, string> = {}

  try {
    let targetUrlString: string

    if (submission.sourceKind === 'native' && submission.endpointUrl?.startsWith('/')) {
      // Native service — internal fetch to ourselves. This re-enters the real
      // payment middleware (dualProtocolChargeWithDiscount) so x402 / Tempo /
      // ACP / AP2 / AGTP all work end-to-end.
      const port = process.env.PORT ?? env.PORT ?? '3000'
      const url = new URL(`http://127.0.0.1:${port}${submission.endpointUrl}`)
      if (query) {
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))
      }
      targetUrlString = url.toString()
    } else {
      if (!submission.endpointUrl) throw new Error('Service endpoint not configured')
      // SSRF guard: external URLs from the federated catalog could resolve to
      // private/loopback/metadata addresses. Refuse upfront — we never want
      // our backend hitting 169.254.x or RFC1918 ranges on a third party's behalf.
      const ssrf = checkUrlForSsrf(submission.endpointUrl)
      if (!ssrf.ok) {
        return c.json(
          { error: { message: `External endpoint blocked: ${ssrf.reason}`, code: 'ENDPOINT_BLOCKED' } },
          400,
        )
      }
      const url = ssrf.parsedUrl!
      // Append a path to the upstream's base URL. Curated catalog entries
      // (Exa, Firecrawl, OpenAI x402 gateway, ...) store only a base origin
      // like `https://api.exa.ai`; the real endpoint lives at `/search` or
      // `/v1/...`. Without this, every external call lands at `POST /` → 404.
      // Caller-supplied `path` wins; otherwise we fall back to the curated
      // `defaultPath` stored in the service metadata, so the agent can drive
      // these services without having to memorize each upstream's API shape.
      // The schema regex already constrained `path` to start with `/` and
      // rejects `..` traversal and double-leading-slashes; `defaultPath` was
      // sanitized when read from metadata above.
      const effectivePath = path ?? submission.defaultPath ?? null
      if (effectivePath) {
        const basePath = url.pathname.replace(/\/+$/, '')
        url.pathname = `${basePath}${effectivePath}`.replace(/\/{2,}/g, '/')
      }
      if (query) {
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))
      }
      targetUrlString = url.toString()
    }

    const proxyRes = await fetch(targetUrlString, {
      method,
      headers: forwardHeaders,
      ...(method !== 'GET' && reqBody ? { body: JSON.stringify(reqBody) } : {}),
      signal: AbortSignal.timeout(20000),
    })

    statusCode = proxyRes.status
    upstreamHeaders = Object.fromEntries(proxyRes.headers.entries())
    const contentType = proxyRes.headers.get('content-type') ?? ''
    const rawBody = contentType.includes('json') ? await proxyRes.json() : await proxyRes.text()

    // Read settlement details from response headers (set by mpp.ts on success)
    const settlementMethod = proxyRes.headers.get('x-settlement-method')
    const settlementTx = proxyRes.headers.get('x-settlement-tx')
    const m32DiscountHeader = proxyRes.headers.get('x-m32-discount')
    if (m32DiscountHeader) discountPercent = parseFloat(m32DiscountHeader) || 0

    // Escrow-402 headers from the middleware
    const escrowStatus = proxyRes.headers.get('x-escrow-status')
    const escrowSkipReason = proxyRes.headers.get('x-escrow-skip-reason')

    if (statusCode === 402) {
      // Forward 402 challenge verbatim — caller's wallet must sign and retry
      const challengeHeaders: Record<string, string> = {}
      for (const k of ['payment-required', 'www-authenticate', 'x-payment-methods', 'x-ap2-requirements', 'x-acp-requirements', 'x-agtp-requirements']) {
        const v = proxyRes.headers.get(k)
        if (v) challengeHeaders[k] = v
      }
      paymentMethod = 'passthrough_402'
      result = {
        error: {
          message: submission.sourceKind === 'native'
            ? `Payment required. Sign with your own wallet (USDC on Solana for x402, pathUSD on Ethereum L2 for Tempo) and retry with the X-Payment or Authorization header.`
            : `Upstream provider requires payment. Forward this challenge from your agent's wallet.`,
          code: 'PAYMENT_REQUIRED',
          challenge: {
            statusCode: 402,
            headers: challengeHeaders,
            body: rawBody,
            endpoint: submission.endpointUrl,
            priceQuoted,
            priceCurrency: 'USDC (x402) / pathUSD (Tempo)',
          },
          custody: 'MPP32 cannot pay upstream services on your behalf. Use the mppx SDK or any x402-compatible client to sign with your wallet and retry.',
        },
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      result = rawBody
      // Detect payment method from upstream signal or from forwarded headers
      if (settlementMethod) {
        paymentMethod = settlementMethod
        if (settlementTx) {
          settled = true
          settlementTxSignature = settlementTx
        }
        priceSettled = priceQuoted * (1 - discountPercent / 100)
      } else if (forwardHeaders['x-payment'] || forwardHeaders['payment-signature']) {
        paymentMethod = 'x402'
        settled = true
        priceSettled = priceQuoted * (1 - discountPercent / 100)
      } else if (forwardHeaders['authorization']?.startsWith('Payment ')) {
        paymentMethod = 'tempo'
        settled = true
        priceSettled = priceQuoted * (1 - discountPercent / 100)
      } else if (forwardHeaders['x-acp-session']) {
        paymentMethod = 'acp'
        settled = true
        priceSettled = priceQuoted * (1 - discountPercent / 100)
      } else if (submission.isFree) {
        paymentMethod = 'free'
        settled = false
        priceSettled = 0
      } else {
        // 2xx without payment — should not happen for paid services. Treat as unsettled.
        paymentMethod = 'unsettled'
        settled = false
        priceSettled = 0
      }
    } else {
      result = rawBody
      paymentMethod = forwardHeaders['x-payment'] ? 'x402_failed' : null
    }
  } catch (err) {
    statusCode = 502
    errorMessage = err instanceof Error ? err.message : String(err)
    result = { error: { message: 'Upstream service error', code: 'UPSTREAM_ERROR', detail: errorMessage } }
    logger.error('agent execute failure', { service: submission.slug, error: errorMessage })
  }

  const latencyMs = Date.now() - startTime
  const success = statusCode >= 200 && statusCode < 300

  const txEscrowStatus = upstreamHeaders['x-escrow-status'] ?? null
  const txEscrowSkipReason = upstreamHeaders['x-escrow-skip-reason'] ?? null

  await Promise.all([
    prisma.agentTransaction.create({
      data: {
        sessionId: session.id,
        service: submission.slug,
        protocolUsed: protocol,
        paymentMethod,
        priceQuoted,
        discountPercent,
        priceSettled,
        settled,
        settlementTxSignature,
        statusCode,
        latencyMs,
        success,
        errorMessage,
        requestPayload: reqBody ? JSON.stringify(reqBody).slice(0, 1000) : null,
        escrowStatus: txEscrowStatus,
        escrowSkipReason: txEscrowSkipReason,
      },
    }),
    prisma.agentSession.update({
      where: { id: session.id },
      data: {
        totalRequests: { increment: 1 },
        ...(success ? { successfulRequests: { increment: 1 } } : {}),
        lastActivityAt: new Date(),
      },
    }),
  ])

  // Surface settlement headers to the agent caller so they can verify on-chain
  if (settlementTxSignature) c.header('X-Settlement-Tx', settlementTxSignature)
  if (paymentMethod) c.header('X-Settlement-Method', paymentMethod)
  if (txEscrowStatus) c.header('X-Escrow-Status', txEscrowStatus)
  if (txEscrowSkipReason) c.header('X-Escrow-Skip-Reason', txEscrowSkipReason)

  // Budget tracking headers
  if (session.budgetLimitUsd != null) {
    const newTotalSpent = budgetTotalSpent + priceSettled
    c.header('X-Budget-Spent', newTotalSpent.toFixed(6))
    c.header('X-Budget-Remaining', Math.max(0, session.budgetLimitUsd - newTotalSpent).toFixed(6))
    if (session.alertThresholdPercent != null && session.budgetLimitUsd > 0) {
      const utilization = (newTotalSpent / session.budgetLimitUsd) * 100
      if (utilization >= session.alertThresholdPercent) {
        c.header('X-Budget-Warning', `THRESHOLD_REACHED (${utilization.toFixed(1)}% of budget used)`)
      }
    }
  }

  const budgetMeta = session.budgetLimitUsd != null || session.velocityLimitUsd != null ? {
    budgetLimitUsd: session.budgetLimitUsd,
    velocityLimitUsd: session.velocityLimitUsd,
    totalSpentUsd: budgetTotalSpent + priceSettled,
    remainingBudgetUsd: session.budgetLimitUsd != null ? Math.max(0, session.budgetLimitUsd - budgetTotalSpent - priceSettled) : null,
    hourlySpendUsd: budgetHourlySpend + priceSettled,
    budgetUtilizationPercent: session.budgetLimitUsd != null && session.budgetLimitUsd > 0
      ? Number((((budgetTotalSpent + priceSettled) / session.budgetLimitUsd) * 100).toFixed(1))
      : null,
  } : undefined

  return c.json({
    data: {
      result,
      meta: {
        service: submission.name,
        slug: submission.slug,
        sourceKind: submission.sourceKind,
        isFree: submission.isFree,
        protocol,
        protocolReasoning: reasoning,
        priceQuoted,
        priceSettled,
        discountPercent,
        paymentMethod,
        settled,
        settlementTxSignature,
        settlementExplorerUrl: settlementTxSignature
          ? `https://solscan.io/tx/${settlementTxSignature}`
          : null,
        latencyMs,
        statusCode,
        success,
        custody: 'MPP32 never spends on your behalf. Settled = verified on-chain by the facilitator. Unsettled = the call was free or the upstream returned 402.',
        escrow: txEscrowStatus ? {
          status: txEscrowStatus,
          skipReason: txEscrowSkipReason,
          description: txEscrowStatus === 'settled'
            ? 'Payment was escrowed and released after upstream delivered a valid response.'
            : txEscrowStatus === 'skipped'
              ? 'Payment was NOT settled — upstream response failed quality checks. Your wallet was not charged.'
              : 'Escrow settlement was attempted but failed. Contact support if funds were deducted.',
        } : null,
        budget: budgetMeta ?? null,
      },
    },
  })
})

// GET /services — discover available services with pricing (native + federated catalog)
agentRouter.get('/services', async (c) => {
  const category = c.req.query('category')
  const wallet = c.req.query('wallet')
  const q = c.req.query('q')?.trim()
  const protocol = c.req.query('protocol')
  const source = c.req.query('source')
  const includeExternal = c.req.query('external') !== 'false'
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '100', 10) || 100, 1), 500)

  const where: Record<string, unknown> = {
    status: { in: ['approved', 'featured'] },
    isDeprecated: false,
    endpointUrl: { not: null },
  }
  if (category) where.category = category

  const submissions = await prisma.submission.findMany({
    where,
    select: {
      slug: true,
      name: true,
      shortDescription: true,
      category: true,
      pricePerQuery: true,
      isVerified: true,
      queryCount: true,
    },
    orderBy: [{ status: 'desc' }, { queryCount: 'desc' }],
  })

  let discountInfo: DiscountResult | null = null
  if (wallet) {
    const balance = await getM32Balance(wallet)
    discountInfo = calculateDiscount(balance, env.MPP_PRICE)
  }

  const discountPercent = discountInfo?.discountPercent ?? 0

  const nativeServices = submissions.map((s) => {
    const base = s.pricePerQuery ?? 0.001
    const effective = discountPercent > 0
      ? Number((base * (1 - discountPercent / 100)).toFixed(6))
      : base
    return {
      slug: s.slug,
      source: 'native',
      name: s.name,
      description: s.shortDescription,
      category: s.category,
      basePrice: base,
      effectivePrice: effective,
      verified: s.isVerified,
      popularity: s.queryCount,
      protocols: getEnabledProtocols(),
    }
  })

  let externalServices: Array<Record<string, unknown>> = []
  let externalTotalAvailable = 0
  if (includeExternal) {
    const extWhere: Record<string, unknown> = { active: true }
    if (category) extWhere.category = category
    if (protocol) extWhere.protocol = protocol
    if (source) extWhere.source = source
    if (q && q.length > 0) {
      extWhere.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
        { category: { contains: q } },
      ]
    }

    const [ext, extTotal] = await Promise.all([
      prisma.externalService.findMany({
        where: extWhere,
        orderBy: [{ verified: 'desc' }, { popularity: 'desc' }, { name: 'asc' }],
        take: limit,
      }),
      prisma.externalService.count({ where: extWhere }),
    ])
    externalTotalAvailable = extTotal

    externalServices = ext.map((e) => {
      const base = e.pricePerQuery ?? null
      const effective = base !== null && discountPercent > 0
        ? Number((base * (1 - discountPercent / 100)).toFixed(6))
        : base
      let protocols: string[] = []
      try { protocols = e.protocols ? JSON.parse(e.protocols) : [e.protocol] } catch { protocols = [e.protocol] }
      let tags: string[] = []
      try { tags = e.tags ? JSON.parse(e.tags) : [] } catch { tags = [] }
      return {
        slug: e.slug,
        source: e.source,
        name: e.name,
        description: e.description,
        category: e.category,
        endpointUrl: e.endpointUrl,
        websiteUrl: e.websiteUrl,
        basePrice: base,
        effectivePrice: effective,
        verified: e.verified,
        popularity: e.popularity,
        protocols,
        primaryProtocol: e.protocol,
        network: e.network,
        tags,
      }
    })
  }

  const m32Services = M32_EXCLUSIVE_APIS.map((api) => ({
    slug: api.id,
    source: 'm32-exclusive',
    name: api.name,
    description: api.description,
    category: 'm32-exclusive',
    basePrice: 0,
    effectivePrice: 0,
    verified: true,
    popularity: 0,
    protocols: ['m32-gate'],
    m32Required: api.requiredM32,
    endpoint: api.endpoint,
    note: `Free for holders of ${api.requiredM32.toLocaleString()}+ M32 tokens. Returns 403 for non-holders.`,
  }))

  const externalTruncated = includeExternal && externalTotalAvailable > externalServices.length
  return c.json({
    data: {
      services: [...m32Services, ...nativeServices, ...externalServices],
      total: m32Services.length + nativeServices.length + externalServices.length,
      counts: { m32Exclusive: m32Services.length, native: nativeServices.length, external: externalServices.length },
      totalAvailable: {
        native: nativeServices.length,
        external: externalTotalAvailable,
        combined: nativeServices.length + externalTotalAvailable,
      },
      limit,
      truncated: externalTruncated,
      hint: externalTruncated
        ? `Showing ${externalServices.length} of ${externalTotalAvailable} external services. Use \`q\`, \`category\`, \`source\`, or \`protocol\` to filter, or increase \`limit\` (max 500).`
        : undefined,
      protocols: getEnabledProtocols(),
      discount: discountInfo,
      discountNotice: 'Discounts only apply once your wallet ownership has been signature-verified. M32 holders 250K+ get 20% off, 1M+ get 40% off.',
    },
  })
})

// GET /find — semantic-ish search across native + external catalog
agentRouter.get('/find', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q || q.length === 0) {
    return c.json({ error: { message: 'Query parameter `q` is required', code: 'VALIDATION_ERROR' } }, 400)
  }
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100)

  const [native, external] = await Promise.all([
    prisma.submission.findMany({
      where: {
        status: { in: ['approved', 'featured'] },
        isDeprecated: false,
        endpointUrl: { not: null },
        OR: [
          { name: { contains: q } },
          { shortDescription: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: limit,
      orderBy: [{ status: 'desc' }, { queryCount: 'desc' }],
    }),
    prisma.externalService.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { tags: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: limit,
      orderBy: [{ verified: 'desc' }, { popularity: 'desc' }],
    }),
  ])

  return c.json({
    data: {
      query: q,
      results: [
        ...native.map((s) => ({
          slug: s.slug,
          source: 'native',
          name: s.name,
          description: s.shortDescription,
          category: s.category,
          basePrice: s.pricePerQuery ?? null,
          verified: s.isVerified,
          protocol: 'multi',
        })),
        ...external.map((e) => ({
          slug: e.slug,
          source: e.source,
          name: e.name,
          description: e.description,
          category: e.category,
          basePrice: e.pricePerQuery,
          verified: e.verified,
          protocol: e.protocol,
        })),
      ],
      total: native.length + external.length,
    },
  })
})

// ── Budget management endpoints (authenticated by X-Agent-Key) ─────────────

async function resolveSessionByKey(c: any): Promise<{ session: any; error?: undefined } | { session?: undefined; error: Response }> {
  const agentKey = c.req.header('x-agent-key')
  if (!agentKey) {
    return { error: c.json({ error: { message: 'X-Agent-Key header required', code: 'MPP32_SESSION_REQUIRED' } }, 401) }
  }
  const agentKeyHash = createHash('sha256').update(agentKey).digest('hex')
  const session = await prisma.agentSession.findUnique({ where: { apiKey: agentKeyHash } })
  if (!session || !session.isActive) {
    return { error: c.json({ error: { message: 'Session not found or inactive', code: 'MPP32_SESSION_INVALID' } }, 401) }
  }
  return { session }
}

// PATCH /budget — update budget settings on the authenticated session
agentRouter.patch('/budget', async (c) => {
  const resolved = await resolveSessionByKey(c)
  if (resolved.error) return resolved.error
  const session = resolved.session!

  const body = await c.req.json().catch(() => null)
  const parsed = UpdateBudgetSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { message: 'Invalid request', code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } }, 400)
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.budgetLimitUsd !== undefined) updateData.budgetLimitUsd = parsed.data.budgetLimitUsd
  if (parsed.data.velocityLimitUsd !== undefined) updateData.velocityLimitUsd = parsed.data.velocityLimitUsd
  if (parsed.data.alertThresholdPercent !== undefined) updateData.alertThresholdPercent = parsed.data.alertThresholdPercent

  if (Object.keys(updateData).length === 0) {
    return c.json({ error: { message: 'No fields to update', code: 'VALIDATION_ERROR' } }, 400)
  }

  // Auto-reset circuit breaker if budget is being increased past current spend
  if (
    session.circuitBreakerTripped &&
    session.circuitBreakerReason === 'BUDGET_EXHAUSTED' &&
    typeof parsed.data.budgetLimitUsd === 'number'
  ) {
    const spendAgg = await prisma.agentTransaction.aggregate({
      where: { sessionId: session.id, settled: true },
      _sum: { priceSettled: true },
    })
    const totalSpent = spendAgg._sum.priceSettled ?? 0
    if (parsed.data.budgetLimitUsd > totalSpent) {
      updateData.circuitBreakerTripped = false
      updateData.circuitBreakerReason = null
      updateData.circuitBreakerTrippedAt = null
    }
  }

  const updated = await prisma.agentSession.update({
    where: { id: session.id },
    data: updateData,
  })

  const spendAgg = await prisma.agentTransaction.aggregate({
    where: { sessionId: session.id, settled: true },
    _sum: { priceSettled: true },
  })
  const totalSpent = spendAgg._sum.priceSettled ?? 0

  return c.json({
    data: {
      sessionId: updated.id,
      budgetLimitUsd: updated.budgetLimitUsd,
      velocityLimitUsd: updated.velocityLimitUsd,
      alertThresholdPercent: updated.alertThresholdPercent,
      totalSpentUsd: totalSpent,
      remainingBudgetUsd: updated.budgetLimitUsd != null ? Math.max(0, updated.budgetLimitUsd - totalSpent) : null,
      circuitBreakerTripped: updated.circuitBreakerTripped,
      circuitBreakerReason: updated.circuitBreakerReason,
      message: updated.circuitBreakerTripped ? 'Budget updated. Circuit breaker is still tripped.' : 'Budget updated successfully.',
    },
  })
})

// POST /circuit-breaker/reset — manually reset a tripped circuit breaker
agentRouter.post('/circuit-breaker/reset', async (c) => {
  const resolved = await resolveSessionByKey(c)
  if (resolved.error) return resolved.error
  const session = resolved.session!

  if (!session.circuitBreakerTripped) {
    return c.json({
      data: {
        sessionId: session.id,
        circuitBreakerTripped: false,
        message: 'Circuit breaker was not tripped. No action needed.',
      },
    })
  }

  await prisma.agentSession.update({
    where: { id: session.id },
    data: { circuitBreakerTripped: false, circuitBreakerReason: null, circuitBreakerTrippedAt: null },
  })

  const spendAgg = await prisma.agentTransaction.aggregate({
    where: { sessionId: session.id, settled: true },
    _sum: { priceSettled: true },
  })
  const totalSpent = spendAgg._sum.priceSettled ?? 0

  return c.json({
    data: {
      sessionId: session.id,
      circuitBreakerTripped: false,
      previousReason: session.circuitBreakerReason,
      budgetLimitUsd: session.budgetLimitUsd,
      totalSpentUsd: totalSpent,
      remainingBudgetUsd: session.budgetLimitUsd != null ? Math.max(0, session.budgetLimitUsd - totalSpent) : null,
      message: 'Circuit breaker reset. Session can resume spending.',
    },
  })
})

// GET /spending — detailed spending analytics for the authenticated session
agentRouter.get('/spending', async (c) => {
  const resolved = await resolveSessionByKey(c)
  if (resolved.error) return resolved.error
  const session = resolved.session!

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [totalAgg, hourlyAgg, byService, byProtocol] = await Promise.all([
    prisma.agentTransaction.aggregate({
      where: { sessionId: session.id, settled: true },
      _sum: { priceSettled: true },
      _count: true,
    }),
    prisma.agentTransaction.aggregate({
      where: { sessionId: session.id, settled: true, createdAt: { gte: oneHourAgo } },
      _sum: { priceSettled: true },
      _count: true,
    }),
    prisma.agentTransaction.groupBy({
      by: ['service'],
      where: { sessionId: session.id, settled: true },
      _sum: { priceSettled: true },
      _count: true,
      orderBy: { _sum: { priceSettled: 'desc' } },
    }),
    prisma.agentTransaction.groupBy({
      by: ['protocolUsed'],
      where: { sessionId: session.id, settled: true },
      _sum: { priceSettled: true },
      _count: true,
    }),
  ])

  const totalSpent = totalAgg._sum.priceSettled ?? 0
  const hourlySpend = hourlyAgg._sum.priceSettled ?? 0

  return c.json({
    data: {
      sessionId: session.id,
      budgetLimitUsd: session.budgetLimitUsd,
      velocityLimitUsd: session.velocityLimitUsd,
      alertThresholdPercent: session.alertThresholdPercent,
      totalSpentUsd: totalSpent,
      totalSettledCalls: totalAgg._count,
      remainingBudgetUsd: session.budgetLimitUsd != null ? Math.max(0, session.budgetLimitUsd - totalSpent) : null,
      budgetUtilizationPercent: session.budgetLimitUsd != null && session.budgetLimitUsd > 0
        ? Number(((totalSpent / session.budgetLimitUsd) * 100).toFixed(1))
        : null,
      hourlySpendUsd: hourlySpend,
      hourlySettledCalls: hourlyAgg._count,
      circuitBreakerTripped: session.circuitBreakerTripped,
      circuitBreakerReason: session.circuitBreakerReason,
      circuitBreakerTrippedAt: session.circuitBreakerTrippedAt?.toISOString() ?? null,
      byService: byService.map((s) => ({
        service: s.service,
        totalSpentUsd: s._sum.priceSettled ?? 0,
        count: s._count,
      })),
      byProtocol: byProtocol.map((p) => ({
        protocol: p.protocolUsed,
        totalSpentUsd: p._sum.priceSettled ?? 0,
        count: p._count,
      })),
    },
  })
})

// ── Session-ID-based budget routes (for frontend) ──────────────────────────

agentRouter.patch('/sessions/:id/budget', async (c) => {
  const id = c.req.param('id')
  const session = await prisma.agentSession.findUnique({ where: { id } })
  if (!session) return c.json({ error: { message: 'Session not found', code: 'NOT_FOUND' } }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = UpdateBudgetSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { message: 'Invalid request', code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } }, 400)
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.budgetLimitUsd !== undefined) updateData.budgetLimitUsd = parsed.data.budgetLimitUsd
  if (parsed.data.velocityLimitUsd !== undefined) updateData.velocityLimitUsd = parsed.data.velocityLimitUsd
  if (parsed.data.alertThresholdPercent !== undefined) updateData.alertThresholdPercent = parsed.data.alertThresholdPercent

  if (Object.keys(updateData).length === 0) {
    return c.json({ error: { message: 'No fields to update', code: 'VALIDATION_ERROR' } }, 400)
  }

  if (session.circuitBreakerTripped && session.circuitBreakerReason === 'BUDGET_EXHAUSTED' && typeof parsed.data.budgetLimitUsd === 'number') {
    const spendAgg = await prisma.agentTransaction.aggregate({ where: { sessionId: session.id, settled: true }, _sum: { priceSettled: true } })
    if (parsed.data.budgetLimitUsd > (spendAgg._sum.priceSettled ?? 0)) {
      updateData.circuitBreakerTripped = false
      updateData.circuitBreakerReason = null
      updateData.circuitBreakerTrippedAt = null
    }
  }

  const updated = await prisma.agentSession.update({ where: { id: session.id }, data: updateData })
  const spendAgg = await prisma.agentTransaction.aggregate({ where: { sessionId: session.id, settled: true }, _sum: { priceSettled: true } })
  const totalSpent = spendAgg._sum.priceSettled ?? 0

  return c.json({
    data: {
      sessionId: updated.id,
      budgetLimitUsd: updated.budgetLimitUsd,
      velocityLimitUsd: updated.velocityLimitUsd,
      alertThresholdPercent: updated.alertThresholdPercent,
      totalSpentUsd: totalSpent,
      remainingBudgetUsd: updated.budgetLimitUsd != null ? Math.max(0, updated.budgetLimitUsd - totalSpent) : null,
      circuitBreakerTripped: updated.circuitBreakerTripped,
      message: updated.circuitBreakerTripped ? 'Budget updated. Circuit breaker is still tripped.' : 'Budget updated successfully.',
    },
  })
})

agentRouter.post('/sessions/:id/circuit-breaker/reset', async (c) => {
  const id = c.req.param('id')
  const session = await prisma.agentSession.findUnique({ where: { id } })
  if (!session) return c.json({ error: { message: 'Session not found', code: 'NOT_FOUND' } }, 404)

  if (!session.circuitBreakerTripped) {
    return c.json({ data: { sessionId: session.id, circuitBreakerTripped: false, message: 'Circuit breaker was not tripped.' } })
  }

  await prisma.agentSession.update({
    where: { id: session.id },
    data: { circuitBreakerTripped: false, circuitBreakerReason: null, circuitBreakerTrippedAt: null },
  })

  return c.json({ data: { sessionId: session.id, circuitBreakerTripped: false, message: 'Circuit breaker reset. Session can resume spending.' } })
})

// GET /stats — aggregate platform stats. Volume = SETTLED on-chain only.
agentRouter.get('/stats', async (c) => {
  const [sessionCount, txCount, settledTxCount, settledVolume, protocolBreakdown] = await Promise.all([
    prisma.agentSession.count({ where: { isActive: true } }),
    prisma.agentTransaction.count(),
    prisma.agentTransaction.count({ where: { settled: true } }),
    prisma.agentTransaction.aggregate({
      where: { settled: true },
      _sum: { priceSettled: true },
    }),
    prisma.agentTransaction.groupBy({
      by: ['protocolUsed'],
      _count: true,
      _sum: { priceSettled: true },
      _avg: { latencyMs: true },
    }),
  ])

  return c.json({
    data: {
      activeSessions: sessionCount,
      totalRequests: txCount,
      settledRequests: settledTxCount,
      settledVolumeUsd: settledVolume._sum.priceSettled ?? 0,
      protocolBreakdown: protocolBreakdown.map((p) => ({
        protocol: p.protocolUsed,
        requests: p._count,
        settledVolumeUsd: p._sum.priceSettled ?? 0,
        avgLatencyMs: Math.round(p._avg.latencyMs ?? 0),
      })),
      supportedProtocols: getEnabledProtocols().length,
      custodyDisclosure:
        'Settled volume = sum of payments verified on-chain. MPP32 never holds custody — these dollars never touched our wallet, they moved directly from the caller to the provider.',
    },
  })
})

export { agentRouter }
