import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import type { Env, Input, MiddlewareHandler, ValidationTargets } from 'hono'

// ---- Types ----

type ValidationTarget = keyof ValidationTargets

type ZodIssueLike = {
  code?: string
  path: PropertyKey[]
  message: string
  // Extra fields present depending on code (see zod v4 errors.d.ts).
  origin?: string
  minimum?: number | bigint
  maximum?: number | bigint
  expected?: string
  received?: string
  format?: string
  pattern?: string
  input?: unknown
}

type FieldError = {
  path: string
  message: string
}

// ---- Humanizer ----

// Converts camelCase path segments into a human-readable label.
// Examples: shortDescription -> "Short description", endpointUrl -> "Endpoint URL".
function humanizeField(path: PropertyKey[]): string {
  if (!path || path.length === 0) return 'Value'
  // Join path segments with a dot for nested structures; humanize the last string segment.
  const leaf = path[path.length - 1]
  const raw = typeof leaf === 'string' ? leaf : String(leaf)

  // Split camelCase into words
  const words = raw
    // Insert space before capital letters (camelCase boundary)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Also split runs of capitals followed by lower
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length === 0) return 'Value'

  // Capitalize first word, lowercase the rest (unless special-cased)
  const specialCases: Record<string, string> = {
    url: 'URL',
    api: 'API',
    evm: 'EVM',
    solana: 'Solana',
    id: 'ID',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
  }

  const formatted = words.map((word, idx) => {
    const lower = word.toLowerCase()
    if (specialCases[lower]) return specialCases[lower]
    if (idx === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }
    return lower
  })

  return formatted.join(' ')
}

// ---- Formatter ----

function formatIssue(issue: ZodIssueLike): FieldError {
  const field = humanizeField(issue.path)
  const pathStr = issue.path.map((p) => String(p)).join('.') || ''

  const message = friendlyMessage(issue, field)

  return { path: pathStr, message }
}

function friendlyMessage(issue: ZodIssueLike, field: string): string {
  const code = issue.code

  // ---- too_small ----
  if (code === 'too_small') {
    const min = issue.minimum
    if (issue.origin === 'string') {
      return `${field} must be at least ${min} characters.`
    }
    if (issue.origin === 'number' || issue.origin === 'int' || issue.origin === 'bigint') {
      return `${field} must be at least ${min}.`
    }
    return `${field} must be at least ${min}.`
  }

  // ---- too_big ----
  if (code === 'too_big') {
    const max = issue.maximum
    if (issue.origin === 'string') {
      return `${field} must be at most ${max} characters.`
    }
    if (issue.origin === 'number' || issue.origin === 'int' || issue.origin === 'bigint') {
      return `${field} must be at most ${max}.`
    }
    return `${field} must be at most ${max}.`
  }

  // ---- invalid_format ----
  if (code === 'invalid_format') {
    if (issue.format === 'email') {
      return `${field} must be a valid email address.`
    }
    if (issue.format === 'url') {
      return `${field} must be a valid URL.`
    }
    if (issue.format === 'regex') {
      // Special-case payment address (EVM)
      const leaf = issue.path[issue.path.length - 1]
      if (leaf === 'paymentAddress') {
        return 'Payment address must be a valid EVM address (0x followed by 40 hex characters).'
      }
      if (leaf === 'solanaAddress') {
        return 'Solana address must be a valid base58 address (32-44 characters).'
      }
      return issue.message
    }
    return issue.message
  }

  // ---- invalid_type ----
  if (code === 'invalid_type') {
    if (issue.received === 'undefined' || issue.input === undefined) {
      return `${field} is required.`
    }
    const expected = issue.expected ?? 'valid value'
    return `${field} must be a ${expected}.`
  }

  // ---- fallback ----
  return issue.message
}

// ---- Public API ----

/**
 * Wraps `zValidator` with a hook that returns a clean,
 * user-friendly error envelope on validation failure.
 *
 * Drop-in replacement for `zValidator(target, schema)`.
 */
export function validate<
  T extends z.ZodTypeAny,
  Target extends ValidationTarget,
  E extends Env = Env,
  P extends string = string,
  In = z.input<T>,
  Out = z.output<T>,
  I extends Input = {
    in: { [K in Target]: In extends ValidationTargets[K] ? In : In }
    out: { [K in Target]: Out }
  },
  V extends I = I,
>(target: Target, schema: T): MiddlewareHandler<E, P, V> {
  // Cast schema to `any` because @hono/zod-validator's generics accept both
  // zod v3 and v4 schema shapes via a union — the cast preserves runtime behavior
  // while our public `validate` generics accept any z.ZodTypeAny.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zValidator(target, schema as any, (result, c) => {
    if (!result.success) {
      const issues = (result.error?.issues ?? []) as ZodIssueLike[]
      const fields = issues.map(formatIssue)
      const topMessage = fields[0]?.message ?? 'Invalid input.'

      return c.json(
        {
          error: {
            message: topMessage,
            code: 'VALIDATION_ERROR',
            fields,
          },
        },
        400,
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}
