import * as cheerio from 'cheerio'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PivxProposal {
  name: string
  url: string
  status: 'passing' | 'failing'
  funded: boolean
  netYesPercent: number
  yesVotes: number
  noVotes: number
  monthlyPaymentPiv: number
  monthlyPaymentUsd: number
  totalPaymentPiv: number
  installmentsRemaining: number
  totalInstallments: number
  budgetPercent: number
}

export interface PivxNetworkStats {
  masternodeCount: number
  passingThreshold: number
  monthlyBudgetPiv: number
  monthlyBudgetUsd: number
  budgetAllocatedPiv: number
  budgetAllocatedUsd: number
  budgetAllocatedPercent: number
  blockHeight: number
  totalSupply: number
  circulatingSupply: number
}

export interface PivxGovernanceData {
  proposals: PivxProposal[]
  network: PivxNetworkStats
  timestamp: string
  source: string
  cacheHit: boolean
}

// ---------------------------------------------------------------------------
// Cache (5 min TTL — governance data updates slowly)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedData: PivxGovernanceData | null = null
let cacheTimestamp = 0

function isCacheValid(): boolean {
  return cachedData !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS
}

// ---------------------------------------------------------------------------
// Chainz CryptoID API (free, no key needed for basic endpoints)
// ---------------------------------------------------------------------------

const CHAINZ_BASE = 'https://chainz.cryptoid.info/pivx/api.dws'

async function chainzFetch(query: string, timeoutMs = 8000): Promise<string> {
  const url = `${CHAINZ_BASE}?q=${query}`
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`Chainz API ${query}: HTTP ${res.status}`)
  return (await res.text()).trim()
}

async function fetchNetworkStats(): Promise<Partial<PivxNetworkStats>> {
  const [masternodeCount, blockHeight, totalSupply, circulating] = await Promise.allSettled([
    chainzFetch('masternodecount'),
    chainzFetch('getblockcount'),
    chainzFetch('totalcoins'),
    chainzFetch('circulating'),
  ])

  const mn = masternodeCount.status === 'fulfilled' ? parseInt(masternodeCount.value, 10) : 0
  const bh = blockHeight.status === 'fulfilled' ? parseInt(blockHeight.value, 10) : 0
  const ts = totalSupply.status === 'fulfilled' ? parseFloat(totalSupply.value) : 0
  const cs = circulating.status === 'fulfilled' ? parseFloat(circulating.value) : 0

  return {
    masternodeCount: isNaN(mn) ? 0 : mn,
    blockHeight: isNaN(bh) ? 0 : bh,
    totalSupply: isNaN(ts) ? 0 : ts,
    circulatingSupply: isNaN(cs) ? 0 : cs,
    passingThreshold: isNaN(mn) ? 0 : Math.ceil(mn * 0.1),
  }
}

// ---------------------------------------------------------------------------
// Scraper: pivx.org/proposals
// Uses structured data-* attributes on the HTML table for reliable parsing.
// Table structure:
//   <tr data-hash="..." data-title="ProposalName">
//     <td data-order="0.27104">  — status cell (Passing/Failing, net yes %)
//     <td>                       — name cell (link to forum)
//     <td data-order="25000" data-name="..." data-piv="25000" data-percent="5.8">
//     <td data-order="5.8">      — budget usage %
//     <td data-order="1">        — votes: "100% ... 570 / 0"
//     <td>                       — copy vote buttons
// ---------------------------------------------------------------------------

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.\-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

