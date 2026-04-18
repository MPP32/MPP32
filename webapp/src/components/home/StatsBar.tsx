const stats = [
  { value: "< 2s", label: "Oracle Response" },
  { value: "8", label: "Intelligence Signals" },
  { value: "0.008 pathUSD", label: "Per Query" },
  { value: "100%", label: "Revenue to Builders" },
];

export function StatsBar() {
  return (
    <div className="border-y border-mpp-border bg-mpp-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-mpp-border">
          {stats.map((stat) => (
            <div key={stat.label} className="px-6 py-5">
              <p className="font-mono font-medium text-mpp-amber text-xl leading-none mb-1">{stat.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
