/**
 * Live integration test: x402 facilitator advertises X402_NETWORK.
 *
 * Two assertions, both against the real facilitator:
 *   1. The configured X402_FACILITATOR_URL publishes a `/supported` response
 *      that includes the configured X402_NETWORK.
 *   2. That entry uses scheme="exact" and advertises a `feePayer` address
 *      under `extra`, per the x402 SVM exact-scheme spec.
 *
 * Runs with `bun test`. CI runs it on every push, so any change to the env
 * defaults that would break settlement reliability is caught before merge.
 *
 * If the network is unreachable at test time the test skips rather than
 * fails so local development is not blocked.
 */

import { describe, it, expect } from 'bun:test'
import { env } from '../env.js'

interface SupportedResponse {
  kinds?: Array<{ scheme?: string; network?: string; extra?: { feePayer?: string } }>
  feePayers?: Record<string, string>
}

async function fetchSupported(url: string): Promise<{ ok: true; body: SupportedResponse } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/supported`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const body = (await res.json()) as SupportedResponse
    return { ok: true, body }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

function findSupport(body: SupportedResponse, network: string): { found: true; feePayer: string } | { found: false; advertised: string[] } {
  const advertised: string[] = []
  if (Array.isArray(body.kinds)) {
    for (const k of body.kinds) if (k.network) advertised.push(k.network)
    const exact = body.kinds.find(
      (k) => k.scheme === 'exact' && k.network === network && typeof k.extra?.feePayer === 'string',
    )
    if (exact?.extra?.feePayer) return { found: true, feePayer: exact.extra.feePayer }
  }
  if (body.feePayers && typeof body.feePayers === 'object') {
    for (const n of Object.keys(body.feePayers)) advertised.push(n)
    const fp = body.feePayers[network]
    if (fp) return { found: true, feePayer: fp }
  }
  return { found: false, advertised }
}

describe('x402 facilitator supports configured X402_NETWORK', () => {
  it('primary facilitator advertises X402_NETWORK with exact scheme + feePayer', async () => {
    const url = env.X402_FACILITATOR_URL
    const network = env.X402_NETWORK
    const result = await fetchSupported(url)
    if (!result.ok) {
      // Offline / sandboxed environment — skip rather than fail.
      console.warn(`[skip] cannot reach ${url}/supported: ${result.reason}`)
      return
    }
    const match = findSupport(result.body, network)
    if (!match.found) {
      throw new Error(
        `\n\nConfigured X402_FACILITATOR_URL (${url}) does not advertise ` +
          `support for configured X402_NETWORK (${network}).\n\n` +
          `Networks the facilitator advertises:\n  - ${match.advertised.join('\n  - ') || '(none)'}\n\n` +
          `Either change X402_NETWORK to a supported network, or change ` +
          `X402_FACILITATOR_URL to a facilitator that supports the network.\n\n` +
          `PayAI (https://facilitator.payai.network) advertises Solana mainnet ` +
          `(solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) with no API key.\n`,
      )
    }
    expect(match.found).toBe(true)
    expect(match.feePayer.length).toBeGreaterThan(0)
  })

  it('fallback facilitator (if distinct from primary) advertises X402_NETWORK', async () => {
    const primary = env.X402_FACILITATOR_URL
    const fallback = env.X402_FACILITATOR_FALLBACK_URL
    if (!fallback || fallback === primary) {
      console.log('[note] fallback equals primary or not set — single-facilitator config')
      return
    }
    const result = await fetchSupported(fallback)
    if (!result.ok) {
      console.warn(`[skip] cannot reach fallback ${fallback}/supported: ${result.reason}`)
      return
    }
    const match = findSupport(result.body, env.X402_NETWORK)
    // Fallback being non-supporting is a warning, not a hard failure — the
    // active facilitator is the primary. But we surface it so a degraded
    // redundancy posture is visible in CI logs.
    if (!match.found) {
      console.warn(
        `[warn] fallback facilitator (${fallback}) does not advertise ${env.X402_NETWORK}. ` +
          `Single-vendor risk: if primary goes down, no failover.`,
      )
    }
  })

  it('validateFacilitatorAtBoot resolves to an active facilitator + feePayer', async () => {
    const x402 = await import('../lib/x402.js')
    // Probe runs here (top-level execution in x402.ts already exported state).
    // Calling the validator a second time is safe: it re-probes and updates.
    try {
      await x402.validateFacilitatorAtBoot()
    } catch (err) {
      // In production this calls process.exit(1) — in tests the env is dev,
      // so this should never throw. If it does, surface as test failure.
      throw new Error(`validateFacilitatorAtBoot threw: ${err}`)
    }
    const active = x402.getActiveFacilitator()
    const feePayer = x402.getSvmFeePayer()
    expect(active).toMatch(/^https?:\/\//)
    expect(feePayer.length).toBeGreaterThan(20)
  })
})