async function scrapePivxProposals(): Promise<{
  proposals: PivxProposal[]
  budgetSummary: {
    monthlyBudgetPiv: number
    monthlyBudgetUsd: number
    budgetAllocatedPiv: number
    budgetAllocatedUsd: number
    masternodeCount: number
    passingThreshold: number
  }
}> {
  const res = await fetch('https://pivx.org/proposals', {
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'MPP32-Governance-Oracle/1.0 (+https://mpp32.org)',
      Accept: 'text/html',
    },
  })

  if (!res.ok) throw new Error(`pivx.org/proposals returned HTTP ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Parse budget summary from page text
  const pageText = $('body').text()

  let monthlyBudgetPiv = 432000
  let monthlyBudgetUsd = 0
  let budgetAllocatedPiv = 0
  let budgetAllocatedUsd = 0
  let masternodeCount = 0
  let passingThreshold = 0

  const budgetMatch = pageText.match(/Monthly\s*Budget[:\s]*([\d,]+)\s*PIV/i)
  if (budgetMatch?.[1]) monthlyBudgetPiv = parseNumber(budgetMatch[1])

  const budgetUsdMatch = pageText.match(/Monthly\s*Budget[^$]*US?\$([\d,.]+)/i)
  if (budgetUsdMatch?.[1]) monthlyBudgetUsd = parseNumber(budgetUsdMatch[1])

  const allocatedMatch = pageText.match(/Budget\s*Allocated[:\s]*([\d,]+)\s*PIV/i)
  if (allocatedMatch?.[1]) budgetAllocatedPiv = parseNumber(allocatedMatch[1])

  const allocatedUsdMatch = pageText.match(/Budget\s*Allocated[^$]*US?\$([\d,.]+)/i)
  if (allocatedUsdMatch?.[1]) budgetAllocatedUsd = parseNumber(allocatedUsdMatch[1])

  const mnMatch = pageText.match(/([\d,]+)\s*masternodes?\s*online/i)
  if (mnMatch?.[1]) masternodeCount = parseNumber(mnMatch[1])

  const thresholdMatch = pageText.match(/Positive\s*votes\s*required[^:]*:\s*(\d+)/i)
  if (thresholdMatch?.[1]) passingThreshold = parseInt(thresholdMatch[1], 10)

  // Parse proposals from table rows using data-hash attribute (unique per proposal)
  const proposals: PivxProposal[] = []
  const seenHashes = new Set<string>()

  $('table#js_table tbody tr[data-hash]').each((_i, el) => {
    const $row = $(el)
    const hash = $row.attr('data-hash') || ''
    if (!hash || seenHashes.has(hash)) return
    seenHashes.add(hash)

    const name = ($row.attr('data-title') || '').trim()
    if (!name) return

    const cells = $row.find('td')
    if (cells.length < 5) return

    // Cell 0: Status — contains "Passing"/"Failing", "(Funded)", net yes %
    const statusCell = $(cells[0])
    const statusText = statusCell.text()
    const isPassing = /passing/i.test(statusText)
    const funded = /funded/i.test(statusText)
    let netYesPercent = 0
    const netYesMatch = statusText.match(/([-\d.]+)%/)
    if (netYesMatch?.[1]) netYesPercent = parseFloat(netYesMatch[1])

    // Cell 1: Name — link to forum
    const nameCell = $(cells[1])
    const link = nameCell.find('a').first()
    const url = link.attr('href') || ''

    // Cell 2: Payment — funded proposals have data-piv/data-percent attributes;
    // failing proposals only have data-order (the PIV amount)
    const paymentCell = $(cells[2])
    const monthlyPaymentPiv = parseNumber(
      paymentCell.attr('data-piv') || paymentCell.attr('data-order') || '0',
    )
    const budgetPercent = parseFloat(paymentCell.attr('data-percent') || '0')

    // USD amount — extract from the specific note-line span containing the currency prefix
    let monthlyPaymentUsd = 0
    const usdSpan = paymentCell.find('.curr-prefix').parent()
    if (usdSpan.length) {
      const usdText = usdSpan.text()
      const usdMatch = usdText.match(/US?\$\s*([\d,]+(?:\.\d+)?)/i)
      if (usdMatch?.[1]) monthlyPaymentUsd = parseNumber(usdMatch[1])
    }

    // Installments — the <b> inside the "long-line" note-line span
    let installmentsRemaining = 1
    const longLine = paymentCell.find('.long-line')
    if (longLine.length) {
      const installB = longLine.find('b').first()
      if (installB.length) {
        const n = parseInt(installB.text().trim(), 10)
        if (!isNaN(n)) installmentsRemaining = n
      }
    }

    // Total PIV from the "long-line" note-line: "of <b>75,000 PIV</b> total"
    let totalPaymentPiv = monthlyPaymentPiv
    if (longLine.length) {
      const totalB = longLine.find('b').last()
      if (totalB.length) {
        const totalText = totalB.text()
        const totalMatch = totalText.match(/([\d,]+(?:\.\d+)?)\s*PIV/i)
        if (totalMatch?.[1]) totalPaymentPiv = parseNumber(totalMatch[1])
      }
    }

    // Cell 3: Budget usage % (already have from data-percent)

    // Cell 4: Votes — "100% ... 570 / 0" (vote counts in note-line)
    const voteCell = $(cells[4])
    const voteText = voteCell.text()
    let yesVotes = 0
    let noVotes = 0
    const voteMatch = voteText.match(/(\d+)\s*\/\s*(\d+)/)
    if (voteMatch?.[1] && voteMatch[2]) {
      yesVotes = parseInt(voteMatch[1], 10)
      noVotes = parseInt(voteMatch[2], 10)
    }

    proposals.push({
      name,
      url,
      status: isPassing ? 'passing' : 'failing',
      funded,
      netYesPercent,
      yesVotes,
      noVotes,
      monthlyPaymentPiv,
      monthlyPaymentUsd,
      totalPaymentPiv,
      installmentsRemaining,
      totalInstallments: installmentsRemaining,
      budgetPercent,
    })
  })

  return {
    proposals,
    budgetSummary: {
      monthlyBudgetPiv,
      monthlyBudgetUsd,
      budgetAllocatedPiv,
      budgetAllocatedUsd,
      masternodeCount,
      passingThreshold,
    },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchPivxGovernance(): Promise<PivxGovernanceData> {
  if (isCacheValid()) return { ...cachedData!, cacheHit: true }

  const [scrapeResult, networkStats] = await Promise.allSettled([
    scrapePivxProposals(),
    fetchNetworkStats(),
  ])

  const scraped = scrapeResult.status === 'fulfilled' ? scrapeResult.value : null
  const chainzStats = networkStats.status === 'fulfilled' ? networkStats.value : {}

  if (!scraped) {
    throw new Error(
      `Failed to fetch PIVX governance data: ${scrapeResult.status === 'rejected' ? scrapeResult.reason : 'unknown'}`,
    )
  }

  const budgetAllocatedPercent =
    scraped.budgetSummary.monthlyBudgetPiv > 0
      ? Math.round(
          (scraped.budgetSummary.budgetAllocatedPiv / scraped.budgetSummary.monthlyBudgetPiv) * 10000,
        ) / 100
      : 0

  const data: PivxGovernanceData = {
    proposals: scraped.proposals,
    network: {
      masternodeCount: scraped.budgetSummary.masternodeCount || chainzStats.masternodeCount || 0,
      passingThreshold: scraped.budgetSummary.passingThreshold || chainzStats.passingThreshold || 0,
      monthlyBudgetPiv: scraped.budgetSummary.monthlyBudgetPiv,
      monthlyBudgetUsd: scraped.budgetSummary.monthlyBudgetUsd,
      budgetAllocatedPiv: scraped.budgetSummary.budgetAllocatedPiv,
      budgetAllocatedUsd: scraped.budgetSummary.budgetAllocatedUsd,
      budgetAllocatedPercent,
      blockHeight: chainzStats.blockHeight || 0,
      totalSupply: chainzStats.totalSupply || 0,
      circulatingSupply: chainzStats.circulatingSupply || 0,
    },
    timestamp: new Date().toISOString(),
    source: 'pivx.org/proposals + chainz.cryptoid.info',
    cacheHit: false,
  }

  cachedData = data
  cacheTimestamp = Date.now()

  return data
}

export function computeDeflationStats(network: PivxNetworkStats): {
  unallocatedPivPerCycle: number
  unallocatedPercent: number
  annualUnallocatedPiv: number
  proposalFeeBurnPiv: number
  effectiveInflationReduction: string
} {
  const unallocatedPivPerCycle = network.monthlyBudgetPiv - network.budgetAllocatedPiv
  const unallocatedPercent = 100 - network.budgetAllocatedPercent

  // ~12 cycles per year
  const annualUnallocatedPiv = unallocatedPivPerCycle * 12

  // 50 PIV burned per proposal submission — estimate based on typical 10-20 proposals/year
  const proposalFeeBurnPiv = 50

  // Unallocated treasury PIV are never minted, effectively reducing inflation
  const effectiveInflationReduction =
    network.totalSupply > 0
      ? `${((annualUnallocatedPiv / network.totalSupply) * 100).toFixed(3)}%`
      : 'N/A'

  return {
    unallocatedPivPerCycle,
    unallocatedPercent,
    annualUnallocatedPiv,
    proposalFeeBurnPiv,
    effectiveInflationReduction,
  }
}
