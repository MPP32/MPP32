import { createVerify, createPublicKey } from 'crypto'
import type { Context } from 'hono'
import { env } from '../env.js'
import { logger } from './mpp.js'
import { AP2MandateSchema } from '../types.js'
import type { AP2Mandate, AP2MandateType, AP2VerificationResult } from '../types.js'

const MAX_MANDATE_BYTES = 16_384 // 16KB decoded limit

export const AP2_ERROR_CODES = {
  INVALID_MANDATE: 'AP2_INVALID_MANDATE',
  EXPIRED_MANDATE: 'AP2_EXPIRED_MANDATE',
  AMOUNT_EXCEEDED: 'AP2_AMOUNT_EXCEEDED',
  RESOURCE_SCOPE_MISMATCH: 'AP2_RESOURCE_SCOPE_MISMATCH',
  SIGNATURE_INVALID: 'AP2_SIGNATURE_INVALID',
  MANDATE_REQUIRED: 'AP2_MANDATE_REQUIRED',
} as const

// ---- Standard protocol functions (mirrors x402.ts pattern) ----

export function isAP2Enabled(): boolean {
  return env.AP2_ENABLED === 'true'
}

export function isAP2Request(c: Context): boolean {
  return !!c.req.header('x-ap2-mandate')
}

export function getAP2MandateHeader(c: Context): string | null {
  return c.req.header('x-ap2-mandate') ?? null
}

export function getAP2SchemaVersion(c: Context): string {
  return c.req.header('ap2-schema-version') ?? '2025.0'
}

export function createAP2Challenge(resource: string): string {
  const challenge = {
    ap2Version: '2025.0',
    mandateTypes: ['intent', 'cart', 'payment'],
    resource,
    description: 'AP2 mandate supported for authorization proof — include X-AP2-Mandate header with base64-encoded W3C Verifiable Credential',
    credentialFormat: 'W3C Verifiable Credential',
    signatureAlgorithm: 'ECDSA P-256 (SHA-256)',
  }
  return Buffer.from(JSON.stringify(challenge)).toString('base64')
}

// ---- Core mandate verification ----

const MANDATE_TYPE_MAP: Record<string, AP2MandateType> = {
  IntentMandate: 'intent',
  CartMandate: 'cart',
  PaymentMandate: 'payment',
}

