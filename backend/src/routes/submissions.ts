import { Hono } from 'hono'
import { z } from 'zod'
import { randomBytes, createHash } from 'crypto'
import type { Context } from 'hono'
import { Resend } from 'resend'
import { CreateSubmissionSchema, UpdateSubmissionSchema, RecoverTokenSchema, RequestRecoverySchema } from '../types.js'
import { validate } from '../lib/validator.js'
import { logger, rateLimit, verifyAdminSecret } from '../lib/mpp.js'
import { prisma } from '../lib/db.js'
import { checkVerificationToken } from '../lib/verification.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  solanaAddress: string | null
  creatorName: string
  logoUrl: string | null
  twitterHandle: string | null
  githubUrl: string | null
  status: string
  queryCount: number
  lastQueriedAt: Date | null
  managementToken: string | null
  isDeprecated: boolean
  verificationToken: string | null
  isVerified: boolean
  verifyFailCount: number
  lastVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// INTENTIONAL: creatorEmail excluded as PII protection
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
    solanaAddress: s.solanaAddress,
    creatorName: s.creatorName,
    logoUrl: s.logoUrl,
    twitterHandle: s.twitterHandle,
    githubUrl: s.githubUrl,
    status: s.status,
    queryCount: s.queryCount,
    lastQueriedAt: s.lastQueriedAt ? s.lastQueriedAt.toISOString() : null,
    isVerified: s.isVerified,
    verifyFailCount: s.verifyFailCount,
    lastVerifiedAt: s.lastVerifiedAt ? s.lastVerifiedAt.toISOString() : null,
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

async function probeEndpoint(url: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const probeRes = await fetch(url, { method: 'GET', signal: controller.signal })
    clearTimeout(timeoutId)

    const status = probeRes.status
    const contentType = probeRes.headers.get('content-type') ?? ''

    const isAlive = (status >= 200 && status < 500) || status === 405
    if (!isAlive) {
      return { ok: false, message: `Your endpoint returned HTTP ${status}. It must be reachable and return a valid response.` }
    }

    if (contentType.includes('text/html') && status !== 405 && status !== 404) {
      return { ok: false, message: 'Your endpoint returned an HTML page, not an API response. Please provide a real API endpoint that returns JSON data.' }
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'Your endpoint did not respond within 8 seconds.'
      : 'Could not reach your endpoint. Make sure it is publicly accessible over HTTPS.'
    return { ok: false, message: msg }
  }
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
        endpointUrl: { not: null },
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

// Admin: hard-delete a submission by slug (requires MPP_SECRET_KEY)
submissionsRouter.delete('/admin/:slug', async (c) => {
  const secret = c.req.header('x-admin-key')
  if (!verifyAdminSecret(secret)) {
    return c.json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } }, 403)
  }
  const slug = c.req.param('slug')
  try {
    await prisma.submission.delete({ where: { slug } })
    logger.info('Admin deleted submission', { slug })
    return c.json({ data: { deleted: slug } })
  } catch {
    return c.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, 404)
  }
})

// Admin: clear all submissions and seed with MPP32 listing (requires MPP_SECRET_KEY)
submissionsRouter.post('/admin/reset-and-seed', async (c) => {
  const secret = c.req.header('x-admin-key')
  if (!verifyAdminSecret(secret)) {
    return c.json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } }, 403)
  }

  const deleted = await prisma.submission.deleteMany({})
  logger.info('Admin cleared all submissions', { count: deleted.count })

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const verificationToken = randomBytes(32).toString('hex')

  const mpp32 = await prisma.submission.create({
    data: {
      name: 'MPP32 Solana Intelligence Oracle',
      slug: 'mpp32-intelligence',
      shortDescription: 'Real-time Solana token intelligence with alpha scores, rug risk, whale tracking, and market data from DexScreener, Jupiter, and CoinGecko.',
      fullDescription: 'The MPP32 Intelligence Oracle provides comprehensive on-chain analysis for any Solana token. Submit a token address or ticker and receive alpha score (0-100), rug risk assessment, whale activity tracking, smart money signals, 24h pump probability, projected ROI ranges, and full market data. Data sourced in real-time from DexScreener, Jupiter Price API, and CoinGecko. Accepts all 5 payment protocols: Tempo, x402, ACP, AP2, and AGTP. M32 token holders receive up to 40% discount.',
      category: 'token-scanner',
      websiteUrl: 'https://mpp32.org',
      endpointUrl: 'https://mpp32.org/api/intelligence',
      pricePerQuery: 0.008,
      paymentAddress: '0x2a87Da867d725aA8853dc88548Ad6C64bBb456c1',
      solanaAddress: '9Pa8yUe8k1aRAoS1J8T5d4Mc4zXH2QTKiHE7wibowt6S',
      creatorName: 'MPP32',
      creatorEmail: 'admin@mpp32.org',
      logoUrl: '/logo-mpp32.jpg',
      twitterHandle: 'MPP32_dev',
      githubUrl: 'https://github.com/MPP32/MPP32',
      status: 'featured',
      managementToken: tokenHash,
      verificationToken,
      isVerified: true,
      verifyFailCount: 0,
      lastVerifiedAt: new Date(),
    },
  })

  logger.info('Admin seeded MPP32 listing', { slug: mpp32.slug })

  return c.json({
    data: {
      cleared: deleted.count,
      seeded: formatSubmission(mpp32),
      managementToken: token,
      verificationToken,
    },
  })
})

