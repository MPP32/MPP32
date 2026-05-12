// Provider Qualification Layer
//
// Every catalog listing carries a `healthStatus`. We earn it by talking to the
// provider and validating that it actually speaks the protocol it claims to.
// The goal isn't to hide listings — it's to give the UI and the agent a
// trust signal so we never recommend something that will mislead the caller
// (the way deepnets.ai got mistakenly described as "needs an API key" when in
// fact it ships a valid x402 Solana challenge — our own 401 lied about the
// cause, and the wrapping agent confabulated the rest).

import { logger } from '../mpp.js'

export type HealthStatus =
  | 'unknown'
  | 'reachable'
  | 'challenge_valid'
  | 'payment_verified'
  | 'broken'

export interface HealthResult {
  status: HealthStatus
  /** Short machine-friendly reason, e.g. `missing_network_field`, `5xx`, `dns_failure` */
  reason?: string
  /** Last decoded challenge (truncated JSON) for diffing/diagnostics */
  challengeSample?: string
  /** Provider-quoted feePayer from the challenge, if present — vital for x402 settlement */
  providerFeePayer?: string
  /** Human-readable error to show in tooltips */
  error?: string
}

const PROBE_TIMEOUT_MS = 8_000
const MAX_CHALLENGE_SAMPLE_BYTES = 4_000

// Native MPP32 services (curated-seed with a relative endpointUrl like `/api/intelligence`)
// are served by our own backend. Resolve them against this origin so the qualification
// layer can verify them like any external endpoint instead of marking them broken.
const NATIVE_ORIGIN = process.env.MPP32_BASE_URL ?? 'http://localhost:3000'

/**
 * Decode a base64-encoded x402 `payment-required` header into a JSON object.
 * Returns null if the header is missing or unparseable.
 */
