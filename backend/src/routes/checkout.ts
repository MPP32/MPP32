import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/db.js'
import { rateLimit } from '../lib/mpp.js'

const checkoutRouter = new Hono()

const CreateSessionSchema = z.object({
  resource: z.string().min(1).max(500),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a numeric string'),
  currency: z.string().max(10).default('USD'),
  agentId: z.string().min(1).max(256).optional(),
  merchantId: z.string().max(256).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ttlSeconds: z.number().int().min(60).max(3600).default(300),
})

const CompleteSessionSchema = z.object({
  paymentProof: z.string().min(1).max(4096),
})

// Create a checkout session
checkoutRouter.post(
  '/sessions',
  rateLimit({ name: 'checkout-create', max: 30, windowMs: 60_000 }),
  zValidator('json', CreateSessionSchema),
  async (c) => {
    const body = c.req.valid('json')
    const sessionId = `acp_${randomBytes(24).toString('hex')}`
    const expiresAt = new Date(Date.now() + body.ttlSeconds * 1000)

    const session = await prisma.checkoutSession.create({
      data: {
        sessionId,
        resource: body.resource,
        amount: body.amount,
        currency: body.currency,
        agentId: body.agentId,
        merchantId: body.merchantId,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        expiresAt,
        status: 'pending',
      },
    })

    return c.json({
      sessionId: session.sessionId,
      resource: session.resource,
      amount: session.amount,
      currency: session.currency,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      completeUrl: `/api/checkout/sessions/${session.sessionId}/complete`,
    }, 201)
  },
)

// Get session status
checkoutRouter.get(
  '/sessions/:sessionId',
  rateLimit({ name: 'checkout-status', max: 60, windowMs: 60_000 }),
  async (c) => {
    const sessionId = c.req.param('sessionId')
    const session = await prisma.checkoutSession.findUnique({ where: { sessionId } })

    if (!session) {
      return c.json({ error: { message: 'Session not found', code: 'SESSION_NOT_FOUND' } }, 404)
    }

    if (session.status === 'pending' && session.expiresAt <= new Date()) {
      await prisma.checkoutSession.update({ where: { sessionId }, data: { status: 'expired' } })
      session.status = 'expired'
    }

    return c.json({
      sessionId: session.sessionId,
      resource: session.resource,
      amount: session.amount,
      currency: session.currency,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    })
  },
)

// Complete a checkout session (agent confirms payment)
checkoutRouter.post(
  '/sessions/:sessionId/complete',
  rateLimit({ name: 'checkout-complete', max: 20, windowMs: 60_000 }),
  zValidator('json', CompleteSessionSchema),
  async (c) => {
    const sessionId = c.req.param('sessionId')
    const { paymentProof } = c.req.valid('json')

    const session = await prisma.checkoutSession.findUnique({ where: { sessionId } })

    if (!session) {
      return c.json({ error: { message: 'Session not found', code: 'SESSION_NOT_FOUND' } }, 404)
    }

    if (session.status === 'completed') {
      return c.json({ error: { message: 'Session already completed', code: 'ALREADY_COMPLETED' } }, 409)
    }

    if (session.status === 'canceled') {
      return c.json({ error: { message: 'Session was canceled', code: 'SESSION_CANCELED' } }, 410)
    }

    if (session.expiresAt <= new Date()) {
      await prisma.checkoutSession.update({ where: { sessionId }, data: { status: 'expired' } })
      return c.json({ error: { message: 'Session has expired', code: 'SESSION_EXPIRED' } }, 410)
    }

    // Store payment proof and mark as completed
    const existing = session.metadata ? JSON.parse(session.metadata) : {}
    const updatedMetadata = { ...existing, paymentProof }

    await prisma.checkoutSession.update({
      where: { sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        metadata: JSON.stringify(updatedMetadata),
      },
    })

    return c.json({
      sessionId,
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
  },
)

// Cancel a checkout session
checkoutRouter.delete(
  '/sessions/:sessionId',
  rateLimit({ name: 'checkout-cancel', max: 20, windowMs: 60_000 }),
  async (c) => {
    const sessionId = c.req.param('sessionId')
    const session = await prisma.checkoutSession.findUnique({ where: { sessionId } })

    if (!session) {
      return c.json({ error: { message: 'Session not found', code: 'SESSION_NOT_FOUND' } }, 404)
    }

    if (session.status === 'completed') {
      return c.json({ error: { message: 'Cannot cancel a completed session', code: 'ALREADY_COMPLETED' } }, 409)
    }

    await prisma.checkoutSession.update({ where: { sessionId }, data: { status: 'canceled' } })

    return c.json({ sessionId, status: 'canceled' })
  },
)

export { checkoutRouter }
