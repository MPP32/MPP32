import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { UseCasesHero } from "@/components/use-cases/UseCasesHero";
import { ProviderUseCases } from "@/components/use-cases/ProviderUseCases";
import { PersonaBlock, type PersonaBlockProps } from "@/components/use-cases/PersonaBlock";
import { TrustSection } from "@/components/use-cases/TrustSection";

const useCases: Omit<PersonaBlockProps, "isReversed">[] = [
  {
    id: "retail",
    label: "Retail Trader",
    tagline: "Before you ape, verify it on-chain.",
    problem:
      "Every Solana trader has been rugged. The warning signs (brand-new pair, razor-thin liquidity, no website, no social presence) exist on-chain before the chart moves. The edge belongs to whoever surfaces them first.",
    solution: [
      "Paste any contract address or ticker. Rug Risk Score returns in under 2 seconds",
      "7-factor model catches the exact on-chain conditions that precede rug pulls",
      "Alpha Score tells you whether you're entering early momentum or buying the peak",
      "Whale dominance score reveals if large wallets are accumulating or positioned to dump",
      "Pair Age penalty built into scoring. Tokens under 24h old carry disproportionate risk",
    ],
    keyFields: ["Rug Risk Score", "Alpha Score", "Pair Age", "Liquidity Depth", "Whale Activity"],
    mockResponse: {
      alphaScore: 61,
      rugRisk: {
        score: 7,
        level: "high",
        factors: [
          "Pair age < 24h",
          "Liquidity < $10K",
          "No website detected",
          "No social accounts",
        ],
      },
      whaleActivity: {
        level: "high",
        dominanceScore: 78,
      },
      marketData: {
        liquidity: 8200,
        pairAge: "14h",
        dexId: "Raydium",
      },
    },
    costNote: "$0.008 per scan. Less than the gas fee on the transaction you're about to make.",
  },
  {
    id: "speed",
    label: "Speed Trader",
    tagline: "Alpha above 80 doesn't stay there long.",
    problem:
      "By the time a token trends on DEX screeners, the first 40% of the move is already closed. Momentum builds on-chain before it's visible anywhere, in volume ratios, buy pressure, and whale accumulation patterns.",
    solution: [
      "Volume Momentum measures current 1h volume against 24h baseline, the first detectable sign of a breakout",
      "Buy/Sell Ratio above 65% signals buy-side pressure building against resistance",
      "Smart Money Signals stack: when 3+ trigger simultaneously, breakout conditions are confirmed",
      "Pump Probability 24h provides statistical likelihood of a 20%+ move, calibrated against current velocity",
      "Query your watchlist every few minutes; filter for Alpha Score > 75 to isolate candidates",
    ],
    keyFields: ["Alpha Score", "Volume Momentum", "Buy/Sell Ratio", "Smart Money Signals", "Pump Probability"],
    mockResponse: {
      alphaScore: 84,
      pumpProbability24h: 73,
      smartMoneySignals: [
        "Volume spike in last 5 minutes",
        "Strong buy-side dominance (71%)",
        "2.4x above 24h average volume",
        "Price momentum breakout (+6.2% 1h)",
      ],
      whaleActivity: {
        level: "high",
        recentBuys: 312,
        recentSells: 89,
        dominanceScore: 78,
      },
      riskRewardRatio: "6.2:1",
    },
    costNote: "Query your full watchlist of 20 tokens every 5 minutes for $0.016/hour.",
  },
  {
    id: "sniper",
    label: "Sniper Bot",
    tagline: "Stop buying every launch. Start buying the right ones.",
    problem:
      "Sniper bots that target every new Raydium pair get rugged constantly. Without a risk gate, every new token is a blind bet made in a 30-second window.",
    solution: [
      "Integrate MPP32 as a pre-execution filter before any buy fires",
      "Skip if Rug Risk >= 5. Eliminates the highest-risk pairs before capital is deployed",
      "Skip if Alpha Score < 35. Ensures momentum conditions support entry",
      "Skip if Liquidity < $25K. Below this threshold, slippage and manipulation risk are excessive",
      "$0.008 per filter query. 1,000 filters per day costs $8. One avoided rug covers 62 days.",
    ],
    keyFields: ["Rug Risk Score", "Alpha Score", "Liquidity Depth", "Pair Age"],
    mockResponse: {
      alphaScore: 58,
      rugRisk: {
        score: 2,
        level: "low",
        factors: [],
      },
      marketData: {
        liquidity: 142000,
        pairAge: "3h",
        volume24h: 89000,
      },
      decision: "PASS: all thresholds met",
    },
    costNote: "1,000 filters/day = $8.00. One avoided rug covers 62 days of filters.",
    codeSnippet: `// Pre-execution intelligence filter
const check = await mppx.request({
  url: \`\${MPP32_URL}/api/intelligence\`,
  method: "POST",
  body: { token: newPairAddress }
});

if (check.rugRisk.score >= 5) return "SKIP: rug risk too high";
if (check.alphaScore < 35)    return "SKIP: insufficient momentum";
if (check.marketData.liquidity < 25_000) return "SKIP: low liquidity";

await executeBuy(newPairAddress, positionSize);`,
  },
  {
    id: "ai-agent",
    label: "AI Trading Agent",
    tagline: "The intelligence layer autonomous agents pay for, not subscribe to.",
    problem:
      "Autonomous AI trading agents need real-time market intelligence without human intervention. Traditional data APIs require accounts, API keys, and subscription management. None of that fits agentic workflows where the agent is the user.",
    solution: [
      "HTTP 402 native: server requests payment, agent pays from its own wallet, receives data. No human approval loop",
      "MPP Sessions: agent deposits once, queries thousands of times via off-chain vouchers with sub-100ms overhead",
      "No API keys: payment credential is derived directly from the agent's on-chain wallet. Nothing to configure or rotate",
      "Structured JSON response: clean, typed, ready for agent reasoning without parsing overhead",
      "Built for Solana's agentic ecosystem. Compatible with @solana/mpp SDK and any MPP-aware agent framework",
    ],
    keyFields: [
      "Alpha Score",
      "Rug Risk Score",
      "Pump Probability",
      "Risk-Reward Ratio",
      "Smart Money Signals",
      "Projected ROI",
      "Whale Activity",
      "Market Intelligence",
    ],
    mockResponse: {
      alphaScore: 77,
      rugRisk: { score: 1, level: "minimal" },
      pumpProbability24h: 64,
      riskRewardRatio: "5.1:1",
      smartMoneySignals: ["Buy-side dominance (68%)", "Volume above 24h avg"],
      projectedROI: { low: "+14%", high: "+61%", timeframe: "24h" },
      timestamp: "2026-03-31T14:23:45.000Z",
    },
    costNote:
      "Agent deposits into an MPP session. Covers 1,250+ intelligence queries per $10. Refills automatically.",
    codeSnippet: `// Autonomous agent intelligence loop
const session = await mppx.createSession({
  wallet: agentKeypair,
  deposit: 10_000_000 // 10 USD equivalent
});

async function evaluateToken(address: string) {
  const intel = await session.request({
    url: \`\${MPP32_URL}/api/intelligence\`,
    method: "POST",
    body: { token: address }
  });

  if (intel.rugRisk.score > 3) return { action: "SKIP" };
  if (intel.alphaScore > 70)   return { action: "BUY", confidence: "HIGH" };
  return { action: "WATCH" };
}`,
  },
  {
    id: "portfolio",
    label: "Portfolio Monitor",
    tagline: "Rug pulls don't announce themselves. Your monitoring should.",
    problem:
      "Tokens you hold can deteriorate silently. Liquidity drains. Developer wallets begin distributing. Social presence evaporates. By the time the chart shows it, you're already down 60%.",
    solution: [
      "Rug Risk Score escalation: a jump from 2 (Low) to 6 (Elevated) means something changed on-chain. Investigate before the market does",
      "Whale Activity direction flip: 'Accumulating' to 'Distributing' means smart money is exiting your position",
      "Alpha Score decay: 75 → 40 → 20 over successive queries indicates exhausted momentum",
      "Liquidity/Market Cap ratio decline: LP removal underway. Token is being abandoned",
      "Query held tokens on a schedule; exit on any combination of escalating signals",
    ],
    keyFields: ["Rug Risk Score", "Whale Activity", "Alpha Score", "Liquidity Depth", "Smart Money Signals"],
    mockResponse: {
      token: { symbol: "MYTOKEN" },
      alphaScore: 23,
      rugRisk: {
        score: 6,
        level: "elevated",
        factors: [
          "Sell pressure (24h sells 1.8x buys)",
          "Liquidity/MC ratio < 3%",
        ],
      },
      whaleActivity: {
        level: "high",
        dominanceScore: 29,
      },
      smartMoneySignals: ["Sell-side pressure dominant"],
    },
    costNote: "Monitor 10 tokens every 30 minutes for $0.096/hour. Total daily surveillance: $2.30.",
  },
  {
    id: "developer",
    label: "DeFi Developer",
    tagline: "Add on-chain risk context to any application.",
    problem:
      "Wallet apps display balances. DEX interfaces display prices. Neither surfaces the signal that protects users from holding rugged tokens or entering at peak overextension.",
    solution: [
      "REST API with no auth overhead. MPP handles payment natively, no user accounts required",
      "Embed Rug Risk badges next to token balances in any wallet UI",
      "Surface Alpha Scores on DEX token search and discovery",
      "Pump Probability as a user-facing risk indicator in any trading interface",
      "Pass MPP cost through to users via session deposits. Your app never touches private keys",
      "Clean JSON schema, consistent field names, TypeScript-friendly response structure",
    ],
    keyFields: [
      "Alpha Score",
      "Rug Risk Score",
      "Pump Probability",
      "Market Intelligence",
      "Whale Activity",
      "Smart Money Signals",
    ],
    mockResponse: {
      token: {
        address: "DezX...AcJ",
        name: "Bonk",
        symbol: "BONK",
        priceUsd: "0.00002847",
      },
      alphaScore: 71,
      rugRisk: { score: 1, level: "minimal" },
      marketData: {
        volume24h: 4820000,
        liquidity: 12400000,
        marketCap: 1820000000,
      },
      dataSource: "DexScreener+Jupiter+CoinGecko",
    },
    costNote:
      "$0.008 per API call across all 5 supported protocols. Bill users directly via MPP sessions or absorb cost, your choice.",
    codeSnippet: `// Embed risk context in your wallet UI
async function getTokenRiskBadge(tokenAddress: string) {
  const intel = await api.post("/api/intelligence", {
    token: tokenAddress
  });

  return {
    rugRisk: intel.rugRisk.level,    // "minimal" | "low" | "elevated" | "high" | "critical"
    alphaScore: intel.alphaScore,     // 0-100
    isWarning: intel.rugRisk.score >= 5
  };
}`,
  },
];