export function decodePaymentRequired(headerValue: string | null): any | null {
  if (!headerValue) return null
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Validate the shape of an x402 v2 challenge. Returns the offending reason if
 * invalid, or null if the challenge is fully compliant.
 *
 * This is the gate that would have caught the Venice malformed-network issue
 * and confirmed all 25 DeepNets endpoints as `challenge_valid`.
 */
export function validateX402Challenge(challenge: any): string | null {
  if (!challenge || typeof challenge !== 'object') return 'not_object'

  // Two shapes seen in the wild:
  //   v2 wrapped:  { x402Version, accepts: [PaymentRequirements] }
  //   flat legacy: PaymentRequirements directly (scheme/network/payTo/asset at top level)
  // Coinbase Bazaar advertises both depending on the listing. Accept either and
  // pull the first PaymentRequirements out for field-level validation.
  let a: any
  if (Array.isArray(challenge.accepts) && challenge.accepts.length > 0) {
    a = challenge.accepts[0]
  } else if (typeof challenge.scheme === 'string' && typeof challenge.payTo === 'string') {
    a = challenge
  } else {
    return 'missing_accepts'
  }

  if (typeof a !== 'object' || !a) return 'accepts_not_object'
  if (typeof a.network !== 'string' || a.network.length === 0) return 'missing_network'
  if (typeof a.scheme !== 'string' || a.scheme.length === 0) return 'missing_scheme'
  if (typeof a.payTo !== 'string' || a.payTo.length === 0) return 'missing_pay_to'
  if (typeof a.asset !== 'string' || a.asset.length === 0) return 'missing_asset'
  const amt = a.amount ?? a.maxAmountRequired
  if (amt !== undefined && typeof amt !== 'string' && typeof amt !== 'number') {
    return 'bad_amount_type'
  }
  return null
}

/**
 * Health-check an x402 endpoint. Returns the status earned plus diagnostic info.
 *
 * The contract:
 *   - 402 + valid challenge schema           → `challenge_valid`
 *   - 402 + malformed challenge              → `broken` (e.g. Venice case)
 *   - 200 (server doesn't gate the endpoint) → `reachable` (free or auth-walled — caller decides)
 *   - 401 + WWW-Authenticate, no payment-required → `broken` (non-x402 auth, do NOT list as payable)
 *   - 4xx other / 5xx / network error        → `broken` with reason
 */
export async function checkX402Endpoint(endpointUrl: string): Promise<HealthResult> {
  // Native services use a relative endpointUrl (e.g. `/api/intelligence`). Resolve them
  // against the local backend so we can verify our own x402 routes alongside external ones.
  const isNative = endpointUrl?.startsWith('/')
  const probeUrl = isNative ? `${NATIVE_ORIGIN}${endpointUrl}` : endpointUrl

  if (!probeUrl || !/^https?:\/\//.test(probeUrl)) {
    return { status: 'broken', reason: 'invalid_url', error: 'Endpoint URL is missing or not http(s)' }
  }

  // Our native routes are POST-only (they're real APIs, not GET-probable). Most external
  // x402 bazaar listings respond to either verb with the same 402 challenge.
  const method = isNative ? 'POST' : 'GET'

  let res: Response
  try {
    res = await fetch(probeUrl, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'MPP32-Health/1.0 (+https://mpp32.org)',
      },
      body: method === 'POST' ? '{}' : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    let reason = 'network_error'
    if (/aborted|timeout/i.test(msg)) reason = 'timeout'
    else if (/getaddrinfo|ENOTFOUND/i.test(msg)) reason = 'dns_failure'
    else if (/ECONNREFUSED/i.test(msg)) reason = 'connection_refused'
    else if (/certificate|self.signed|TLS/i.test(msg)) reason = 'tls_failure'
    return { status: 'broken', reason, error: msg.slice(0, 200) }
  }

  // 402 — the only path to `challenge_valid`
  if (res.status === 402) {
    const header = res.headers.get('payment-required') ?? res.headers.get('x-payment-required')
    const challenge = decodePaymentRequired(header)
    if (!challenge) {
      // Some providers send the body, not the header. Try to recover.
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('json')) {
        try {
          const body = await res.json() as any
          if (body && (body.accepts || (typeof body.scheme === 'string' && typeof body.payTo === 'string'))) {
            const invalid = validateX402Challenge(body)
            if (invalid) return { status: 'broken', reason: `malformed_challenge:${invalid}`, error: `402 body present but invalid: ${invalid}` }
            return {
              status: 'challenge_valid',
              challengeSample: JSON.stringify(body).slice(0, MAX_CHALLENGE_SAMPLE_BYTES),
              providerFeePayer: body.accepts?.[0]?.extra?.feePayer ?? body.extra?.feePayer,
            }
          }
        } catch { /* fall through */ }
      }
      return { status: 'broken', reason: 'missing_payment_required_header', error: '402 returned with no decodable challenge' }
    }
    const invalid = validateX402Challenge(challenge)
    if (invalid) {
      return {
        status: 'broken',
        reason: `malformed_challenge:${invalid}`,
        challengeSample: JSON.stringify(challenge).slice(0, MAX_CHALLENGE_SAMPLE_BYTES),
        error: `x402 challenge missing/invalid field: ${invalid}`,
      }
    }
    return {
      status: 'challenge_valid',
      challengeSample: JSON.stringify(challenge).slice(0, MAX_CHALLENGE_SAMPLE_BYTES),
      providerFeePayer: challenge.accepts?.[0]?.extra?.feePayer ?? challenge.extra?.feePayer,
    }
  }

  // 401 with WWW-Authenticate but no payment-required → this is API-key auth, not x402.
  // Listing as a payable x402 service would mislead callers.
  if (res.status === 401) {
    return {
      status: 'broken',
      reason: 'non_x402_auth',
      error: `Endpoint returned 401 with ${res.headers.get('www-authenticate') ?? 'unknown'} — not x402-compliant`,
    }
  }

  // 2xx — endpoint is reachable but doesn't gate behind 402. Could be a free/sample endpoint,
  // or a provider that mistakenly listed a public route. We mark `reachable` (not `challenge_valid`)
  // because we can't confirm it actually accepts payment.
  if (res.status >= 200 && res.status < 300) {
    return { status: 'reachable', reason: 'no_payment_gate' }
  }

  // 405 Method Not Allowed → endpoint refuses GET. Many real x402 services accept
  // only POST (e.g. our own /api/intelligence). Retry once with POST so we don't
  // mis-flag them as broken purely on verb mismatch.
  if (res.status === 405 && method === 'GET') {
    try {
      const retryRes = await fetch(probeUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'MPP32-Health/1.0 (+https://mpp32.org)',
        },
        body: '{}',
        redirect: 'manual',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (retryRes.status === 402) {
        const header = retryRes.headers.get('payment-required') ?? retryRes.headers.get('x-payment-required')
        const challenge = decodePaymentRequired(header)
        if (challenge) {
          const invalid = validateX402Challenge(challenge)
          if (!invalid) {
            return {
              status: 'challenge_valid',
              challengeSample: JSON.stringify(challenge).slice(0, MAX_CHALLENGE_SAMPLE_BYTES),
              providerFeePayer: challenge.accepts?.[0]?.extra?.feePayer ?? challenge.extra?.feePayer,
            }
          }
          return { status: 'broken', reason: `malformed_challenge:${invalid}`, error: `x402 challenge missing/invalid field: ${invalid}` }
        }
        // try body fallback as before
        const ct = retryRes.headers.get('content-type') ?? ''
        if (ct.includes('json')) {
          try {
            const body = await retryRes.json() as any
            if (body && (body.accepts || (typeof body.scheme === 'string' && typeof body.payTo === 'string'))) {
              const invalid = validateX402Challenge(body)
              if (!invalid) {
                return {
                  status: 'challenge_valid',
                  challengeSample: JSON.stringify(body).slice(0, MAX_CHALLENGE_SAMPLE_BYTES),
                  providerFeePayer: body.accepts?.[0]?.extra?.feePayer ?? body.extra?.feePayer,
                }
              }
            }
          } catch { /* fall through */ }
        }
      }
      if (retryRes.status >= 200 && retryRes.status < 300) {
        return { status: 'reachable', reason: 'post_ok_no_payment_gate' }
      }
      return { status: 'broken', reason: `http_${retryRes.status}_post`, error: `POST retry returned ${retryRes.status}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'broken', reason: 'post_retry_failed', error: msg.slice(0, 200) }
    }
  }

  // Anything else (3xx with manual redirect, 4xx, 5xx) → broken with the status code.
  return { status: 'broken', reason: `http_${res.status}`, error: `Upstream returned ${res.status}` }
}

/**
 * Check a free HTTP / MCP-HTTP endpoint by reachability only.
 */
export async function checkReachability(endpointUrl: string): Promise<HealthResult> {
  if (!endpointUrl || !/^https?:\/\//.test(endpointUrl)) {
    return { status: 'broken', reason: 'invalid_url' }
  }
  try {
    const res = await fetch(endpointUrl, {
      method: 'GET',
      headers: { 'user-agent': 'MPP32-Health/1.0 (+https://mpp32.org)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (res.status >= 500) return { status: 'broken', reason: `http_${res.status}` }
    return { status: 'reachable' }
  } catch (err) {
    return { status: 'broken', reason: 'network_error', error: String(err).slice(0, 200) }
  }
}

/**
 * Check stdio MCP listings by confirming the npm package referenced exists.
 * We don't run them — that has to happen on the user's machine.
 */
export async function checkStdioMcp(endpointUrl: string): Promise<HealthResult> {
  if (!endpointUrl.startsWith('npx://')) return { status: 'reachable', reason: 'stdio_non_npx' }
  const pkg = endpointUrl.slice('npx://'.length).split(' ')[0]?.split('@')[0]
  if (!pkg) return { status: 'broken', reason: 'invalid_npx_uri' }
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (res.status === 200) return { status: 'reachable', reason: 'npm_pkg_exists' }
    if (res.status === 404) return { status: 'broken', reason: 'npm_pkg_not_found' }
    return { status: 'reachable', reason: `npm_${res.status}` }
  } catch (err) {
    return { status: 'broken', reason: 'npm_lookup_failed', error: String(err).slice(0, 200) }
  }
}

/**
 * Dispatch on protocol + endpoint shape.
 */
export async function checkService(svc: {
  protocol: string
  endpointUrl: string | null
}): Promise<HealthResult> {
  if (!svc.endpointUrl) return { status: 'broken', reason: 'no_endpoint' }
  if (svc.endpointUrl.startsWith('npx://') || svc.endpointUrl.startsWith('stdio://')) {
    return checkStdioMcp(svc.endpointUrl)
  }
  switch (svc.protocol) {
    case 'x402':
      return checkX402Endpoint(svc.endpointUrl)
    case 'mcp':
    case 'http':
    default:
      return checkReachability(svc.endpointUrl)
  }
}

/**
 * Run a pool of health checks with bounded concurrency and per-host serialization
 * so we don't hammer any single provider.
 */
export async function runHealthBackfill(
  services: Array<{ id: string; protocol: string; endpointUrl: string | null }>,
  options: {
    concurrency?: number
    onProgress?: (done: number, total: number, lastSlug?: string) => void
    perResult: (id: string, result: HealthResult) => Promise<void>
  },
): Promise<{ total: number; byStatus: Record<HealthStatus, number> }> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 20, 50))
  const byStatus: Record<HealthStatus, number> = {
    unknown: 0,
    reachable: 0,
    challenge_valid: 0,
    payment_verified: 0,
    broken: 0,
  }
  let cursor = 0
  let done = 0
  const total = services.length

  // Per-host gate: cap at most N concurrent probes per host so we don't hammer
  // any single provider. Many bazaar entries cluster on a handful of hosts
  // (orbisapi.com alone had 1.5k listings) — a strict 1-per-host serial gate
  // makes the full backfill take ~25min, so we allow a small pool per host.
  const PER_HOST_CONCURRENCY = Math.max(1, parseInt(process.env.HEALTH_PER_HOST_CONCURRENCY ?? '5', 10) || 5)
  const hostInflight = new Map<string, number>()
  const hostWaiters = new Map<string, Array<() => void>>()

  async function acquireHost(url: string): Promise<() => void> {
    let host = ''
    try { host = new URL(url).host } catch { return () => {} }
    if ((hostInflight.get(host) ?? 0) >= PER_HOST_CONCURRENCY) {
      await new Promise<void>((resolve) => {
        const arr = hostWaiters.get(host) ?? []
        arr.push(resolve)
        hostWaiters.set(host, arr)
      })
    }
    hostInflight.set(host, (hostInflight.get(host) ?? 0) + 1)
    return () => {
      const next = (hostInflight.get(host) ?? 1) - 1
      hostInflight.set(host, next)
      const waiters = hostWaiters.get(host)
      if (waiters && waiters.length > 0) {
        const wake = waiters.shift()!
        if (waiters.length === 0) hostWaiters.delete(host)
        wake()
      }
    }
  }

  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= total) return
      const svc = services[i]
      if (!svc) return
      const releaseHost = svc.endpointUrl ? await acquireHost(svc.endpointUrl) : () => {}
      try {
        const result = await checkService(svc)
        byStatus[result.status] += 1
        await options.perResult(svc.id, result)
      } catch (err) {
        byStatus.broken += 1
        await options.perResult(svc.id, {
          status: 'broken',
          reason: 'checker_exception',
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        releaseHost()
        done += 1
        if (options.onProgress && done % 25 === 0) options.onProgress(done, total)
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)
  if (options.onProgress) options.onProgress(done, total)
  logger.info('catalog health backfill complete', { total, ...byStatus })
  return { total, byStatus }
}
