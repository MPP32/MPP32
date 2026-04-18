import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/hono'
import { PrismaClient } from '@prisma/client'
import { env } from '../env.js'
import { mppx as _mppxRef } from '../lib/mpp.js'

const prisma = new PrismaClient()

// Use the same type as the global mppx instance for correct inference
type MppxWrap = typeof _mppxRef

// Cache mppx instances keyed by slug:price:address so we don't recreate on every request
const mppxCache = new Map<string, MppxWrap>()

function getMppxInstance(slug: string, paymentAddress: string, price: number): MppxWrap {
  const key = `${slug}:${price}:${paymentAddress}`
  if (mppxCache.has(key)) return mppxCache.get(key)!

  const secretKey = env.MPP_SECRET_KEY ?? 'mpp-default-secret-change-in-production'

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
      creatorName: true,
      logoUrl: true,
      status: true,
      queryCount: true,
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
      creatorName: submission.creatorName,
      logoUrl: submission.logoUrl,
      queryCount: submission.queryCount,
    },
  })
})

// ALL /api/proxy/:slug — the actual MPP-gated proxy
proxyRouter.all('/:slug', async (c) => {
  const slug = c.req.param('slug')

  // Look up the submission
  const submission = await prisma.submission.findUnique({ where: { slug } })

  if (!submission || !['approved', 'featured'].includes(submission.status)) {
    return c.json({ error: { message: 'Service not found', code: 'NOT_FOUND' } }, 404)
  }

  if (!submission.endpointUrl) {
    return c.json(
      { error: { message: 'This service has no endpoint configured', code: 'NO_ENDPOINT' } },
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

  // Read the body before the charge middleware might interfere
  const bodyText = c.req.method !== 'GET' && c.req.method !== 'HEAD'
    ? await c.req.text()
    : undefined

  // Get or create the mppx instance for this service's payment address
  let mppInstance: ReturnType<typeof getMppxInstance>
  try {
    mppInstance = getMppxInstance(submission.slug, submission.paymentAddress, price)
  } catch (err) {
    console.error('[proxy] failed to create mppx instance:', err)
    return c.json(
      { error: { message: 'Invalid payment address configuration', code: 'INVALID_PAYMENT_ADDRESS' } },
      422
    )
  }

  const chargeMiddleware = mppInstance.charge({ amount: String(price) })

  // Storage for the forwarded response (set inside next, read after)
  let proxyResult: Response | null = null

  // Apply charge middleware. If no payment → returns 402. If paid → calls next.
  const chargeResult = await chargeMiddleware(c, async () => {
    // Forward query string from the original request to the upstream endpoint.
    // Merge any existing query params on the configured endpointUrl with the
    // incoming caller's query params (caller's params win on conflict).
    const incomingUrl = new URL(c.req.url)
    const target = new URL(submission.endpointUrl!)
    for (const [key, value] of incomingUrl.searchParams.entries()) {
      target.searchParams.append(key, value)
    }

    // Build X-Forwarded-* headers so upstream providers can see origin info.
    // Preserve any existing chain on X-Forwarded-For and append our hop.
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

    let upstream: Response
    try {
      upstream = await fetch(target.toString(), {
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
      })
    } catch (err: unknown) {
      const message = err instanceof Error && err.name === 'TimeoutError'
        ? 'Upstream service timed out'
        : 'Upstream service is unreachable'
      console.error(`[proxy] upstream error for ${slug}:`, err)
      proxyResult = new Response(
        JSON.stringify({ error: { message, code: 'UPSTREAM_ERROR' } }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
      return
    }

    // Async query count increment — don't block the response
    prisma.submission
      .update({
        where: { id: submission.id },
        data: { queryCount: { increment: 1 }, lastQueriedAt: new Date() },
      })
      .catch((e) => console.error('[proxy] failed to update queryCount:', e))

    const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
    const responseBody = await upstream.text()

    proxyResult = new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'X-MPP32-Proxied': '1',
      },
    })
  })

  // If chargeMiddleware returned a Response (402), use it
  // Otherwise use what we stored in proxyResult
  if (chargeResult instanceof Response) return chargeResult
  if (proxyResult) return proxyResult

  // Fallback: something unexpected happened
  return c.json({ error: { message: 'Proxy error', code: 'PROXY_ERROR' } }, 500)
})

export { proxyRouter }
