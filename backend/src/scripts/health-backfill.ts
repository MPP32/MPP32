// Run with: bun run src/scripts/health-backfill.ts [--limit N] [--concurrency N] [--protocol x402]
//
// Walks every active ExternalService, runs the protocol-appropriate health
// check, and writes back healthStatus / reason / sample / feePayer.
// Safe to re-run; results are upserted in batches.

import { prisma } from '../lib/db.js'
import { runHealthBackfill } from '../lib/catalog/health.js'

function parseFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) return undefined
  return process.argv[i + 1]
}

async function main() {
  const limit = parseInt(parseFlag('limit') ?? '0', 10) || undefined
  const concurrency = parseInt(parseFlag('concurrency') ?? '20', 10)
  const protocol = parseFlag('protocol')
  const onlyStale = parseFlag('only-stale') === 'true'

  const where: Record<string, unknown> = { active: true }
  if (protocol) where.protocol = protocol
  if (onlyStale) {
    where.OR = [
      { healthCheckedAt: null },
      { healthCheckedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    ]
  }

  const services = await prisma.externalService.findMany({
    where,
    select: { id: true, slug: true, protocol: true, endpointUrl: true },
    take: limit,
  })

  console.log(`[health-backfill] checking ${services.length} services (concurrency=${concurrency}, protocol=${protocol ?? 'all'})`)

  const startedAt = Date.now()
  let lastLog = Date.now()

  const summary = await runHealthBackfill(services, {
    concurrency,
    onProgress: (done, total) => {
      const now = Date.now()
      if (now - lastLog > 2_000 || done === total) {
        const elapsed = ((now - startedAt) / 1000).toFixed(1)
        const rate = done > 0 ? (done / ((now - startedAt) / 1000)).toFixed(1) : '0'
        console.log(`[health-backfill] ${done}/${total} (${rate}/s, elapsed=${elapsed}s)`)
        lastLog = now
      }
    },
    perResult: async (id, r) => {
      await prisma.externalService.update({
        where: { id },
        data: {
          healthStatus: r.status,
          healthCheckedAt: new Date(),
          healthError: r.error?.slice(0, 500) ?? r.reason ?? null,
          challengeSample: r.challengeSample ?? null,
          providerFeePayer: r.providerFeePayer ?? null,
          healthFailCount: r.status === 'broken' ? { increment: 1 } : 0,
        },
      })
    },
  })

  console.log('[health-backfill] DONE', JSON.stringify(summary, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('[health-backfill] fatal', err)
  process.exit(1)
})