// Admin: recover management token directly (requires MPP_SECRET_KEY)
submissionsRouter.post('/admin/:slug/recover', async (c) => {
  const secret = c.req.header('x-admin-key')
  if (!verifyAdminSecret(secret)) {
    return c.json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } }, 403)
  }
  const slug = c.req.param('slug')
  const submission = await prisma.submission.findUnique({ where: { slug } })
  if (!submission) {
    return c.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, 404)
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')

  await prisma.submission.update({
    where: { slug },
    data: { managementToken: tokenHash },
  })

  logger.info('Admin recovered management token', { slug })

  return c.json({ data: { slug, managementToken: token } })
})

// POST /api/submissions/validate-endpoint — test URL reachability (no auth)
submissionsRouter.post(
  '/validate-endpoint',
  rateLimit({ name: 'validate-endpoint', max: 10, windowMs: 60_000 }),
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
submissionsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findFirst({
    where: { slug, status: { in: ['approved', 'featured'] }, isDeprecated: false },
  })

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

  // Pull enriched metrics from ApiRequest audit log
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [requestsAll, requests24h, requests7d] = await Promise.all([
    prisma.apiRequest.aggregate({
      where: { submissionSlug: slug },
      _count: true,
      _avg: { latencyMs: true },
    }),
    prisma.apiRequest.count({
      where: { submissionSlug: slug, createdAt: { gte: last24h } },
    }),
    prisma.apiRequest.count({
      where: { submissionSlug: slug, createdAt: { gte: last7d } },
    }),
  ])

  const successCount = await prisma.apiRequest.count({
    where: { submissionSlug: slug, statusCode: { lt: 400 }, errorCode: null },
  })

  const errorCount = await prisma.apiRequest.count({
    where: { submissionSlug: slug, errorCode: { not: null } },
  })

  const totalRequests = requestsAll._count
  const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 10000) / 100 : 100

  return c.json({
    data: {
      queryCount: submission.queryCount,
      lastQueriedAt: submission.lastQueriedAt ? submission.lastQueriedAt.toISOString() : null,
      estimatedRevenue,
      pricePerQuery: submission.pricePerQuery,
      totalRequests,
      requestsLast24h: requests24h,
      requestsLast7d: requests7d,
      successRate,
      avgLatencyMs: Math.round(requestsAll._avg.latencyMs ?? 0),
      errorCount,
    },
  })
})

