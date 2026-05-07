import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const curlCode = `curl -X POST https://mpp32.org/api/intelligence \\
  -H "Content-Type: application/json" \\
  -d '{"token":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}'
# <- 402 Payment Required (5 protocol challenges)
# Pay via: npx mppx https://mpp32.org/api/intelligence ...`;

const jsCode = `import { Mppx } from 'mppx/client'

const client = Mppx.create({
  wallet: process.env.WALLET_KEY
})

// MPP32 returns 402 with all 5 protocol challenges.
// The client picks whichever protocol it supports and pays.
const res = await client.fetch('https://mpp32.org/api/intelligence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' })
})
const { data } = await res.json()
console.log(data.alphaScore) // 82`;

const tabs = ["cURL", "JavaScript"] as const;
type Tab = (typeof tabs)[number];

export function IntegrationStrip() {
  const [active, setActive] = useState<Tab>("cURL");

  return (
    <section className="py-24 border-y border-mpp-border bg-mpp-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              Integration
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Five protocols. One response.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-6">
              When an agent calls your API through MPP32 without payment credentials, they receive a single HTTP 402 response containing challenge headers for all 5 protocols. The agent picks whichever protocol they support and pays. You never need to know which one they chose.
            </p>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">&larr;</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">402</span> with 5 protocol challenges
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">&rarr;</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">Agent pays</span> with any supported protocol
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">&larr;</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">200</span> + data + receipt
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs mt-4 pt-4 border-t border-mpp-border/50">
              This is how every MPP32 service works. Register your API and agents can pay with any protocol.{" "}
              <Link to="/build" className="text-mpp-amber hover:underline">Get started &rarr;</Link>
            </p>
          </div>

          <div>
            {/* Tab bar */}
            <div className="flex gap-0 border border-mpp-border rounded overflow-hidden mb-0 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActive(tab)}
                  className={cn(
                    "px-4 py-2 text-xs font-mono transition-colors",
                    active === tab
                      ? "bg-mpp-card text-foreground"
                      : "bg-mpp-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="card-surface rounded-t-none rounded-b rounded-tr p-5 border-t-0">
              <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre-wrap">
                {active === "cURL" ? curlCode : jsCode}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
