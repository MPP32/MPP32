import { Hono } from 'hono'
import { logger, verifyAdminSecret } from '../lib/mpp.js'
import { prisma } from '../lib/db.js'

const metricsRouter = new Hono()

// GET /api/metrics/overview — system-wide metrics (admin auth via x-admin-key)
metricsRouter.get('/overview', async (c) => {
  const secret = c.req.header('x-admin-key')
  if (!verifyAdminSecret(secret)) {
    return c.json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } }, 403)
  }

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [total, count24h, count7d, count30d, avgAgg, successTotal] = await Promise.all([
    prisma.apiRequest.count(),
    prisma.apiRequest.count({ where: { createdAt: { gte: last24h } } }),
    prisma.apiRequest.count({ where: { createdAt: { gte: last7d } } }),
    prisma.apiRequest.count({ where: { createdAt: { gte: last30d } } }),
    prisma.apiRequest.aggregate({ _avg: { latencyMs: true } }),
    prisma.apiRequest.count({ where: { statusCode: { lt: 400 }, errorCode: null } }),
  ])

  const successRate = total > 0 ? Math.round((successTotal / total) * 10000) / 100 : 100

  // Top services by request count
  const topServicesRaw = await prisma.apiRequest.groupBy({
    by: ['submissionSlug'],
    _count: true,
    orderBy: { _count: { submissionSlug: 'desc' } },
    take: 10,
  })
  const topServices = topServicesRaw.map((s) => ({
    slug: s.submissionSlug,
    requestCount: s._count,
  }))

  // Error breakdown by code
  const errorsRaw = await prisma.apiRequest.groupBy({
    by: ['errorCode'],
    where: { errorCode: { not: null } },
    _count: true,
  })
  const errorBreakdown: Record<string, number> = {}
  for (const e of errorsRaw) {
    if (e.errorCode) errorBreakdown[e.errorCode] = e._count
  }

  logger.info('Admin metrics overview accessed')

  return c.json({
    data: {
      totalRequests: total,
      requests24h: count24h,
      requests7d: count7d,
      requests30d: count30d,
      successRate,
      avgLatencyMs: Math.round(avgAgg._avg.latencyMs ?? 0),
      topServices,
      errorBreakdown,
    },
  })
})

export { metricsRouter }
