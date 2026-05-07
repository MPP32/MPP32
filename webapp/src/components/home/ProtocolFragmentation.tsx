import { Wallet, CreditCard, ShieldCheck, ShoppingCart, Bot } from "lucide-react";

const protocols = [
  {
    name: "Tempo",
    desc: "Stablecoin payments on Ethereum L2. Settled in pathUSD.",
    icon: Wallet,
  },
  {
    name: "x402",
    desc: "USDC payments on Solana. HTTP 402 standard.",
    icon: CreditCard,
  },
  {
    name: "AP2",
    desc: "Cryptographic authorization proofs. Verifiable credentials for agent compliance.",
    icon: ShieldCheck,
  },
  {
    name: "ACP",
    desc: "Checkout session-based commerce. Cart and payment flows for agents.",
    icon: ShoppingCart,
  },
  {
    name: "AGTP",
    desc: "Agent identity and intent routing. Purpose-built protocol for machine traffic.",
    icon: Bot,
  },
];

export function ProtocolFragmentation() {
  return (
    <section className="py-24 border-t border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="max-w-3xl mb-16">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            The Problem
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-5">
            Five payment protocols. One proxy.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            AI agents and the services they use need to agree on how to handle payments. Right now there are five different standards for that, and each one works differently. Different headers, different ways to verify who is paying, and different networks where the money actually settles. If you run an API, you would normally need to integrate each protocol separately. MPP32 eliminates that entirely. One integration, all five protocols, handled for you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-12">
          {protocols.map((p) => (
            <div
              key={p.name}
              className="group card-surface border border-mpp-border rounded-lg p-6 hover:border-mpp-amber/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-mpp-amber/10 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-mpp-amber" />
              </div>
              <p className="font-mono text-foreground font-semibold text-sm mb-2">
                {p.name}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="card-surface border border-mpp-amber/20 rounded-lg p-6 md:p-8 bg-mpp-amber/5">
          <p className="text-foreground text-sm sm:text-base leading-relaxed">
            You don't need to understand any of this. Register your API with MPP32, and every protocol is handled automatically.
          </p>
        </div>
      </div>
    </section>
  );
}
