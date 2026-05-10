import { createHmac, createVerify, timingSafeEqual } from 'crypto'
import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'
import { AGTPHeadersSchema } from '../types.js'
import type { AGTPHeaders, AGTPVerificationResult } from '../types.js'

export const AGTP_ERROR_CODES = {
  MISSING_AGENT_ID: 'AGTP_MISSING_AGENT_ID',
  INVALID_AGENT_ID: 'AGTP_INVALID_AGENT_ID',
  SCOPE_VIOLATION: 'AGTP_SCOPE_VIOLATION',
  BUDGET_EXCEEDED: 'AGTP_BUDGET_EXCEEDED',
  INVALID_INTENT: 'AGTP_INVALID_INTENT',
  AGENT_UNVERIFIED: 'AGTP_AGENT_UNVERIFIED',
  SIGNATURE_MISSING: 'AGTP_SIGNATURE_MISSING',
  SIGNATURE_INVALID: 'AGTP_SIGNATURE_INVALID',
  TIMESTAMP_EXPIRED: 'AGTP_TIMESTAMP_EXPIRED',
} as const

const VALID_INTENTS = new Set([
  'QUERY', 'SUMMARIZE', 'BOOK', 'SCHEDULE', 'LEARN',
  'DELEGATE', 'COLLABORATE', 'CONFIRM', 'ESCALATE',
  'NOTIFY', 'DESCRIBE', 'SUSPEND',
])

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

export function isAGTPEnabled(): boolean {
  return env.AGTP_ENABLED === 'true'
}

export function isAGTPRequest(c: Context): boolean {
  return !!(c.req.header('agent-id') || c.req.header('x-agent-id'))
}

export function getAGTPHeaders(c: Context): AGTPHeaders | null {
  const agentId = c.req.header('agent-id') ?? c.req.header('x-agent-id')
  if (!agentId) return null

  const raw = {
    agentId,
    principalId: c.req.header('principal-id') ?? c.req.header('x-principal-id') ?? undefined,
    authorityScope: c.req.header('authority-scope') ?? c.req.header('x-authority-scope') ?? undefined,
    sessionId: c.req.header('agtp-session-id') ?? c.req.header('x-agtp-session') ?? undefined,
    taskId: c.req.header('agtp-task-id') ?? c.req.header('x-agtp-task') ?? undefined,
    delegationChain: c.req.header('delegation-chain') ?? c.req.header('x-delegation-chain') ?? undefined,
    budgetLimit: c.req.header('budget-limit') ?? c.req.header('x-budget-limit') ?? undefined,
  }

  const result = AGTPHeadersSchema.safeParse(raw)
  if (!result.success) return null
  return result.data
}

export function getAGTPIntentMethod(c: Context): string | null {
  const intent = c.req.header('x-agtp-intent') ?? c.req.header('agtp-intent')
  if (!intent) return null
  const upper = intent.toUpperCase()
  return VALID_INTENTS.has(upper) ? upper : null
}

export function getAGTPSignature(c: Context): { signature: string; timestamp: string } | null {
  const signature = c.req.header('agent-signature') ?? c.req.header('x-agent-signature')
  const timestamp = c.req.header('agent-timestamp') ?? c.req.header('x-agent-timestamp')
  if (!signature || !timestamp) return null
  return { signature, timestamp }
}

export function createAGTPChallenge(resource: string): string {
  const challenge = {
    protocol: 'agtp',
    version: 'draft-hood-independent-agtp-01',
    resource,
    description: 'Agent Transfer Protocol — include Agent-ID, Agent-Signature (HMAC-SHA256 of agentId:method:path:timestamp), and Agent-Timestamp headers',
    supportedMethods: ['QUERY', 'SUMMARIZE', 'BOOK', 'SCHEDULE', 'DELEGATE', 'COLLABORATE'],
    requiredHeaders: ['Agent-ID', 'Agent-Signature', 'Agent-Timestamp'],
    optionalHeaders: ['Principal-ID', 'Authority-Scope', 'AGTP-Session-ID', 'AGTP-Task-ID', 'Budget-Limit'],
    signatureFormat: 'HMAC-SHA256(agentId:METHOD:path:timestamp) — key is the agent\'s secret',
  }
  return Buffer.from(JSON.stringify(challenge)).toString('base64')
}

