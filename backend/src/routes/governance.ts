import { Hono } from 'hono'
import { fetchPivxGovernance, computeDeflationStats } from '../lib/pivx-provider.js'
import { rateLimit, logger } from '../lib/mpp.js'

const governanceRouter = new Hono()

governanceRouter.use('*', rateLimit({ name: 'governance', max: 30, windowMs: 60_000 }))

// GET / — Full governance data (proposals + network stats + deflation)
governanceRouter.get('/', async (c) => {
  try {
    const govData = await fetchPivxGovernance()
    const deflation = computeDeflationStats(govData.network)

    return c.json({
      data: {
        proposals: govData.proposals,
        network: govData.network,
        deflation,
        meta: {
          source: govData.source,
          timestamp: govData.timestamp,
          cacheHit: govData.cacheHit,
          proposalCount: govData.proposals.length,
          passingCount: govData.proposals.filter((p) => p.status === 'passing').length,
          failingCount: govData.proposals.filter((p) => p.status === 'failing').length,
        },
      },
    })
  } catch (err) {
    logger.error('Governance data fetch failed', { error: String(err) })
    return c.json(
      { error: { message: 'Failed to fetch PIVX governance data', code: 'GOVERNANCE_FETCH_ERROR' } },
      502,
    )
  }
})

// GET /proposals — Just the proposals list (lighter response)
governanceRouter.get('/proposals', async (c) => {
  const status = c.req.query('status') as 'passing' | 'failing' | undefined

  try {
    const govData = await fetchPivxGovernance()
    let proposals = govData.proposals

    if (status === 'passing' || status === 'failing') {
      proposals = proposals.filter((p) => p.status === status)
    }

    return c.json({
      data: {
        proposals,
        count: proposals.length,
        timestamp: govData.timestamp,
        cacheHit: govData.cacheHit,
      },
    })
  } catch (err) {
    logger.error('Governance proposals fetch failed', { error: String(err) })
    return c.json(
      { error: { message: 'Failed to fetch PIVX proposals', code: 'PROPOSALS_FETCH_ERROR' } },
      502,
    )
  }
})

// GET /stats — Network stats + deflation metrics only
governanceRouter.get('/stats', async (c) => {
  try {
    const govData = await fetchPivxGovernance()
    const deflation = computeDeflationStats(govData.network)

    return c.json({
      data: {
        network: govData.network,
        deflation,
        governance: {
          totalProposals: govData.proposals.length,
          passingProposals: govData.proposals.filter((p) => p.status === 'passing').length,
          failingProposals: govData.proposals.filter((p) => p.status === 'failing').length,
          fundedProposals: govData.proposals.filter((p) => p.funded).length,
          totalRequestedPiv: govData.proposals.reduce((sum, p) => sum + p.monthlyPaymentPiv, 0),
        },
        timestamp: govData.timestamp,
        cacheHit: govData.cacheHit,
      },
    })
  } catch (err) {
    logger.error('Governance stats fetch failed', { error: String(err) })
    return c.json(
      { error: { message: 'Failed to fetch PIVX governance stats', code: 'STATS_FETCH_ERROR' } },
      502,
    )
  }
})

export { governanceRouter }
