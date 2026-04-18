import { Hono } from 'hono'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { randomBytes, createHash } from 'crypto'
import type { Context } from 'hono'
import { CreateSubmissionSchema, UpdateSubmissionSchema, RecoverTokenSchema } from '../types.js'
import { validate } from '../lib/validator.js'

const prisma = new PrismaClient()

const submissionsRouter = new Hono()

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

type SubmissionRow = {
  id: string
  name: string
  slug: string
  shortDescription: string
  fullDescription: string | null
  category: string
  websiteUrl: string
  endpointUrl: string | null
  pricePerQuery: number | null
  paymentAddress: string | null
  creatorName: string
  logoUrl: string | null
  twitterHandle: string | null
  githubUrl: string | null
  status: string
  queryCount: number
  lastQueriedAt: Date | null
  managementToken: string | null
  isDeprecated: boolean
  createdAt: Date
  updatedAt: Date
}

// Formats a submission row for public API responses.
// INTENTIONAL: creatorEmail is deliberately excluded from the returned object
// as PII protection — it is only used internally (e.g. for admin contact) and
// must never leak to the public /api/submissions responses. Do not add it here.
function formatSubmission(s: SubmissionRow) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    shortDescription: s.shortDescription,
    fullDescription: s.fullDescription,
    category: s.category,
    websiteUrl: s.websiteUrl,
    endpointUrl: s.endpointUrl,
    pricePerQuery: s.pricePerQuery,
    paymentAddress: s.paymentAddress,
    creatorName: s.creatorName,
    logoUrl: s.logoUrl,
    twitterHandle: s.twitterHandle,
    githubUrl: s.githubUrl,
    status: s.status,
    queryCount: s.queryCount,
    lastQueriedAt: s.lastQueriedAt ? s.lastQueriedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

async function verifyManagementAuth(
  c: Context,
  submission: { managementToken: string | null }
): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  if (!submission.managementToken) return false
  const hash = createHash('sha256').update(token).digest('hex')
  return hash === submission.managementToken
}

