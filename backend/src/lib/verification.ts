import { logger } from './mpp.js'

/**
 * HTTP challenge verification for endpoint ownership.
 * Provider must serve the expected token at /.well-known/mpp32-verify
 */
export async function checkVerificationToken(
  endpointUrl: string,
  expectedToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const verifyUrl = new URL('/.well-known/mpp32-verify', endpointUrl).toString()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(verifyUrl, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.status !== 200) {
      return {
        ok: false,
        message: `Verification endpoint returned HTTP ${res.status}. Expected 200 with your verification token as the response body.`,
      }
    }

    const body = await res.text()
    const trimmed = body.trim()

    if (trimmed !== expectedToken) {
      return {
        ok: false,
        message: 'Verification token mismatch. Ensure the response body at /.well-known/mpp32-verify contains exactly your verification token.',
      }
    }

    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Verification endpoint did not respond within 8 seconds.'
        : 'Could not reach verification endpoint. Make sure /.well-known/mpp32-verify is publicly accessible over HTTPS.'

    logger.warn('Verification check failed', {
      endpointUrl,
      error: err instanceof Error ? err.message : String(err),
    })

    return { ok: false, message }
  }
}
