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
} as const

const VALID_INTENTS = new Set([
  'QUERY', 'SUMMARIZE', 'BOOK', 'SCHEDULE', 'LEARN',
  'DELEGATE', 'COLLABORATE', 'CONFIRM', 'ESCALATE',
  'NOTIFY', 'DESCRIBE', 'SUSPEND',
])

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

export function createAGTPChallenge(resource: string): string {
  const challenge = {
    protocol: 'agtp',
    version: 'draft-hood-independent-agtp-01',
    resource,
    description: 'Agent Transfer Protocol identity supported — include Agent-ID header with agent identifier for enhanced tracking and priority routing',
    supportedMethods: ['QUERY', 'SUMMARIZE', 'BOOK', 'SCHEDULE', 'DELEGATE', 'COLLABORATE'],
    requiredHeaders: ['Agent-ID'],
    optionalHeaders: ['Principal-ID', 'Authority-Scope', 'AGTP-Session-ID', 'AGTP-Task-ID', 'Budget-Limit'],
  }
  return Buffer.from(JSON.stringify(challenge)).toString('base64')
}

export async function verifyAGTPAgent(
  headers: AGTPHeaders,
  resource: string,
  amount?: string,
): Promise<AGTPVerificationResult> {
  const { agentId, principalId, authorityScope, budgetLimit } = headers

  // Validate agent ID format: must be non-empty, reasonable length
  if (!agentId || agentId.length < 2 || agentId.length > 512) {
    return { verified: false, error: 'Invalid Agent-ID format', errorCode: AGTP_ERROR_CODES.INVALID_AGENT_ID }
  }

  // Validate authority scope if present — must cover the requested resource
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
