const steps = [
  {
    number: "01",
    title: "You've Already Built the Hard Part",
    description:
      "Have a working sniper bot, a token screener, a copy trade signal? Any HTTP endpoint that returns useful data is monetizable. No rebuild required, no SDK to install.",
    code: null,
  },
  {
    number: "02",
    title: "Your Endpoint Stays Plain HTTP",
    description:
      "Our hosted proxy handles all MPP payment verification. You just expose a standard HTTP endpoint in any language, any framework. No middleware, no auth layer to add. Your endpoint receives a normal request only after payment is verified.",
    code: `// Your existing endpoint, any stack, no MPP integration needed
app.post('/analyze', async (req, res) => {
  const { token } = req.body
  const signal = await analyzeToken(token)
  res.json({ data: signal })
})

// Just make sure it's publicly reachable over HTTPS.`,
  },
  {
    number: "03",
    title: "Submit & Set Your Price",
    description:
      "Fill out the form with your endpoint URL, pricing in USD (typically $0.001 to $0.1 per call), and your wallet addresses. MPP32 supports five payment protocols: Tempo, x402, AP2, ACP, and AGTP. Your listing is live instantly with a hosted proxy URL.",
    code: null,
  },
  {
    number: "04",
    title: "Earn On Every Query",
    description:
      "Callers hit your proxy URL (api.mpp32.org/api/proxy/your-slug). Every successful query settles a payment directly to your wallet across any of the five supported protocols. No invoicing, no custody, no waiting. Track stats and edit settings anytime from the Manage Dashboard.",
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