// POST /api/submissions/:slug/request-recovery — Step 1: email OTP
submissionsRouter.post(
  '/:slug/request-recovery',
  rateLimit({ name: 'recovery', max: 5, windowMs: 15 * 60 * 1000 }),
  validate('json', RequestRecoverySchema),
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

    const otpBytes = new Uint32Array(1)
    crypto.getRandomValues(otpBytes)
    const otp = String(100000 + (otpBytes[0]! % 900000))
    const otpHash = createHash('sha256').update(otp).digest('hex')
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.submission.update({
      where: { slug },
      data: { recoveryCode: otpHash, recoveryExpiry: expiry },
    })

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px">
          <h2 style="color:#1a1a1a;margin:0">MPP32 Token Recovery</h2>
        </div>
        <p style="color:#333;line-height:1.6">Your verification code for recovering the management token for <strong>${submission.name}</strong> is:</p>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;text-align:center;padding:20px;margin:20px 0">
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#92400e;font-family:monospace">${otp}</div>
        </div>
        <p style="color:#666;line-height:1.6">This code expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #eee">If you did not request this, you can safely ignore this email. — MPP32 Team</p>
      </div>
    `

    if (resend) {
      // Try verified domain first, fall back to Resend test sender
      const senders = ['MPP32 <noreply@mpp32.org>', 'MPP32 <onboarding@resend.dev>']
      let sent = false
      for (const sender of senders) {
        const { error } = await resend.emails.send({
          from: sender,
          to: submission.creatorEmail,
          subject: 'Your MPP32 token recovery code',
          html: emailHtml,
        })
        if (!error) {
          sent = true
          break
        }
        logger.warn('Email send attempt failed', { slug, sender, error: JSON.stringify(error) })
      }
      if (!sent) {
        logger.error('All email senders failed', { slug, to: submission.creatorEmail })
        return c.json(
          { error: { message: 'Email delivery is temporarily unavailable. Contact support for manual recovery.', code: 'EMAIL_FAILED' } },
          503
        )
      }
    } else {
      logger.info('DEV FALLBACK — OTP generated', { slug, otp })
    }

    return c.json({ data: { message: 'Verification code sent to your email' } })
  }
)

// POST /api/submissions/:slug/recover-token — Step 2: verify OTP, issue token
submissionsRouter.post(
  '/:slug/recover-token',
  rateLimit({ name: 'recovery', max: 5, windowMs: 15 * 60 * 1000 }),
  validate('json', RecoverTokenSchema),
  async (c) => {
    const slug = c.req.param('slug').toLowerCase()
    const { code } = c.req.valid('json')

    const submission = await prisma.submission.findUnique({ where: { slug } })

    if (!submission) {
      return c.json(
        { error: { message: 'No API found with that slug', code: 'NOT_FOUND' } },
        404
      )
    }

    const codeHash = createHash('sha256').update(code).digest('hex')
    const now = new Date()

    const validCode =
      submission.recoveryCode !== null &&
      submission.recoveryCode === codeHash &&
      submission.recoveryExpiry !== null &&
      submission.recoveryExpiry > now

    if (!validCode) {
      return c.json(
        {
          error: {
            message: 'Invalid or expired verification code',
            code: 'INVALID_CODE',
          },
        },
        400
      )
    }

    const newToken = randomBytes(32).toString('hex')
    const newTokenHash = createHash('sha256').update(newToken).digest('hex')

    await prisma.submission.update({
      where: { slug },
      data: {
        managementToken: newTokenHash,
        recoveryCode: null,
        recoveryExpiry: null,
      },
    })

    logger.info('Token recovered', { slug })

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
  rateLimit({ name: 'create-submission', max: 5, windowMs: 60_000 }),
  validate('json', CreateSubmissionSchema),
  async (c) => {
    const body = c.req.valid('json')

    const probe = await probeEndpoint(body.endpointUrl)
    if (!probe.ok) {
      return c.json({
        error: { message: probe.message, code: 'ENDPOINT_UNREACHABLE' },
      }, 400)
    }

    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const verificationToken = randomBytes(32).toString('hex')

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
        solanaAddress: body.solanaAddress ?? null,
        creatorName: body.creatorName,
        creatorEmail: body.creatorEmail,
        logoUrl: body.logoUrl ?? null,
        twitterHandle: body.twitterHandle ?? null,
        githubUrl: body.githubUrl ?? null,
        status: 'approved',
        managementToken: tokenHash,
        verificationToken,
        isVerified: false,
        verifyFailCount: 0,
      },
    })

    logger.info('Submission created', { slug, name: body.name })

    return c.json({ data: { ...formatSubmission(submission), managementToken: token, verificationToken } }, 201)
  }
)

// PUT /api/submissions/:slug - update provider listing (requires management auth)
submissionsRouter.put(
  '/:slug',
  rateLimit({ name: 'update-submission', max: 10, windowMs: 60_000 }),
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

    // Validate new endpoint if provided
    if (body.endpointUrl && body.endpointUrl !== submission.endpointUrl) {
      const probe = await probeEndpoint(body.endpointUrl)
      if (!probe.ok) {
        return c.json({
          error: { message: probe.message, code: 'ENDPOINT_UNREACHABLE' },
        }, 400)
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.endpointUrl !== undefined) updateData.endpointUrl = body.endpointUrl || null
    if (body.pricePerQuery !== undefined) updateData.pricePerQuery = body.pricePerQuery
    if (body.paymentAddress !== undefined) updateData.paymentAddress = body.paymentAddress
    if (body.solanaAddress !== undefined) updateData.solanaAddress = body.solanaAddress || null
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription
    if (body.fullDescription !== undefined) updateData.fullDescription = body.fullDescription
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null
    if (body.twitterHandle !== undefined) updateData.twitterHandle = body.twitterHandle
    if (body.githubUrl !== undefined) updateData.githubUrl = body.githubUrl || null
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl

    // When endpointUrl changes, regenerate verification token and reset verification status
    if (body.endpointUrl && body.endpointUrl !== submission.endpointUrl) {
      const newVerificationToken = randomBytes(32).toString('hex')
      updateData.verificationToken = newVerificationToken
      updateData.isVerified = false
      updateData.verifyFailCount = 0
      updateData.lastVerifiedAt = null
    }

    const updated = await prisma.submission.update({
      where: { slug },
      data: updateData,
    })

    logger.info('Submission updated', { slug, fields: Object.keys(updateData) })

    const response: Record<string, unknown> = { ...formatSubmission(updated) }
    // Include the new verification token when endpoint URL was changed
    if (updateData.verificationToken) {
      response.verificationToken = updateData.verificationToken
    }

    return c.json({ data: response })
  }
)

// GET /api/submissions/:slug/verification — get verification status and token (requires management auth)
submissionsRouter.get('/:slug/verification', async (c) => {
  const slug = c.req.param('slug')

  const submission = await prisma.submission.findUnique({ where: { slug } })

  if (!submission) {
    return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
  }

  const authorized = await verifyManagementAuth(c, submission)
  if (!authorized) {
    return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401)
  }

  const verifyUrl = submission.endpointUrl
    ? new URL('/.well-known/mpp32-verify', submission.endpointUrl).toString()
    : null

  return c.json({
    data: {
      verificationToken: submission.verificationToken,
      isVerified: submission.isVerified,
      verifyFailCount: submission.verifyFailCount,
      lastVerifiedAt: submission.lastVerifiedAt ? submission.lastVerifiedAt.toISOString() : null,
      expectedUrl: verifyUrl,
    },
  })
})

// POST /api/submissions/:slug/verify — trigger endpoint verification (requires management auth, rate-limited)
submissionsRouter.post(
  '/:slug/verify',
  rateLimit({ name: 'verify-endpoint', max: 5, windowMs: 60_000 }),
  async (c) => {
    const slug = c.req.param('slug')

    const submission = await prisma.submission.findUnique({ where: { slug } })

    if (!submission) {
      return c.json({ error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404)
    }

    const authorized = await verifyManagementAuth(c, submission)
    if (!authorized) {
      return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401)
    }

    if (!submission.endpointUrl) {
      return c.json({ error: { message: 'No endpoint URL configured', code: 'NO_ENDPOINT' } }, 422)
    }

    if (!submission.verificationToken) {
      return c.json({ error: { message: 'No verification token generated', code: 'NO_TOKEN' } }, 422)
    }

    const result = await checkVerificationToken(submission.endpointUrl, submission.verificationToken)

    if (result.ok) {
      await prisma.submission.update({
        where: { slug },
        data: {
          isVerified: true,
          verifyFailCount: 0,
          lastVerifiedAt: new Date(),
        },
      })

      logger.info('Endpoint verification succeeded', { slug })

      return c.json({ data: { verified: true } })
    }

    // Increment fail count but do not suspend on manual verification attempts
    await prisma.submission.update({
      where: { slug },
      data: {
        verifyFailCount: { increment: 1 },
      },
    })

    logger.warn('Endpoint verification failed', { slug, error: result.message })

    return c.json({ data: { verified: false, error: result.message } })
  }
)

// DELETE /api/submissions/:slug - deprecate listing (soft delete, requires management auth)
submissionsRouter.delete(
  '/:slug',
  rateLimit({ name: 'delete-submission', max: 5, windowMs: 60_000 }),
  async (c) => {
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

  logger.info('Submission deprecated', { slug })

  return c.json({ data: { success: true } })
})

export { submissionsRouter }