export default function UseCases() {
  return (
    <div className="bg-mpp-bg min-h-screen">
      <UseCasesHero />

      <ProviderUseCases />

      {/* Oracle consumer use cases */}
      <section className="pt-20 pb-8 border-b border-mpp-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Oracle Consumers
          </p>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold text-foreground leading-tight mb-5">
            Who uses the MPP32 Oracle
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
            The MPP32 Intelligence API serves traders, bots, agents, and developers who need on-chain Solana token analysis. Pay $0.008 per query via any of 5 supported payment protocols. No account required.
          </p>
        </div>
      </section>

      {useCases.map((useCase, index) => (
        <PersonaBlock
          key={useCase.id}
          {...useCase}
          isReversed={index % 2 !== 0}
        />
      ))}

      <TrustSection />

      {/* Bottom CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-mpp-card border border-mpp-border rounded-2xl p-10 lg:p-16 text-center">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
              Ready to query
            </p>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold text-foreground mb-5 max-w-2xl mx-auto leading-tight">
              Every use case starts with one query
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto mb-8">
              No account required. No subscription. Paste a token address, pay $0.008 via any supported protocol, receive full on-chain intelligence in under 2 seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/playground">
                <button className="btn-amber flex items-center gap-2 text-sm px-6 py-2.5 rounded font-semibold">
                  Run a Free Query
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/docs">
                <button className="text-sm text-muted-foreground border border-mpp-border hover:border-mpp-amber/50 hover:text-foreground px-6 py-2.5 rounded transition-all duration-200">
                  Read the API Docs
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
