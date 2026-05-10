import { logger } from './mpp.js'

/**
 * SSRF guard: validate that a URL points at a public address before our backend
 * fetches it. Rejects:
 *  - Non-http(s) schemes (file://, gopher://, ftp://, etc.)
 *  - Hostnames that resolve to private/loopback/link-local/IPv6 ULA ranges
 *  - Cloud metadata services (AWS / GCP / Azure)
 *  - Localhost / .local / .internal hostnames
 *
 * This is a string-level check on the URL hostname. It does NOT do a DNS
 * round-trip — provider endpoints that resolve dynamically to a private IP
 * are still risky, but this is the same trade-off all major SSRF guards make
 * unless you wrap the socket connect step. For our threat model
 * (preventing trivially-malicious provider registrations) this is enough.
 */

const BLOCKED_HOSTNAMES = new Set<string>([
  'localhost',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
])

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost', '.lan', '.home']

const BLOCKED_EXACT_IPS = new Set<string>([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  'fd00:ec2::254',
])

function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [parseInt(m[1]!, 10), parseInt(m[2]!, 10)]
  if (a < 0 || a > 255 || b < 0 || b > 255) return false
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  return false
}

function isPrivateIPv6(host: string): boolean {
  const ip = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  if (!ip.includes(':')) return false
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length)
    return isPrivateIPv4(v4)
  }
  if (lower === '0:0:0:0:0:0:0:1' || lower === '0:0:0:0:0:0:0:0') return true
  return false
}

export interface SsrfCheckResult {
  ok: boolean
  reason?: string
  parsedUrl?: URL
}

export function checkUrlForSsrf(rawUrl: string): SsrfCheckResult {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Endpoint URL is not a valid absolute URL' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: `Only http/https endpoints are allowed (got ${parsed.protocol})` }
  }

  const host = parsed.hostname.toLowerCase()

  if (host.length === 0) {
    return { ok: false, reason: 'Endpoint URL has no hostname' }
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: `Hostname "${host}" is not allowed` }
  }

  for (const sfx of BLOCKED_HOSTNAME_SUFFIXES) {
    if (host === sfx.slice(1) || host.endsWith(sfx)) {
      return { ok: false, reason: `Hostname suffix "${sfx}" is not allowed` }
    }
  }

  if (BLOCKED_EXACT_IPS.has(host)) {
    return { ok: false, reason: 'Cloud metadata service addresses are not allowed' }
  }

  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return { ok: false, reason: 'Private / loopback / link-local addresses are not allowed' }
  }

  return { ok: true, parsedUrl: parsed }
}

/**
 * Wrap fetch() so a malicious provider URL can't poke our internal network.
 * Rejects same as checkUrlForSsrf. Use this anywhere we hit a user-supplied URL.
 */
export async function safeFetch(rawUrl: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const check = checkUrlForSsrf(rawUrl)
  if (!check.ok) {
    logger.warn('SSRF guard blocked outbound fetch', { url: rawUrl, reason: check.reason })
    throw Object.assign(new Error(check.reason ?? 'URL blocked by SSRF guard'), { code: 'SSRF_BLOCKED' })
  }
  const controller = new AbortController()
  const timeoutMs = init?.timeoutMs ?? 8000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(check.parsedUrl!.toString(), {
      ...init,
      signal: init?.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}
