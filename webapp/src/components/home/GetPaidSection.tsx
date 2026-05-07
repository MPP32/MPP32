import { Link } from "react-router-dom";
import { DollarSign, Shield, Zap, BarChart3, Globe, Clock } from "lucide-react";

const benefits = [
  {
    icon: DollarSign,
    title: "100% of revenue is yours",
    desc: "Every payment routes directly to your wallet. Zero platform commission, zero delays, zero middlemen.",
  },
  {
    icon: Zap,
    title: "Live in 5 minutes",
    desc: "Submit your HTTP endpoint, set your price, and you're instantly discoverable by AI agents worldwide.",
  },
  {
    icon: Shield,
    title: "Enterprise-grade infrastructure",
    desc: "Rate limiting, idempotency protection, request auditing, structured logging, and upstream retry logic. All handled for you.",
  },
  {
    icon: BarChart3,
    title: "Full visibility",
    desc: "Real-time analytics on every request: success rates, latency, revenue tracking, and error breakdowns in your provider dashboard.",
  },
  {
    icon: Globe,
    title: "Global agent discovery",
    desc: "Your API is listed in the MPP ecosystem and discoverable on MPPScan, the protocol explorer used by registered services worldwide.",
  },
  {
    icon: Clock,
    title: "Zero switching cost",
    desc: "Keep your existing infrastructure. MPP32 proxies requests to your endpoint. No code changes, no vendor lock-in, no migration.",
  },
];

export function GetPaidSection() {
  return (
    <section className="py-24 border-t border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="max-w-3xl mb-16">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            For API Providers
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-5">
            Stop building payment infrastructure. Start getting paid.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            AI agents are already making millions of API calls daily, and that number is accelerating. The question isn't whether your API will serve agents. It's whether you'll get paid when it does.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            MPP32 sits between your API and AI agents to handle payment verification, protocol translation, and agent discovery. Every request is payment-gated across all 5 protocols. Every payment settles directly to your wallet. No API keys to manage, no billing infrastructure to build, no invoices to chase.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group card-surface border border-mpp-border rounded-lg p-6 hover:border-mpp-amber/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-mpp-amber/10 flex items-center justify-center shrink-0">
                  <b.icon className="w-4 h-4 text-mpp-amber" />
                </div>
                <p className="text-foreground font-semibold text-sm">{b.title}</p>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="card-surface border border-mpp-border rounded-lg p-8 md:p-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="font-mono text-mpp-amber text-[10px] uppercase tracking-widest mb-3">
                Why now
              </p>
              <h3 className="font-display text-2xl font-semibold text-foreground mb-3">
                The agent economy is here.
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Autonomous agents are actively searching for paid APIs to complete tasks. Machine-to-machine payments are becoming the standard, and early providers are positioning themselves at the center of this new economy.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your risk is near zero. Keep your existing setup. MPP32 proxies traffic to your endpoint with production-grade reliability. Body size limits, idempotency keys to prevent double charging, automatic retries for transient failures, 5-protocol payment verification, and a full audit trail of every request.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-mpp-border rounded-lg p-5 bg-mpp-bg/50">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="font-mono text-xs text-muted-foreground">What you do</p>
                </div>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-mpp-amber">1.</span>
                    <span className="text-foreground">Submit your HTTP endpoint</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mpp-amber">2.</span>
                    <span className="text-foreground">Set your price in USD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mpp-amber">3.</span>
                    <span className="text-foreground">Paste your wallet address</span>
                  </div>
                </div>
              </div>

              <div className="border border-mpp-amber/20 rounded-lg p-5 bg-mpp-amber/5">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="font-mono text-xs text-mpp-amber">What MPP32 handles</p>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>5-protocol payments (Tempo, x402, ACP, AP2, AGTP)</p>
                  <p>Payment gating and verification</p>
                  <p>Rate limiting and DDoS protection</p>
                  <p>Request auditing and analytics</p>
                  <p>Retry logic and idempotency</p>
                  <p>Global discovery and MPPScan listing</p>
                  <p>MCP server for AI agent access</p>
                  <p>Endpoint health monitoring</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-mpp-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link to="/build">
              <button className="btn-amber px-6 py-2.5 rounded text-sm font-semibold">
                Deploy Your API Now
              </button>
            </Link>
            <p className="text-muted-foreground text-xs">
              Takes under 5 minutes. No code changes to your existing service.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
