const steps = [
  {
    number: "01",
    title: "You've Already Built the Hard Part",
    description:
      "Have a working sniper bot, a token screener, a copy trade signal? Any HTTP endpoint that returns useful data is monetizable. No rebuild required.",
    code: null,
  },
  {
    number: "02",
    title: "Add One Middleware",
    description:
      "Add the mppx SDK to your endpoint. It handles 402 payment challenges, wallet verification, and settlement in under 200ms.",
    code: `import { mppx } from 'mppx'

const mpp = mppx({
  price: 0.008,    // 0.008 pathUSD per trigger
  wallet: 'YOUR_SOLANA_WALLET',
})

// Wrap your existing sniper endpoint
app.post('/snipe', mpp.middleware(), async (c) => {
  // Payment verified — fire the signal
  const { mint, threshold } = await c.req.json()
  const signal = await checkSniperConditions(mint, threshold)
  return c.json({ data: signal })
})`,
  },
  {
    number: "03",
    title: "Set Your Price",
    description:
      "Pick a price in pathUSD — typically $0.001–$0.05 per call. Smart contract traders understand micropayments. Price signals quality.",
    code: null,
  },
  {
    number: "04",
    title: "List & Earn",
    description:
      "Submit your endpoint. It appears in the MPP32 ecosystem instantly. Every query = a Solana payment to your wallet. No invoicing, no waiting.",
    code: null,
  },
];

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");

  function colorize(line: string, idx: number) {
    // Comments
    if (line.trim().startsWith("//")) {
      return (
        <span key={idx} className="block text-muted-foreground/60">
          {line}
        </span>
      );
    }
    // import lines
    if (line.startsWith("import")) {
      return (
        <span key={idx} className="block">
          <span className="text-mpp-amber/80">import</span>
          {line.slice(6)}
        </span>
      );
    }
    // const / async / return / app
    const highlighted = line
      .replace(
        /\b(const|async|await|return|from)\b/g,
        '<span class="text-mpp-amber/80">$1</span>'
      )
      .replace(
        /('[^']*'|"[^"]*"|`[^`]*`)/g,
        '<span class="text-green-400/70">$1</span>'
      )
      .replace(
        /\b(0\.\d+)\b/g,
        '<span class="text-blue-400/70">$1</span>'
      );
    return (
      <span
        key={idx}
        className="block"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-mpp-border rounded-lg p-5 font-mono text-xs leading-relaxed overflow-x-auto mt-4">
      {lines.map((line, i) => colorize(line, i))}
    </div>
  );
}

export function BuildHowItWorks() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          How It Works
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-12 max-w-xl">
          From existing tool to earning in four steps
        </h2>

        <div className="space-y-0">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col md:flex-row gap-6 md:gap-12 pb-12 ${
                i < steps.length - 1 ? "border-b border-mpp-border mb-12" : ""
              }`}
            >
              {/* Step number */}
              <div className="shrink-0">
                <span className="font-mono text-4xl font-semibold text-mpp-amber/20 leading-none">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                  {step.description}
                </p>
                {step.code !== null ? <CodeBlock code={step.code} /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
