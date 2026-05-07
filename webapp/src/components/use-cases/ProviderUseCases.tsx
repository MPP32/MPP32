import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const providerCases = [
  {
    id: "data-api",
    label: "Data API",
    tagline: "Any data service with an HTTP endpoint can earn revenue through MPP.",
    what: "You operate an API that returns structured data. Market feeds, analytics, risk scores, blockchain indexing, social metrics, or any other data product. Right now you are either giving it away, managing API keys, or running a subscription model that limits your reach to committed buyers.",
    howMpp32Helps: [
      "Register your endpoint on MPP32 and set a price per request in USD. No changes to your existing code or infrastructure",
      "MPP32 proxies every request to your server and verifies payment before the call reaches you. Your API only receives paid, authenticated traffic",
      "Callers pay through any of 5 supported protocols (Tempo, x402, AP2, ACP, AGTP). You accept all of them without writing any payment code",
      "Payments settle directly to your wallet on every request. No invoices, no billing cycles, no accounts receivable",
      "Your service is listed in the MPP32 Ecosystem and discoverable by AI agents through the MCP server from the moment you register",
    ],
    revenue: "1,000 queries/day at $0.01 = $300/month. 10,000 queries/day = $3,000/month. You set the price.",
  },
  {
    id: "intelligence-api",
    label: "Intelligence API",
    tagline: "Proprietary analysis is worth more than raw data. Price it accordingly.",
    what: "You built something that goes beyond raw data. Scoring models, classification engines, pattern detection, predictive analysis, or composite intelligence that combines multiple sources into a single output. This is high value work and the pricing model should reflect that.",
    howMpp32Helps: [
      "MPP32 wraps your HTTP endpoint in the Machine Payments Protocol so every request requires payment before execution",
      "Set premium pricing that reflects the value of your analysis. There is no ceiling on what you can charge per call",
      "Rate limiting and DDoS protection sit in front of your endpoint. You only see clean, verified, paid traffic",
      "Idempotency keys prevent double charging. Retry logic handles transient failures. Body size limits protect against abuse",
      "Real time analytics show query volume, revenue, latency, and error rates in your provider dashboard",
    ],
    revenue: "Premium APIs at $0.05 per call. A single power user querying 10,000 times/day generates $500/day, $15,000/month.",
  },
  {
    id: "model-serving",
    label: "Model Serving",
    tagline: "Turn compute costs into revenue. Every inference should pay for itself.",
    what: "You serve a trained model behind an API. Classification, prediction, scoring, generation, or any other inference workload. The compute costs you money on every call. Per request pricing means callers cover that cost and you keep the margin.",
    howMpp32Helps: [
      "Wrap your inference endpoint in MPP32. Every call costs the caller, not you. Revenue scales with usage automatically",
      "Price per inference. Charge more for heavier models or larger payloads. The protocol does not limit your pricing",
      "Agents running on any MCP-compatible AI framework discover and pay for your model without any onboarding",
      "Zero code changes to your model serving infrastructure. MPP32 proxies to your existing endpoint as it runs today",
      "Endpoint health monitoring and automatic upstream retries keep your service reliable without extra engineering on your side",
    ],
    revenue: "Inference at $0.03 per call. A single automated client querying every 30 seconds generates $86/day from one account.",
  },
  {
    id: "infra-services",
    label: "Infrastructure Services",
    tagline: "Usage based pricing for infrastructure eliminates abuse and aligns cost with value.",
    what: "You operate RPC nodes, indexing services, storage layers, or specialized compute infrastructure. Free tiers attract abuse and cost you money. Subscriptions require sales cycles. Per request pricing matches revenue to actual usage with zero overhead.",
    howMpp32Helps: [
      "Gate every API call behind an HTTP 402 payment. Abuse stops because every request costs money. No more rate limit games",
      "Callers pay through any of 5 supported protocols, all USD denominated. No volatile token exposure for you or your users",
      "MPP32 handles the full payment verification flow. Your infrastructure serves requests. That is the only responsibility it carries",
      "Request auditing gives you a complete picture of who is calling, how often, and what they are paying across every endpoint",
      "Global discovery means any developer or agent in the MPP ecosystem can find and use your infrastructure on the first call",
    ],
    revenue: "Infrastructure at $0.001 per call. 100,000 calls/day = $100/day. Scale linearly with zero sales effort.",
  },
  {
    id: "saas-monetization",
    label: "SaaS API Monetization",
    tagline: "You already built the product. MPP32 adds a revenue layer without touching your code.",
    what: "You run a SaaS product or platform with an API that external developers or agents could use. Building a billing system, managing API keys, tracking usage, and collecting payments is a project in itself. MPP32 replaces all of that with a single registration.",
    howMpp32Helps: [
      "Submit your endpoint URL and wallet address. MPP32 handles payment collection, verification, and settlement on every call",
      "No SDK integration needed on your side. If your service returns data over HTTP, it works with MPP32",
      "AI agents discover your service through the MCP server and pay automatically. No API key exchange, no developer portal needed",
      "You keep 100% of revenue. MPP32 charges no fees, takes no commission, and holds no funds at any point",
      "Update your price, endpoint URL, or description at any time from the management console. Changes take effect immediately",
    ],
    revenue: "SaaS APIs at $0.02 per call across 500 daily users averaging 20 queries each = $200/day, $6,000/month.",
  },
  {
    id: "any-http",
    label: "Any HTTP Endpoint",
    tagline: "If it responds to HTTP, MPP32 can monetize it.",
    what: "The use cases above are examples. MPP32 is not limited to any category, industry, or data type. Any service that accepts an HTTP request and returns a response can be registered, priced, and monetized through the protocol. The only requirement is a URL and a wallet address.",
    howMpp32Helps: [
      "Register in under 5 minutes. No approval process, no review queue, no waiting period. Submit and go live immediately",
      "Both human developers and autonomous AI agents can pay your API through any of 5 supported protocols: Tempo, x402, AP2, ACP, and AGTP",
      "MPP32 verifies every payment before forwarding the request to your server. Your endpoint never processes an unpaid call",
      "Structured logging and full audit trails on every request. Complete visibility into who queried, when, and what they paid",
      "Listed in the Ecosystem alongside other registered services. Network effects bring callers to your API without marketing spend",
    ],
    revenue: "You decide. Set any price from $0.0001 to $100+ per call. The protocol works at every scale.",
  },
];