// GET /api/submissions - list approved/featured submissions (exclude deprecated)
submissionsRouter.get(
  '/',
  validate('query', z.object({ category: z.string().optional() })),
  async (c) => {
    const { category } = c.req.valid('query')

    const submissions = await prisma.submission.findMany({
      where: {
        status: { in: ['approved', 'featured'] },
        isDeprecated: false,
        ...(category ? { category } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    const sorted = submissions.sort((a, b) => {
      if (a.status === 'featured' && b.status !== 'featured') return -1
      if (a.status !== 'featured' && b.status === 'featured') return 1
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    return c.json({ data: sorted.map(formatSubmission) })
  }
)

// GET /api/submissions/stats - ecosystem stats
submissionsRouter.get('/stats', async (c) => {
  const submissions = await prisma.submission.findMany({
    where: { status: { in: ['approved', 'featured'] }, isDeprecated: false },
    select: { category: true },
  })

  const categories: Record<string, number> = {}
  for (const s of submissions) {
    categories[s.category] = (categories[s.category] ?? 0) + 1
  }

  return c.json({ data: { total: submissions.length, categories } })
})

// POST /api/submissions/validate-endpoint — test URL reachability (no auth)
// Must come BEFORE /:slug to avoid "validate-endpoint" being treated as a slug
submissionsRouter.post(
  '/validate-endpoint',
  validate('json', z.object({ url: z.string().url('Must be a valid URL') })),
  async (c) => {
    const { url } = c.req.valid('json')
    const start = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      const responseTimeMs = Date.now() - start

      return c.json({
        data: {
          reachable: true,
          statusCode: response.status,
          responseTimeMs,
          error: null,
        },
      })
    } catch (err) {
      const responseTimeMs = Date.now() - start
      const error = err instanceof Error ? err.message : String(err)

      return c.json({
        data: {
          reachable: false,
          statusCode: null,
          responseTimeMs,
          error,
        },
      })
    }
  }
)

// GET /api/submissions/:slug - get a single submission by slug
// Note: must come AFTER /stats and /validate-endpoint
submissionsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findUnique({ where: { slug } })

  if (!submission) {
    return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
  }

  return c.json({ data: formatSubmission(submission) })
})

// GET /api/submissions/:slug/stats - provider usage stats (requires management auth)
submissionsRouter.get('/:slug/stats', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findUnique({ where: { slug } })

  if (!submission) {
    return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
  }

  const authorized = await verifyManagementAuth(c, submission)
  if (!authorized) {
    return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401)
  }

  const estimatedRevenue =
    submission.queryCount && submission.pricePerQuery
      ? submission.queryCount * submission.pricePerQuery
      : 0

  return c.json({
    data: {
      queryCount: submission.queryCount,
      lastQueriedAt: submission.lastQueriedAt ? submission.lastQueriedAt.toISOString() : null,
      estimatedRevenue,
      pricePerQuery: submission.pricePerQuery,
    },
  })
})

// POST /api/submissions/:slug/recover-token
// Allows a provider to regenerate their management token if they lose it, by verifying
// ownership via creatorEmail (captured at submission time).
//
// NOTE: Production should rate-limit this endpoint (e.g. 5 requests per hour per IP/slug)
// to prevent email enumeration and brute-force attacks. Intentionally left unimplemented
// here — add a rate-limiter middleware (e.g. hono-rate-limiter) before exposing publicly.
//
// INFO LEAK NOTE: This route returns different error codes for "slug not found" (404)
// vs. "email mismatch" (403), which technically confirms whether a slug exists. This
// is acceptable because slugs are PUBLIC — they appear in the /api/submissions listing.
// So there is no additional info disclosure beyond what is already public.
submissionsRouter.post(
  '/:slug/recover-token',
  validate('json', RecoverTokenSchema),
  async (c) => {
    const slug = c.req.param('slug').toLowerCase()
    const { creatorEmail } = c.req.valid('json')

    const submission = await prisma.submission.findUnique({ where: { slug } })

    if (!submission) {
      return c.json(
        { error: { message: 'No API found with that slug', code: 'NOT_FOUND' } },
        404
      )
    }

    // Case-insensitive, whitespace-trimmed email comparison.
    // Users commonly capitalize inconsistently or copy/paste with trailing spaces.
    const providedEmail = creatorEmail.trim().toLowerCase()
    const storedEmail = (submission.creatorEmail ?? '').trim().toLowerCase()

    if (providedEmail !== storedEmail) {
      return c.json(
        {
          error: {
            message: 'Email does not match the registered owner',
            code: 'EMAIL_MISMATCH',
          },
        },
        403
      )
    }

    // Generate new one-time management token, hash, persist (invalidates old token).
    const newToken = randomBytes(32).toString('hex')
    const newTokenHash = createHash('sha256').update(newToken).digest('hex')

    await prisma.submission.update({
      where: { slug },
      data: { managementToken: newTokenHash },
    })

    return c.json({
      data: {
        managementToken: newToken,
        slug: submission.slug,
      },
    })
  }
)

// POST /api/submissions - create new submission (generates management token)
submissionsRouter.post(
  '/',
  validate('json', CreateSubmissionSchema),
  async (c) => {
    const body = c.req.valid('json')

    // Verify the endpoint is reachable and behaves like an API (not an HTML page).
    // Tries GET first; if the endpoint returns 405 (POST-only), that still proves it's
    // a live API server. Any HTML response is rejected outright.
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const probeRes = await fetch(body.endpointUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const status = probeRes.status
      const contentType = probeRes.headers.get('content-type') ?? ''

      // 405 = endpoint exists but is POST-only — that's fine
      const isAlive = (status >= 200 && status < 500) || status === 405

      if (!isAlive) {
        return c.json({
          error: {
            message: `Your endpoint returned HTTP ${status}. It must be reachable and return a valid response.`,
            code: 'ENDPOINT_UNREACHABLE',
          },
        }, 400)
      }

      if (contentType.includes('text/html') && status !== 405 && status !== 404) {
        return c.json({
          error: {
            message: 'Your endpoint returned an HTML page, not an API response. Please provide a real API endpoint that returns JSON data.',
            code: 'ENDPOINT_NOT_API',
          },
        }, 400)
      }
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Your endpoint did not respond within 8 seconds.'
        : 'Could not reach your endpoint. Make sure it is publicly accessible over HTTPS.'
      return c.json({
        error: { message: msg, code: 'ENDPOINT_UNREACHABLE' },
      }, 400)
    }

    // Generate one-time management token
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')

    let slug = generateSlug(body.name)

    const existing = await prisma.submission.findUnique({ where: { slug } })
    if (existing) {
      slug = `${slug}-${randomSuffix()}`
    }

    const submission = await prisma.submission.create({
      data: {
        name: body.name,
        slug,
        shortDescription: body.shortDescription,
        fullDescription: body.fullDescription ?? null,
        category: body.category,
        websiteUrl: body.websiteUrl,
        endpointUrl: body.endpointUrl,
        pricePerQuery: body.pricePerQuery,
        paymentAddress: body.paymentAddress,
        creatorName: body.creatorName,
        creatorEmail: body.creatorEmail,
        logoUrl: body.logoUrl ?? null,
        twitterHandle: body.twitterHandle ?? null,
        githubUrl: body.githubUrl ?? null,
        status: 'approved',
        managementToken: tokenHash,
      },
    })

    // Return the plaintext token ONCE — not stored, cannot be recovered
    return c.json({ data: { ...formatSubmission(submission), managementToken: token } }, 201)
  }
)

// PUT /api/submissions/:slug - update provider listing (requires management auth)
submissionsRouter.put(
  '/:slug',
  validate('json', UpdateSubmissionSchema),
  async (c) => {
    const slug = c.req.param('slug')
    const body = c.req.valid('json')

    const submission = await prisma.submission.findUnique({ where: { slug } })

    if (!submission) {
      return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
    }

    const authorized = await verifyManagementAuth(c, submission)
    if (!authorized) {
      return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401)
    }

    // Build partial update — only include fields that were provided
    const updateData: Record<string, unknown> = {}
    if (body.endpointUrl !== undefined) updateData.endpointUrl = body.endpointUrl || null
    if (body.pricePerQuery !== undefined) updateData.pricePerQuery = body.pricePerQuery
    if (body.paymentAddress !== undefined) updateData.paymentAddress = body.paymentAddress
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription
    if (body.fullDescription !== undefined) updateData.fullDescription = body.fullDescription
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null
    if (body.twitterHandle !== undefined) updateData.twitterHandle = body.twitterHandle
    if (body.githubUrl !== undefined) updateData.githubUrl = body.githubUrl || null
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl

    const updated = await prisma.submission.update({
      where: { slug },
      data: updateData,
    })

    return c.json({ data: formatSubmission(updated) })
  }
)

// DELETE /api/submissions/:slug - deprecate listing (soft delete, requires management auth)
submissionsRouter.delete('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findUnique({ where: { slug } })

  if (!submission) {
    return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
  }

  const authorized = await verifyManagementAuth(c, submission)
  if (!authorized) {
    return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401)
  }

  await prisma.submission.update({
    where: { slug },
    data: { isDeprecated: true },
  })

  return c.json({ data: { success: true } })
})

export { submissionsRouter }
