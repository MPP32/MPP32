import { logger } from './mpp.js'

/**
 * HTTP challenge verification for endpoint ownership.
 * Provider must serve the expected token at /.well-known/mpp32-verify
 */
async function tryVerifyAt(
  url: string,
  expectedToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  const res = await fetch(url, { method: 'GET', signal: controller.signal })
  clearTimeout(timeoutId)

  if (res.status !== 200) {
    return { ok: false, message: `Verification endpoint returned HTTP ${res.status}. Expected 200 with your verification token as the response body.` }
  }

  const body = await res.text()
  if (body.trim() !== expectedToken) {
    return { ok: false, message: 'Verification token mismatch. Ensure the response body contains exactly your verification token.' }
  }

  return { ok: true }
}

export async function checkVerificationToken(
  endpointUrl: string,
  expectedToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const paths = ['/api/mpp32-verify', '/.well-known/mpp32-verify']

  for (const path of paths) {
    try {
      const url = new URL(path, endpointUrl).toString()
      const result = await tryVerifyAt(url, expectedToken)
      if (result.ok) return result
    } catch (err) {
      logger.warn('Verification check failed', { endpointUrl, path, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { ok: false, message: 'Could not verify endpoint. Make sure /api/mpp32-verify or /.well-known/mpp32-verify is publicly accessible over HTTPS and returns your verification token as plain text.' }
}