export function ProviderUseCases() {
  return (
    <section className="py-20 border-b border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            For API Providers
          </p>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold text-foreground leading-tight mb-5">
            Every API type. One payment layer.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            If your service has an HTTP endpoint, MPP32 can monetize it. Register in under 5 minutes. Accept payments through all 5 supported protocols. Keep 100% of your revenue.
          </p>
        </div>

        <div className="space-y-6">
          {providerCases.map((c) => (
            <div
              key={c.id}
              id={c.id}
              className="card-surface border border-mpp-border rounded-lg overflow-hidden scroll-mt-16"
            >
              <div className="grid lg:grid-cols-5 gap-0">
                {/* Left: context */}
                <div className="lg:col-span-2 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-mpp-border">
                  <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
                    {c.label}
                  </p>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                    {c.tagline}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                    {c.what}
                  </p>
                  <div className="bg-mpp-amber/5 border border-mpp-amber/20 rounded px-4 py-3">
                    <p className="font-mono text-xs text-mpp-amber mb-1">Revenue potential</p>
                    <p className="text-foreground text-sm">{c.revenue}</p>
                  </div>
                </div>

                {/* Right: what MPP32 does */}
                <div className="lg:col-span-3 p-6 lg:p-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                    What MPP32 does for you
                  </p>
                  <ul className="space-y-3">
                    {c.howMpp32Helps.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mpp-amber" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link to="/build">
            <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Register Your API
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <p className="text-muted-foreground text-xs">
            No code changes. No SDK integration on your side. Submit a URL and start earning.
          </p>
        </div>
      </div>
    </section>
  );
}