export async function verifyAP2Mandate(
  mandateHeader: string,
  resource: string,
  amount: string,
): Promise<AP2VerificationResult> {
  // Step 1: Decode from base64
  let decoded: string
  try {
    decoded = Buffer.from(mandateHeader, 'base64').toString('utf-8')
  } catch {
    return { verified: false, error: 'Invalid mandate encoding', errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
  }

  if (decoded.length > MAX_MANDATE_BYTES) {
    return { verified: false, error: 'Mandate exceeds maximum size (16KB)', errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
  }

  // Step 2: Parse JSON and validate structure with Zod
  let raw: unknown
  try {
    raw = JSON.parse(decoded)
  } catch {
    return { verified: false, error: 'Invalid mandate JSON', errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
  }

  const parseResult = AP2MandateSchema.safeParse(raw)
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message ?? 'Invalid mandate structure'
    return { verified: false, error: firstError, errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
  }

  const mandate = parseResult.data as AP2Mandate

  // Step 3: Extract mandate type and agent ID
  const mandateType = MANDATE_TYPE_MAP[mandate.credentialSubject.type]
  if (!mandateType) {
    return { verified: false, error: `Unknown mandate type: ${mandate.credentialSubject.type}`, errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
  }
  const agentId = mandate.credentialSubject.agentId

  // Step 4: Validate constraints

  // 4a. Expiry
  const now = new Date()
  if (mandate.expirationDate) {
    const expiry = new Date(mandate.expirationDate)
    if (isNaN(expiry.getTime()) || expiry <= now) {
      return { verified: false, mandateType, agentId, error: 'Mandate has expired', errorCode: AP2_ERROR_CODES.EXPIRED_MANDATE }
    }
  }

  const constraints = mandate.credentialSubject.constraints
  if (constraints?.validUntil) {
    const validUntil = new Date(constraints.validUntil)
    if (isNaN(validUntil.getTime()) || validUntil <= now) {
      return { verified: false, mandateType, agentId, error: 'Mandate constraint validUntil expired', errorCode: AP2_ERROR_CODES.EXPIRED_MANDATE }
    }
  }
  if (constraints?.validFrom) {
    const validFrom = new Date(constraints.validFrom)
    if (!isNaN(validFrom.getTime()) && validFrom > now) {
      return { verified: false, mandateType, agentId, error: 'Mandate not yet valid', errorCode: AP2_ERROR_CODES.INVALID_MANDATE }
    }
  }

  // 4b. Amount limit
  if (constraints?.maxAmount) {
    const maxAmount = parseFloat(constraints.maxAmount)
    const requestedAmount = parseFloat(amount)
    if (!isNaN(maxAmount) && !isNaN(requestedAmount) && requestedAmount > maxAmount) {
      return {
        verified: false,
        mandateType,
        agentId,
        error: `Requested amount $${amount} exceeds mandate limit $${constraints.maxAmount}`,
        errorCode: AP2_ERROR_CODES.AMOUNT_EXCEEDED,
      }
    }
  }

  // 4c. Resource scope
  if (constraints?.resource) {
    if (!resource.startsWith(constraints.resource)) {
      return {
        verified: false,
        mandateType,
        agentId,
        error: `Resource ${resource} not covered by mandate scope ${constraints.resource}`,
        errorCode: AP2_ERROR_CODES.RESOURCE_SCOPE_MISMATCH,
      }
    }
  }

  // Step 5: ECDSA P-256 signature verification
  try {
    const isValid = verifyECDSASignature(mandate)
    if (!isValid) {
      return { verified: false, mandateType, agentId, error: 'Signature verification failed', errorCode: AP2_ERROR_CODES.SIGNATURE_INVALID }
    }
  } catch (err) {
    logger.error('AP2 signature verification error', { error: String(err), agentId })
    return { verified: false, mandateType, agentId, error: 'Signature verification error', errorCode: AP2_ERROR_CODES.SIGNATURE_INVALID }
  }

  logger.info('AP2 mandate verified', { mandateType, agentId, resource, amount })
  return { verified: true, mandateType, agentId }
}

// ---- ECDSA P-256 signature verification (private) ----

function verifyECDSASignature(mandate: AP2Mandate): boolean {
  const { proof } = mandate

  const publicKeyObj = extractPublicKey(proof.verificationMethod)
  if (!publicKeyObj) {
    throw new Error(`Could not extract public key from verificationMethod: ${proof.verificationMethod.slice(0, 80)}`)
  }

  // Build signing input: credential JSON without proofValue, deterministically serialized
  const signingInput = buildSigningInput(mandate)

  // Decode the base64 signature
  const signature = Buffer.from(proof.proofValue, 'base64')

  // Verify using Node.js crypto with P1363 format (raw r||s, standard for AP2/VDC)
  const verifier = createVerify('SHA256')
  verifier.update(signingInput)
  return verifier.verify({ key: publicKeyObj, dsaEncoding: 'ieee-p1363' }, signature)
}

function buildSigningInput(mandate: AP2Mandate): string {
  // Create deep copy, remove proofValue (the signature itself is not part of the signed payload)
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(mandate))
  const proof = copy.proof as Record<string, unknown> | undefined
  if (proof) {
    delete proof.proofValue
  }
  // Deterministic JSON serialization with sorted keys
  return stableStringify(copy)
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']'
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort()
  const entries = sorted.map(
    (key) => JSON.stringify(key) + ':' + stableStringify((obj as Record<string, unknown>)[key])
  )
  return '{' + entries.join(',') + '}'
}

function extractPublicKey(verificationMethod: string): ReturnType<typeof createPublicKey> | null {
  // Case 1: Inline PEM
  if (verificationMethod.startsWith('-----BEGIN')) {
    try {
      return createPublicKey(verificationMethod)
    } catch {
      return null
    }
  }

  // Case 2: JSON string containing a JWK object
  if (verificationMethod.startsWith('{')) {
    try {
      const jwk = JSON.parse(verificationMethod)
      if (jwk.kty === 'EC' && (jwk.crv === 'P-256' || jwk.crv === 'prime256v1')) {
        return createPublicKey({ key: jwk, format: 'jwk' })
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Case 3: Base64url-encoded JWK
  try {
    const jwkJson = Buffer.from(verificationMethod, 'base64url').toString('utf-8')
    const jwk = JSON.parse(jwkJson)
    if (jwk.kty === 'EC' && (jwk.crv === 'P-256' || jwk.crv === 'prime256v1')) {
      return createPublicKey({ key: jwk, format: 'jwk' })
    }
  } catch {
    // Not base64url JWK, fall through
  }

  // Case 4: Base64-encoded JWK (standard base64)
  try {
    const jwkJson = Buffer.from(verificationMethod, 'base64').toString('utf-8')
    const jwk = JSON.parse(jwkJson)
    if (jwk.kty === 'EC' && (jwk.crv === 'P-256' || jwk.crv === 'prime256v1')) {
      return createPublicKey({ key: jwk, format: 'jwk' })
    }
  } catch {
    // Not base64 JWK either
  }

  return null
}
