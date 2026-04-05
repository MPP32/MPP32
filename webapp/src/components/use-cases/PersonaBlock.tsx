type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function JsonToken({ value, indent = 0 }: { value: JsonValue; indent?: number }) {
  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);

  if (value === null) {
    return <span className="text-purple-400">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-purple-400">{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-blue-400">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-mpp-amber">&quot;{value}&quot;</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }
    return (
      <>
        <span className="text-muted-foreground">[</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: `${(indent + 1) * 1}rem` }}>
            <JsonToken value={item as JsonValue} indent={indent + 1} />
            {i < value.length - 1 && <span className="text-muted-foreground">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: `${indent * 1}rem` }}>
          <span className="text-muted-foreground">]</span>
        </div>
      </>
    );
  }

  // object
  const entries = Object.entries(value as Record<string, JsonValue>);
  if (entries.length === 0) {
    return <span className="text-muted-foreground">{"{}"}</span>;
  }

  return (
    <>
      <span className="text-muted-foreground">{"{"}</span>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ paddingLeft: `${(indent + 1) * 1}rem` }}>
          <span className="text-mpp-success">&quot;{k}&quot;</span>
          <span className="text-muted-foreground">: </span>
          <JsonToken value={v} indent={indent + 1} />
          {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
        </div>
      ))}
      <div style={{ paddingLeft: `${indent * 1}rem` }}>
        <span className="text-muted-foreground">{"}"}</span>
      </div>
    </>
  );
}

export interface PersonaBlockProps {
  id: string;
  label: string;
  tagline: string;
  problem: string;
  solution: string[];
  keyFields: string[];
  mockResponse: Record<string, unknown>;
  costNote: string;
  codeSnippet?: string;
  isReversed?: boolean;
}

export function PersonaBlock({
  id,
  label,
  tagline,
  problem,
  solution,
  keyFields,
  mockResponse,
  costNote,
  codeSnippet,
  isReversed = false,
}: PersonaBlockProps) {
  return (
    <section id={id} className="py-20 border-b border-mpp-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start ${
            isReversed ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""
          }`}
        >
          {/* Text column */}
          <div className="space-y-8">
            {/* Label + tagline */}
            <div>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
                {label}
              </p>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-foreground leading-snug mb-5">
                {tagline}
              </h2>
            </div>

            {/* Problem */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                The Problem
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed italic border-l-2 border-mpp-border pl-4">
                {problem}
              </p>
            </div>

            {/* Solution */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                How MPP32 Solves It
              </p>
              <ul className="space-y-2.5">
                {solution.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
                    <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-mpp-amber" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Key fields */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Key Intelligence Fields
              </p>
              <div className="flex flex-wrap gap-2">
                {keyFields.map((field) => (
                  <span
                    key={field}
                    className="font-mono text-xs text-mpp-amber border border-mpp-amber/30 px-2 py-0.5 rounded"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            {/* Cost note */}
            <div className="flex items-start gap-3 bg-mpp-surface border border-mpp-border rounded-lg px-4 py-3">
              <span className="font-mono text-mpp-amber text-xs mt-0.5">$</span>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {costNote}
              </p>
            </div>
          </div>

          {/* Data column */}
          <div className="space-y-4">
            {/* Terminal card */}
            <div className="bg-mpp-card border border-mpp-border rounded-xl overflow-hidden">
              {/* Terminal chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-mpp-border bg-mpp-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-mpp-danger/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-mpp-warning/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-mpp-success/60" />
                <span className="ml-3 font-mono text-xs text-muted-foreground">
                  POST /api/intelligence → 200 OK
                </span>
              </div>
              {/* JSON body */}
              <div className="p-5 overflow-x-auto">
                <pre className="font-mono text-xs leading-relaxed">
                  <JsonToken value={mockResponse as JsonValue} indent={0} />
                </pre>
              </div>
            </div>

            {/* Code snippet */}
            {codeSnippet !== undefined && codeSnippet !== "" && (
              <div className="bg-mpp-card border border-mpp-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-mpp-border bg-mpp-surface">
                  <span className="font-mono text-xs text-muted-foreground">TypeScript</span>
                </div>
                <div className="p-5 overflow-x-auto">
                  <pre className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre">
                    {codeSnippet}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
