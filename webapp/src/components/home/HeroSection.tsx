import { Link } from "react-router-dom";
import {
  ArrowRight,
  Server,
  Cpu,
  Bot,
  Shield,
  CheckCircle2,
  Zap,
  ArrowRightLeft,
} from "lucide-react";

const protocols = [
  { name: "Tempo", version: "v2.1", status: "Active", type: "Streaming" },
  { name: "x402", version: "v1.0", status: "Verified", type: "HTTP Pay" },
  { name: "AP2", version: "v3.2", status: "Active", type: "Agent-to-Agent" },
  { name: "ACP", version: "v1.4", status: "Verified", type: "Commerce" },
  { name: "AGTP", version: "v2.0", status: "Active", type: "Transport" },
];

const codeLines = [
  { text: "// Register once. Accept every protocol.", dim: true },
  { text: "" },
  { text: "POST /v1/register", accent: true },
  { text: "{" },
  { text: '  "endpoint": "api.yourservice.com",', key: "endpoint" },
  { text: '  "wallet":   "0x...your_wallet",', key: "wallet" },
  { text: '  "protocols": "auto"', key: "protocols" },
  { text: "}" },
  { text: "" },
  { text: "→ 5 protocols routed automatically", accent: true },
];

function FlowLine({ direction, delay }: { direction: "left" | "right"; delay: string }) {
  return (
    <div className="flow-track h-6 flex-1 hidden sm:block relative">
      <div
        className={`flow-particle ${direction === "right" ? "animate-flow-right bg-mpp-amber" : "animate-flow-left bg-green-500"}`}
        style={{ animationDelay: delay }}
      />
      <div
        className={`flow-particle ${direction === "right" ? "animate-flow-right bg-mpp-amber/50" : "animate-flow-left bg-green-500/50"}`}
        style={{ animationDelay: `calc(${delay} + 1.5s)` }}
      />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center pt-14">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left: text (5 of 12 cols) */}
          <div className="lg:col-span-5 animate-fade-in-up lg:sticky lg:top-28">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-6">
              Universal Agent Payment Proxy
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-5xl xl:text-6xl leading-[1.05] font-semibold text-foreground mb-6">
              One Integration.
              <br />
              Every Agent
              <br />
              Payment Protocol.
            </h1>
            <p className="text-muted-foreground text-base lg:text-lg leading-relaxed max-w-xl mb-8">
              Your API speaks one language. AI agents speak five different
              payment protocols. MPP32 sits in between, verifying payments,
              translating protocols, and routing revenue directly to your
              wallet. Register once, accept every protocol automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <Link to="/build">
                <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                  Connect Your API
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/playground">
                <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm w-full sm:w-auto justify-center">
                  See It Work
                </button>
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <Link to="/agent-console">
                <button className="border border-mpp-amber/40 bg-mpp-amber/5 text-mpp-amber hover:bg-mpp-amber/10 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                  <Bot className="w-4 h-4" />
                  Launch an Agent
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/catalog">
                <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm w-full sm:w-auto justify-center">
                  Browse 4,000+ services
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <div className="mb-6">
              <Link to="/agent-hub" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1">
                How agent commerce works →
              </Link>
            </div>
            <p className="font-mono text-muted-foreground text-xs">
              5 protocols · Tempo · x402 · AP2 · ACP · AGTP
            </p>
          </div>

          {/* Right: premium demo visual (7 of 12 cols) */}
          <div
            className="lg:col-span-7 animate-fade-in"
            style={{ animationDelay: "0.2s", animationFillMode: "both" }}
          >
            <div className="border border-mpp-border rounded-lg bg-mpp-surface overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-mpp-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
                  <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                    System Online
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  mpp32.network
                </span>
              </div>

              {/* Section 1: Flow Visualization */}
              <div className="px-4 sm:px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Payment Flow
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* API Providers node */}
                  <div className="flex-shrink-0 w-[100px] sm:w-[120px] border border-mpp-border rounded bg-mpp-card p-3 text-center">
                    <Server className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
                    <p className="font-mono text-[10px] text-muted-foreground leading-none mb-0.5">
                      Providers
                    </p>
                    <p className="text-xs font-medium text-foreground leading-none">
                      Your APIs
                    </p>
                  </div>

                  {/* Flow line: providers <- MPP32 (revenue flows left) */}
                  <FlowLine direction="left" delay="0s" />
                  <div className="sm:hidden text-muted-foreground text-xs">
                    <ArrowRight className="w-3 h-3 rotate-180" />
                  </div>

                  {/* MPP32 center node */}
                  <div className="flex-shrink-0 w-[110px] sm:w-[130px] border-2 border-mpp-amber rounded bg-mpp-amber/5 p-3 text-center animate-glow-pulse">
                    <Cpu className="w-4 h-4 text-mpp-amber mx-auto mb-1.5" />
                    <p className="font-mono text-[10px] text-mpp-amber leading-none mb-0.5 font-semibold">
                      MPP32
                    </p>
                    <p className="text-[10px] text-foreground leading-none">
                      Verify & Route
                    </p>
                  </div>

                  {/* Flow line: MPP32 <- Agents (payments flow left) */}
                  <FlowLine direction="left" delay="0.5s" />
                  <div className="sm:hidden text-muted-foreground text-xs">
                    <ArrowRight className="w-3 h-3 rotate-180" />
                  </div>

                  {/* AI Agents node */}
                  <div className="flex-shrink-0 w-[100px] sm:w-[120px] border border-mpp-border rounded bg-mpp-card p-3 text-center">
                    <Bot className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
                    <p className="font-mono text-[10px] text-muted-foreground leading-none mb-0.5">
                      Agents
                    </p>
                    <p className="text-xs font-medium text-foreground leading-none">
                      AI Clients
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-mpp-border mx-4 sm:mx-5" />

              {/* Section 2: Protocol Status Panel */}
              <div className="px-4 sm:px-5 pt-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Protocol Status
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-green-500">
                    5/5 online
                  </span>
                </div>

                <div className="space-y-0">
                  {protocols.map((protocol, i) => (
                    <div
                      key={protocol.name}
                      className={`flex items-center gap-3 py-2 ${i < protocols.length - 1 ? "border-b border-mpp-border/50" : ""}`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot flex-shrink-0" />
                      <span className="font-mono text-xs text-foreground font-medium w-12">
                        {protocol.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground w-10 hidden sm:block">
                        {protocol.version}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground flex-1 hidden sm:block">
                        {protocol.type}
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="font-mono text-[10px] text-green-500">
                          {protocol.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-mpp-border mx-4 sm:mx-5" />

              {/* Section 3: Integration Preview */}
              <div className="px-4 sm:px-5 pt-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Integration
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-mpp-amber">
                    1 request
                  </span>
                </div>

                <div className="bg-mpp-bg rounded border border-mpp-border/50 p-3 sm:p-4">
                  {codeLines.map((line, i) => (
                    <div key={i} className={`animate-stagger-${Math.min(i + 1, 4)}`}>
                      {line.text === "" ? (
                        <div className="h-3" />
                      ) : (
                        <p className={`font-mono text-[11px] sm:text-xs leading-relaxed ${line.dim ? "text-muted-foreground/60" : line.accent ? "text-mpp-amber" : "text-foreground/80"}`}>
                          {line.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
