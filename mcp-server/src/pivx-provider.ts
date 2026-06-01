import * as cheerio from "cheerio";

export interface PivxProposal {
  name: string;
  url: string;
  status: "passing" | "failing";
  funded: boolean;
  netYesPercent: number;
  yesVotes: number;
  noVotes: number;
  monthlyPaymentPiv: number;
  monthlyPaymentUsd: number;
  totalPaymentPiv: number;
  installmentsRemaining: number;
  totalInstallments: number;
  budgetPercent: number;
}

export interface PivxNetworkStats {
  masternodeCount: number;
  passingThreshold: number;
  monthlyBudgetPiv: number;
  monthlyBudgetUsd: number;
  budgetAllocatedPiv: number;
  budgetAllocatedUsd: number;
  budgetAllocatedPercent: number;
  blockHeight: number;
  totalSupply: number;
  circulatingSupply: number;
}

export interface PivxGovernanceData {
  proposals: PivxProposal[];
  network: PivxNetworkStats;
  deflation: {
    unallocatedPivPerCycle: number;
    unallocatedPercent: number;
    annualUnallocatedPiv: number;
    proposalFeeBurnPiv: number;
    effectiveInflationReduction: string;
  };
  timestamp: string;
  source: string;
  cacheHit: boolean;
}

// 5-minute cache
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedData: PivxGovernanceData | null = null;
let cacheTimestamp = 0;

const CHAINZ_BASE = "https://chainz.cryptoid.info/pivx/api.dws";

async function chainzFetch(query: string): Promise<string> {
  const res = await fetch(`${CHAINZ_BASE}?q=${query}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Chainz API ${query}: HTTP ${res.status}`);
  return (await res.text()).trim();
}

