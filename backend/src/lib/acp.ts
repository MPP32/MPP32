import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'
import type { ACPVerificationResult } from '../types.js'

export const ACP_ERROR_CODES = {
  INVALID_SESSION: 'ACP_INVALID_SESSION',
  EXPIRED_SESSION: 'ACP_EXPIRED_SESSION',
  PAYMENT_INCOMPLETE: 'ACP_PAYMENT_INCOMPLETE',
  SESSION_CANCELED: 'ACP_SESSION_CANCELED',
  AMOUNT_MISMATCH: 'ACP_AMOUNT_MISMATCH',
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
    description: 'Agent Commerce Protocol session supported — include X-ACP-Session header with checkout session ID or base64-encoded session credential',
    requiredHeaders: ['X-ACP-Session'],
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
  let sessionData: Record<string, unknown> | null = null
  let sessionId: string

  // Try base64-encoded JSON first
  try {
    const decoded = Buffer.from(sessionHeader, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    if (typeof parsed === 'object' && parsed !== null) {
      sessionData = parsed as Record<string, unknown>
      sessionId = (parsed.sessionId as string) ?? (parsed.id as string) ?? sessionHeader
    } else {
      sessionId = sessionHeader
    }
  } catch {
    // Plain session ID string
    sessionId = sessionHeader
  }

  if (!sessionId || sessionId.length < 4) {
    return { verified: false, error: 'Invalid ACP session identifier', errorCode: ACP_ERROR_CODES.INVALID_SESSION }
  }

  // If structured session data, validate fields
  if (sessionData) {
    const status = sessionData.status as string | undefined
    if (status === 'canceled') {
      return { verified: false, sessionId, status: 'canceled', error: 'ACP session was canceled', errorCode: ACP_ERROR_CODES.SESSION_CANCELED }
    }
    if (status === 'expired') {
      return { verified: false, sessionId, status: 'expired', error: 'ACP session has expired', errorCode: ACP_ERROR_CODES.EXPIRED_SESSION }
    }
    if (status === 'incomplete') {
      return { verified: false, sessionId, status: 'incomplete', error: 'ACP payment not yet completed', errorCode: ACP_ERROR_CODES.PAYMENT_INCOMPLETE }
    }

    // Validate expiry
    const expiresAt = sessionData.expiresAt as string | undefined
    if (expiresAt) {
      const expiry = new Date(expiresAt)
      if (!isNaN(expiry.getTime()) && expiry <= new Date()) {
        return { verified: false, sessionId, status: 'expired', error: 'ACP session has expired', errorCode: ACP_ERROR_CODES.EXPIRED_SESSION }
      }
    }

    // Validate amount if present
    const sessionAmount = sessionData.amount as string | undefined
    if (sessionAmount) {
      const requested = parseFloat(amount)
      const authorized = parseFloat(sessionAmount)
      if (!isNaN(requested) && !isNaN(authorized) && requested > authorized) {
        return {
          verified: false,
          sessionId,
          error: `Requested amount $${amount} exceeds session authorization $${sessionAmount}`,
          errorCode: ACP_ERROR_CODES.AMOUNT_MISMATCH,
        }
      }
    }

    // Validate resource scope
    const scope = sessionData.resource as string | undefined
    if (scope && !resource.startsWith(scope)) {
      return { verified: false, sessionId, error: `Resource ${resource} not covered by session scope`, errorCode: ACP_ERROR_CODES.INVALID_SESSION }
    }
  }

  logger.info('ACP session verified', { sessionId, resource, amount })
  return {
    verified: true,
    sessionId,
    status: (sessionData?.status as 'completed' | undefined) ?? 'completed',
    merchantId: sessionData?.merchantId as string | undefined,
    amount,
  }
}
