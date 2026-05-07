import { Layers, Target, Lock, Radar } from "lucide-react";

const reasons = [
  {
    icon: Layers,
    title: "Protocol complexity",
    desc: "Five protocols today, more emerging. Each has its own authentication scheme, header format, and settlement network. Supporting even one properly takes weeks of engineering. Supporting all five while each one evolves? That's a full-time team.",
  },
  {
    icon: Target,
    title: "Not your core product",
    desc: "You built your API to do something valuable. Image generation, data analysis, trading signals. Every hour spent maintaining payment infrastructure is an hour not spent making your product better.",
  },
  {
    icon: Lock,
    title: "Compliance and security",
    desc: "Agent authorization requires cryptographic signature verification, credential parsing, mandate validation, and tamper-proof audit logs. That's specialized security engineering that needs constant updates as standards evolve.",
  },
  {
    icon: Radar,
    title: "Discovery problem",
    desc: "Even with perfect payment support, agents still need to find your API. MPP32 includes OpenAPI discovery, MCP server integration, and an ecosystem directory. You're not just accepting payments, you're getting listed where agents look.",
  },
];

export function WhyProvidersWontBuild() {
  return (
    <section className="py-24 border-t border-mpp-border bg-mpp-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="max-w-3xl mb-16">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Why MPP32
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-5">
            Four reasons you need a payment proxy.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Building multi-protocol payment support is complex, expensive, and constantly shifting. It's not worth doing yourself when MPP32 handles it out of the box.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-12">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="group card-surface border border-mpp-border rounded-lg p-6 md:p-8 hover:border-mpp-amber/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-mpp-amber/10 flex items-center justify-center shrink-0">
                  <r.icon className="w-5 h-5 text-mpp-amber" />
                </div>
                <p className="text-foreground font-semibold text-base">{r.title}</p>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {r.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="card-surface border border-mpp-amber/20 rounded-lg p-6 md:p-8 bg-mpp-amber/5">
          <p className="text-foreground text-sm sm:text-base leading-relaxed">
            MPP32 handles all of this. You just submit your endpoint URL, set your price, and start earning.
          </p>
        </div>
      </div>
    </section>
  );
}
