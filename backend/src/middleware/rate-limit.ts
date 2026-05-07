import { createMiddleware } from 'hono/factory'

interface Window {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, Window>>()

function getStore(name: string): Map<string, Window> {
  let store = stores.get(name)
  if (!store) {
    store = new Map()
    stores.set(name, store)
  }
  return store
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const store of stores.values()) {
    for (const [key, window] of store) {
      if (window.resetAt <= now) store.delete(key)
    }
  }
}, 5 * 60 * 1000)

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export function rateLimit(opts: {
  name: string
  max: number
  windowMs: number
}) {
  const store = getStore(opts.name)

  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c)
    const now = Date.now()

    let window = store.get(ip)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + opts.windowMs }
      store.set(ip, window)
    }

    window.count++

    c.header('X-RateLimit-Limit', String(opts.max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.max - window.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)))

    if (window.count > opts.max) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        {
          error: {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
        },
        429,
      )
    }

    await next()
  })
}
