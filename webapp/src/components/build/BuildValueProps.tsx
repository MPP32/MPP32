const props = [
  {
    num: "01",
    title: "Zero Custody",
    description:
      "Payments route directly to your wallet the moment a query is verified. No platform hold, no payout threshold.",
  },
  {
    num: "02",
    title: "Per-Query Pricing",
    description:
      "Charge fractions of a cent per call. No subscriptions, no invoices. Users pay exactly for what they use.",
  },
  {
    num: "03",
    title: "Instant Listing",
    description:
      "Submit your endpoint and go live in the ecosystem immediately. Discoverable by agents, bots, and traders.",
  },
  {
    num: "04",
    title: "Composable",
    description:
      "Chain services together. Your signal feeds another service's executor. Each hop earns the builder behind it.",
  },
];

export function BuildValueProps() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {props.map((prop) => (
            <div
              key={prop.title}
              className="card-surface border border-mpp-border rounded-lg p-6"
            >
              <p className="font-mono text-mpp-amber text-xs mb-5">{prop.num}</p>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {prop.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
