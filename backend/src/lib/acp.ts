import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'
import { prisma } from './db.js'
import type { ACPVerificationResult } from '../types.js'

export const ACP_ERROR_CODES = {
  INVALID_SESSION: 'ACP_INVALID_SESSION',
  EXPIRED_SESSION: 'ACP_EXPIRED_SESSION',
  PAYMENT_INCOMPLETE: 'ACP_PAYMENT_INCOMPLETE',
  SESSION_CANCELED: 'ACP_SESSION_CANCELED',
  AMOUNT_MISMATCH: 'ACP_AMOUNT_MISMATCH',
  SESSION_NOT_FOUND: 'ACP_SESSION_NOT_FOUND',
} as const

export function isACPEnabled(): boolean {
  return env.ACP_ENABLED === 'true'
}

export function isACPRequest(c: Context): boolean {
  return !!(c.req.header('x-acp-session') || c.req.header('acp-session-id'))
}

export function getACPSessionHeader(c: Context): string | null {
  return c.req.header('x-acp-session') ?? c.req.header('acp-session-id') ?? null
}

export function createACPChallenge(resource: string, amount: string): string {
  const challenge = {
    protocol: 'acp',
    version: '2026-04-17',
    resource,
    description: 'Agent Commerce Protocol — create a checkout session first via POST /api/checkout/sessions, then include the session ID in X-ACP-Session header',
    requiredHeaders: ['X-ACP-Session'],
    checkoutEndpoint: '/api/checkout/sessions',
    amount,
    currency: 'USD',
    capabilities: ['checkout', 'cart', 'payment'],
  }
  return Buffer.from(JSON.stringify(challenge)).toString('base64')
}

export async function verifyACPSession(
  sessionHeader: string,
  resource: string,
  amount: string,
): Promise<ACPVerificationResult> {
  let sessionId: string

  // Try base64-encoded JSON first (structured credential)
  try {
    const decoded = Buffer.from(sessionHeader, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    if (typeof parsed === 'object' && parsed !== null) {
      sessionId = (parsed.sessionId as string) ?? (parsed.id as string) ?? sessionHeader
    } else {
      sessionId = sessionHeader
    }
  } catch {
    sessionId = sessionHeader
  }

  if (!sessionId || sessionId.length < 4) {
    return { verified: false, error: 'Invalid ACP session identifier', errorCode: ACP_ERROR_CODES.INVALID_SESSION }
  }

  // Look up session in database
  const session = await prisma.checkoutSession.findUnique({
    where: { sessionId },
  })

  if (!session) {
    return { verified: false, sessionId, error: 'Checkout session not found — create one via POST /api/checkout/sessions', errorCode: ACP_ERROR_CODES.SESSION_NOT_FOUND }
  }

  if (session.status === 'canceled') {
    return { verified: false, sessionId, status: 'canceled', error: 'Checkout session was canceled', errorCode: ACP_ERROR_CODES.SESSION_CANCELED }
  }

  if (session.status === 'expired' || session.expiresAt <= new Date()) {
    if (session.status !== 'expired') {
      await prisma.checkoutSession.update({ where: { sessionId }, data: { status: 'expired' } })
    }
    return { verified: false, sessionId, status: 'expired', error: 'Checkout session has expired', errorCode: ACP_ERROR_CODES.EXPIRED_SESSION }
  }

  if (session.status !== 'completed') {
    return { verified: false, sessionId, status: 'incomplete', error: 'Checkout session payment not yet completed', errorCode: ACP_ERROR_CODES.PAYMENT_INCOMPLETE }
  }

  // Validate amount
  const requested = parseFloat(amount)
  const authorized = parseFloat(session.amount)
  if (!isNaN(requested) && !isNaN(authorized) && requested > authorized) {
    return {
      verified: false,
      sessionId,
      error: `Requested amount $${amount} exceeds session authorization $${session.amount}`,
      errorCode: ACP_ERROR_CODES.AMOUNT_MISMATCH,
    }
  }

  // Validate resource scope
  if (!resource.startsWith(session.resource) && session.resource !== '*') {
    return { verified: false, sessionId, error: `Resource ${resource} not covered by session scope ${session.resource}`, errorCode: ACP_ERROR_CODES.INVALID_SESSION }
  }

  logger.info('ACP session verified', { sessionId, resource, amount, merchantId: session.merchantId })
  return {
    verified: true,
    sessionId,
    status: 'completed',
    merchantId: session.merchantId ?? undefined,
    amount,
  }
}