function verifySignature(agentId: string, signature: string, timestamp: string, method: string, path: string): boolean {
  // The signing input is deterministic: agentId:METHOD:path:timestamp
  const signingInput = `${agentId}:${method}:${path}:${timestamp}`

  // Try HMAC-SHA256 verification: signature = HMAC(signingInput, agentSecret)
  // The agent's secret is the agentId itself hashed — this is a basic trust model
  // where agents prove they know their own ID by producing a valid HMAC.
  // For production, agents would register their HMAC keys.
  try {
    const decoded = Buffer.from(signature, 'base64')
    if (decoded.length < 32) return false

    // Verify the HMAC was produced with a key derived from the agent ID
    // Agent computes: HMAC-SHA256(signingInput, SHA256(agentId))
    const agentKey = createHmac('sha256', 'mpp32-agtp-v1').update(agentId).digest()
    const expected = createHmac('sha256', agentKey).update(signingInput).digest()

    if (decoded.length !== expected.length) return false
    return timingSafeEqual(decoded, expected)
  } catch {
    return false
  }
}

export async function verifyAGTPAgent(
  headers: AGTPHeaders,
  resource: string,
  amount?: string,
  method?: string,
  signatureData?: { signature: string; timestamp: string } | null,
): Promise<AGTPVerificationResult> {
  const { agentId, principalId, authorityScope, budgetLimit } = headers

  if (!agentId || agentId.length < 2 || agentId.length > 512) {
    return { verified: false, error: 'Invalid Agent-ID format', errorCode: AGTP_ERROR_CODES.INVALID_AGENT_ID }
  }

  // Require cryptographic signature
  if (!signatureData) {
    return {
      verified: false,
      agentId,
      error: 'Agent-Signature and Agent-Timestamp headers required — sign agentId:METHOD:path:timestamp with HMAC-SHA256',
      errorCode: AGTP_ERROR_CODES.SIGNATURE_MISSING,
    }
  }

  // Validate timestamp freshness
  const ts = parseInt(signatureData.timestamp, 10)
  if (isNaN(ts)) {
    return { verified: false, agentId, error: 'Agent-Timestamp must be a Unix epoch in seconds', errorCode: AGTP_ERROR_CODES.TIMESTAMP_EXPIRED }
  }
  const age = Math.abs(Date.now() - ts * 1000)
  if (age > SIGNATURE_MAX_AGE_MS) {
    return { verified: false, agentId, error: 'Agent-Timestamp expired (max 5 minutes)', errorCode: AGTP_ERROR_CODES.TIMESTAMP_EXPIRED }
  }

  // Verify signature
  const requestMethod = method ?? 'POST'
  const isValid = verifySignature(agentId, signatureData.signature, signatureData.timestamp, requestMethod, resource)
  if (!isValid) {
    return { verified: false, agentId, error: 'Agent-Signature verification failed', errorCode: AGTP_ERROR_CODES.SIGNATURE_INVALID }
  }

  // Validate authority scope if present
  if (authorityScope) {
    const scopes = authorityScope.split(',').map(s => s.trim())
    const resourceDomain = resource.split('/').slice(0, 3).join('/')
    const hasScope = scopes.some(scope =>
      scope === '*' || resource.startsWith(scope) || resourceDomain.startsWith(scope)
    )
    if (!hasScope) {
      return {
        verified: false,
        agentId,
        principalId,
        error: `Agent authority scope does not cover resource ${resource}`,
        errorCode: AGTP_ERROR_CODES.SCOPE_VIOLATION,
      }
    }
  }

  // Validate budget limit if present
  if (budgetLimit && amount) {
    const budget = parseFloat(budgetLimit)
    const requested = parseFloat(amount)
    if (!isNaN(budget) && !isNaN(requested) && requested > budget) {
      return {
        verified: false,
        agentId,
        principalId,
        error: `Requested amount $${amount} exceeds agent budget limit $${budgetLimit}`,
        errorCode: AGTP_ERROR_CODES.BUDGET_EXCEEDED,
      }
    }
  }

  logger.info('AGTP agent verified', { agentId, principalId, authorityScope, resource })
  return {
    verified: true,
    agentId,
    principalId,
    authorityScope,
  }
}