async function fetchNetworkStats(): Promise<Partial<PivxNetworkStats>> {
  const [masternodeCount, blockHeight, totalSupply, circulating] =
    await Promise.allSettled([
      chainzFetch("masternodecount"),
      chainzFetch("getblockcount"),
      chainzFetch("totalcoins"),
      chainzFetch("circulating"),
    ]);

  const mn =
    masternodeCount.status === "fulfilled"
      ? parseInt(masternodeCount.value, 10)
      : 0;
  const bh =
    blockHeight.status === "fulfilled"
      ? parseInt(blockHeight.value, 10)
      : 0;
  const ts =
    totalSupply.status === "fulfilled"
      ? parseFloat(totalSupply.value)
      : 0;
  const cs =
    circulating.status === "fulfilled"
      ? parseFloat(circulating.value)
      : 0;

  return {
    masternodeCount: isNaN(mn) ? 0 : mn,
    blockHeight: isNaN(bh) ? 0 : bh,
    totalSupply: isNaN(ts) ? 0 : ts,
    circulatingSupply: isNaN(cs) ? 0 : cs,
    passingThreshold: isNaN(mn) ? 0 : Math.ceil(mn * 0.1),
  };
}

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function scrapePivxProposals() {
  const res = await fetch("https://pivx.org/proposals", {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "MPP32-Governance-Oracle/1.0 (+https://mpp32.org)",
      Accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`pivx.org/proposals returned HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const pageText = $("body").text();

  let monthlyBudgetPiv = 432000;
  let monthlyBudgetUsd = 0;
  let budgetAllocatedPiv = 0;
  let budgetAllocatedUsd = 0;
  let masternodeCount = 0;
  let passingThreshold = 0;

  const budgetMatch = pageText.match(/Monthly\s*Budget[:\s]*([\d,]+)\s*PIV/i);
  if (budgetMatch?.[1]) monthlyBudgetPiv = parseNumber(budgetMatch[1]);

  const budgetUsdMatch = pageText.match(/Monthly\s*Budget[^$]*US?\$([\d,.]+)/i);
  if (budgetUsdMatch?.[1]) monthlyBudgetUsd = parseNumber(budgetUsdMatch[1]);

  const allocatedMatch = pageText.match(/Budget\s*Allocated[:\s]*([\d,]+)\s*PIV/i);
  if (allocatedMatch?.[1]) budgetAllocatedPiv = parseNumber(allocatedMatch[1]);

  const allocatedUsdMatch = pageText.match(/Budget\s*Allocated[^$]*US?\$([\d,.]+)/i);
  if (allocatedUsdMatch?.[1]) budgetAllocatedUsd = parseNumber(allocatedUsdMatch[1]);

  const mnMatch = pageText.match(/([\d,]+)\s*masternodes?\s*online/i);
  if (mnMatch?.[1]) masternodeCount = parseNumber(mnMatch[1]);

  const thresholdMatch = pageText.match(
    /Positive\s*votes\s*required[^:]*:\s*(\d+)/i,
  );
  if (thresholdMatch?.[1]) passingThreshold = parseInt(thresholdMatch[1], 10);

  const proposals: PivxProposal[] = [];
  const seenHashes = new Set<string>();

  $("table#js_table tbody tr[data-hash]").each((_i, el) => {
    const $row = $(el);
    const hash = $row.attr("data-hash") || "";
    if (!hash || seenHashes.has(hash)) return;
    seenHashes.add(hash);

    const name = ($row.attr("data-title") || "").trim();
    if (!name) return;

    const cells = $row.find("td");
    if (cells.length < 5) return;

    const statusCell = $(cells[0]);
    const statusText = statusCell.text();
    const isPassing = /passing/i.test(statusText);
    const funded = /funded/i.test(statusText);
    let netYesPercent = 0;
    const netYesMatch = statusText.match(/([-\d.]+)%/);
    if (netYesMatch?.[1]) netYesPercent = parseFloat(netYesMatch[1]);

    const nameCell = $(cells[1]);
    const link = nameCell.find("a").first();
    const url = link.attr("href") || "";

    const paymentCell = $(cells[2]);
    const monthlyPaymentPiv = parseNumber(
      paymentCell.attr("data-piv") || paymentCell.attr("data-order") || "0",
    );
    const budgetPercent = parseFloat(paymentCell.attr("data-percent") || "0");

    let monthlyPaymentUsd = 0;
    const usdSpan = paymentCell.find(".curr-prefix").parent();
    if (usdSpan.length) {
      const usdText = usdSpan.text();
      const usdMatch = usdText.match(/US?\$\s*([\d,]+(?:\.\d+)?)/i);
      if (usdMatch?.[1]) monthlyPaymentUsd = parseNumber(usdMatch[1]);
    }

    let installmentsRemaining = 1;
    const longLine = paymentCell.find(".long-line");
    if (longLine.length) {
      const installB = longLine.find("b").first();
      if (installB.length) {
        const n = parseInt(installB.text().trim(), 10);
        if (!isNaN(n)) installmentsRemaining = n;
      }
    }

    let totalPaymentPiv = monthlyPaymentPiv;
    if (longLine.length) {
      const totalB = longLine.find("b").last();
      if (totalB.length) {
        const totalText = totalB.text();
        const totalMatch = totalText.match(/([\d,]+(?:\.\d+)?)\s*PIV/i);
        if (totalMatch?.[1]) totalPaymentPiv = parseNumber(totalMatch[1]);
      }
    }

    const voteCell = $(cells[4]);
    const voteText = voteCell.text();
    let yesVotes = 0;
    let noVotes = 0;
    const voteMatch = voteText.match(/(\d+)\s*\/\s*(\d+)/);
    if (voteMatch?.[1] && voteMatch[2]) {
      yesVotes = parseInt(voteMatch[1], 10);
      noVotes = parseInt(voteMatch[2], 10);
    }

    proposals.push({
      name,
      url,
      status: isPassing ? "passing" : "failing",
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
    });
  });

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
  };
}

export async function fetchPivxGovernance(): Promise<PivxGovernanceData> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return { ...cachedData, cacheHit: true };
  }

  const [scrapeResult, networkStats] = await Promise.allSettled([
    scrapePivxProposals(),
    fetchNetworkStats(),
  ]);

  const scraped =
    scrapeResult.status === "fulfilled" ? scrapeResult.value : null;
  const chainzStats =
    networkStats.status === "fulfilled" ? networkStats.value : {};

  if (!scraped) {
    throw new Error(
      `Failed to fetch PIVX governance data: ${scrapeResult.status === "rejected" ? scrapeResult.reason : "unknown"}`,
    );
  }

  const budgetAllocatedPercent =
    scraped.budgetSummary.monthlyBudgetPiv > 0
      ? Math.round(
          (scraped.budgetSummary.budgetAllocatedPiv /
            scraped.budgetSummary.monthlyBudgetPiv) *
            10000,
        ) / 100
      : 0;

  const network: PivxNetworkStats = {
    masternodeCount:
      scraped.budgetSummary.masternodeCount ||
      chainzStats.masternodeCount ||
      0,
    passingThreshold:
      scraped.budgetSummary.passingThreshold ||
      chainzStats.passingThreshold ||
      0,
    monthlyBudgetPiv: scraped.budgetSummary.monthlyBudgetPiv,
    monthlyBudgetUsd: scraped.budgetSummary.monthlyBudgetUsd,
    budgetAllocatedPiv: scraped.budgetSummary.budgetAllocatedPiv,
    budgetAllocatedUsd: scraped.budgetSummary.budgetAllocatedUsd,
    budgetAllocatedPercent,
    blockHeight: chainzStats.blockHeight || 0,
    totalSupply: chainzStats.totalSupply || 0,
    circulatingSupply: chainzStats.circulatingSupply || 0,
  };

  const unallocatedPivPerCycle =
    network.monthlyBudgetPiv - network.budgetAllocatedPiv;
  const annualUnallocatedPiv = unallocatedPivPerCycle * 12;

  const data: PivxGovernanceData = {
    proposals: scraped.proposals,
    network,
    deflation: {
      unallocatedPivPerCycle,
      unallocatedPercent: 100 - budgetAllocatedPercent,
      annualUnallocatedPiv,
      proposalFeeBurnPiv: 50,
      effectiveInflationReduction:
        network.totalSupply > 0
          ? `${((annualUnallocatedPiv / network.totalSupply) * 100).toFixed(3)}%`
          : "N/A",
    },
    timestamp: new Date().toISOString(),
    source: "pivx.org/proposals + chainz.cryptoid.info",
    cacheHit: false,
  };

  cachedData = data;
  cacheTimestamp = Date.now();

  return data;
}
