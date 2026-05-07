import { createMiddleware } from 'hono/factory'

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID()
  c.set('requestId', id)
  c.header('X-Request-ID', id)
  await next()
})
