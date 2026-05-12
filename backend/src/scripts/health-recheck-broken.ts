// Run with: bun run src/scripts/health-recheck-broken.ts
//
// Re-runs the qualification check on entries currently marked `broken` so
// changes to the validator (e.g. accepting the flat-shape x402 challenge) can
// promote them to `challenge_valid` without re-probing every healthy provider.

import { prisma } from '../lib/db.js'
import { runHealthBackfill } from '../lib/catalog/health.js'

async function main() {
  const services = await prisma.externalService.findMany({
    where: { active: true, healthStatus: 'broken' },
    select: { id: true, slug: true, protocol: true, endpointUrl: true },
  })

  console.log(`[health-recheck-broken] re-checking ${services.length} broken entries`)
  const startedAt = Date.now()
  let lastLog = Date.now()

  const summary = await runHealthBackfill(services, {
    concurrency: 25,
    onProgress: (done, total) => {
      const now = Date.now()
      if (now - lastLog > 2_000 || done === total) {
        const elapsed = ((now - startedAt) / 1000).toFixed(1)
        const rate = done > 0 ? (done / ((now - startedAt) / 1000)).toFixed(1) : '0'
        console.log(`[health-recheck-broken] ${done}/${total} (${rate}/s, elapsed=${elapsed}s)`)
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

  console.log('[health-recheck-broken] DONE', JSON.stringify(summary, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('[health-recheck-broken] fatal', err)
  process.exit(1)
})
