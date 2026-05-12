import { logger } from './mpp.js'

export interface EscrowQualityResult {
  settle: boolean
  reason?: string
}

export function evaluateEscrowQuality(
  upstreamStatus: number,
  bodyLength?: number,
): EscrowQualityResult {
  if (upstreamStatus >= 500) {
    return { settle: false, reason: `upstream-server-error-${upstreamStatus}` }
  }
  if (upstreamStatus === 0) {
    return { settle: false, reason: 'upstream-unreachable' }
  }
  if (upstreamStatus >= 200 && upstreamStatus < 300 && bodyLength !== undefined && bodyLength === 0) {
    return { settle: false, reason: 'empty-response-body' }
  }
  return { settle: true }
}

export interface EscrowSettlementOutcome {
  escrowStatus: 'settled' | 'skipped' | 'settle-failed'
  txSignature?: string
  payer?: string
  network?: string
  skipReason?: string
  error?: string
}

export function buildEscrowHeaders(outcome: EscrowSettlementOutcome): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Escrow-Status': outcome.escrowStatus,
    'X-Payment-Settled': String(outcome.escrowStatus === 'settled'),
  }
  if (outcome.txSignature) {
    headers['X-Settlement-Tx'] = outcome.txSignature
    headers['X-Settlement-Method'] = 'x402'
  }
  if (outcome.skipReason) {
    headers['X-Escrow-Skip-Reason'] = outcome.skipReason
  }
  if (outcome.error) {
    headers['X-Escrow-Error'] = outcome.error
  }
  return headers
}

export async function handleEscrowSettlement(
  upstreamStatus: number,
  bodyLength: number,
  settleFn: () => Promise<{ settled: boolean; txSignature?: string; payer?: string; network?: string; error?: string }>,
): Promise<EscrowSettlementOutcome> {
  const quality = evaluateEscrowQuality(upstreamStatus, bodyLength)

  if (!quality.settle) {
    logger.info('Escrow-402: settlement skipped — upstream quality check failed', {
      upstreamStatus,
      bodyLength,
      reason: quality.reason,
    })
    return { escrowStatus: 'skipped', skipReason: quality.reason }
  }

  try {
    const result = await settleFn()
    if (result.settled) {
      logger.info('Escrow-402: payment settled after quality check passed', {
        txSignature: result.txSignature,
      })
      return {
        escrowStatus: 'settled',
        txSignature: result.txSignature,
        payer: result.payer,
        network: result.network,
      }
    }
    logger.warn('Escrow-402: settlement call failed', { error: result.error })
    return { escrowStatus: 'settle-failed', error: result.error }
  } catch (err) {
    logger.error('Escrow-402: settlement threw', { error: String(err) })
    return { escrowStatus: 'settle-failed', error: String(err) }
  }
}
