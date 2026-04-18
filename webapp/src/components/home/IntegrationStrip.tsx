import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const curlCode = `curl -X POST https://api.mpp32.org/api/intelligence \\
  -H "Content-Type: application/json" \\
  -d '{"token":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}'
# <- 402 Payment Required (MPP challenge)
# Pay via: npx mppx https://api.mpp32.org/api/intelligence ...`;

const jsCode = `import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

Mppx.create({
  methods: [tempo({ account: privateKeyToAccount(process.env.PRIVATE_KEY) })]
})

const res = await fetch('https://api.mpp32.org/api/intelligence', {
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
              Integrate in minutes.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-6">
              No account setup, no API keys. Install the mppx SDK, fund a wallet with pathUSD, and your first query is one HTTP call away.
            </p>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">←</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">402</span> WWW-Authenticate: Payment amount=0.008 currency=pathUSD...
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">→</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">Authorization:</span> Payment token=...
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-mpp-amber mt-0.5">←</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">200</span> Payment-Receipt: verified · data returned
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs mt-4 pt-4 border-t border-mpp-border/50">
              This is how clients call the MPP32 Oracle. Your own MPP service works identically.{" "}
              <Link to="/build" className="text-mpp-amber hover:underline">Build yours →</Link>
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
