import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CheckCircle, ArrowRight, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";

type SubmissionResult = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  category: string;
  websiteUrl: string;
  endpointUrl: string | null;
  pricePerQuery: number | null;
  paymentAddress: string | null;
  creatorName: string;
  queryCount: number;
  status: string;
  createdAt: string;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "token-scanner", label: "Token Scanner" },
  { value: "price-oracle", label: "Price Oracle" },
  { value: "sentiment-analysis", label: "Sentiment Analysis" },
  { value: "data-feed", label: "Data Feed" },
  { value: "trading-signal", label: "Trading Signal" },
  { value: "nft-intelligence", label: "NFT Intelligence" },
  { value: "defi-analytics", label: "DeFi Analytics" },
  { value: "other", label: "Other" },
];

const INPUT_CLASS =
  "w-full bg-mpp-card border border-mpp-border rounded px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm";

interface SubmitPayload {
  name: string;
  shortDescription: string;
  fullDescription?: string;
  category: string;
  websiteUrl: string;
  endpointUrl?: string;
  pricePerQuery?: number;
  paymentAddress?: string;
  creatorName: string;
  creatorEmail: string;
  logoUrl?: string;
  twitterHandle?: string;
  githubUrl?: string;
}

type FormState = {
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  websiteUrl: string;
  endpointUrl: string;
  pricePerQuery: string;
  paymentAddress: string;
  creatorName: string;
  creatorEmail: string;
  logoUrl: string;
  twitterHandle: string;
  githubUrl: string;
};

const INITIAL: FormState = {
  name: "",
  shortDescription: "",
  fullDescription: "",
  category: "",
  websiteUrl: "",
  endpointUrl: "",
  pricePerQuery: "",
  paymentAddress: "",
  creatorName: "",
  creatorEmail: "",
  logoUrl: "",
  twitterHandle: "",
  githubUrl: "",
};

function Label({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <label className="block mb-1.5">
      <span className="font-mono text-xs text-foreground uppercase tracking-wide">
        {children}
      </span>
      {note !== undefined ? (
        <span className="ml-2 text-xs text-muted-foreground normal-case tracking-normal font-sans">
          {note}
        </span>
      ) : null}
    </label>
  );
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function SuccessState({
  submission,
  proxyUrl,
}: {
  submission: SubmissionResult;
  proxyUrl: string;
}) {
  const [copied, setCopied] = useState<boolean>(false);

  function handleCopy() {
    navigator.clipboard.writeText(proxyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const curlSnippet = `curl -X POST \\
  ${proxyUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"your": "payload"}'`;

  return (
    <section id="submit" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest">
                Live
              </p>
              <h3 className="font-display text-2xl font-semibold text-foreground leading-tight">
                Your service is live.
              </h3>
            </div>
          </div>

          {/* Proxy URL block */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg p-5 mb-5">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
              Proxy URL
            </p>
            <div className="flex items-center gap-3">
              <code className="font-mono text-mpp-amber text-sm break-all flex-1">
                {proxyUrl}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-2">
              /api/proxy/{submission.slug}
            </p>
          </div>

          {/* Metadata */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg divide-y divide-mpp-border mb-5">
            {submission.pricePerQuery !== null ? (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-muted-foreground">Price per query</span>
                <span className="font-mono text-sm text-mpp-amber">
                  {submission.pricePerQuery} pathUSD
                </span>
              </div>
            ) : null}
            {submission.paymentAddress !== null ? (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-muted-foreground">Payment address</span>
                <span className="font-mono text-sm text-foreground">
                  {truncateAddress(submission.paymentAddress)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="font-mono text-xs text-green-400 uppercase tracking-wide">
                {submission.status}
              </span>
            </div>
          </div>

          {/* cURL snippet */}
          <div className="mb-5">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Call it
            </p>
            <pre className="bg-[#0d0d0d] border border-mpp-border rounded-lg p-4 font-mono text-xs text-foreground leading-relaxed overflow-x-auto scrollbar-thin">
              {curlSnippet}
            </pre>
          </div>

          {/* Note */}
          <p className="text-muted-foreground text-xs mb-6 leading-relaxed">
            Share this URL. Callers pay per query directly to your wallet.
          </p>

          {/* Action */}
          <Link to="/ecosystem">
            <button className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Browse Ecosystem
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function BuildSubmitForm() {
  const [form, setForm] = useState<FormState>(INITIAL);

  const mutation = useMutation({
    mutationFn: (payload: SubmitPayload) =>
      api.post<SubmissionResult>("/api/submissions", payload),
  });

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: SubmitPayload = {
      name: form.name.trim(),
      shortDescription: form.shortDescription.trim(),
      category: form.category,
      websiteUrl: form.websiteUrl.trim(),
      creatorName: form.creatorName.trim(),
      creatorEmail: form.creatorEmail.trim(),
    };

    if (form.fullDescription.trim()) payload.fullDescription = form.fullDescription.trim();
    if (form.endpointUrl.trim()) payload.endpointUrl = form.endpointUrl.trim();
    if (form.pricePerQuery.trim()) payload.pricePerQuery = parseFloat(form.pricePerQuery);
    if (form.paymentAddress.trim()) payload.paymentAddress = form.paymentAddress.trim();
    if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim();
    if (form.twitterHandle.trim()) payload.twitterHandle = form.twitterHandle.trim();
    if (form.githubUrl.trim()) payload.githubUrl = form.githubUrl.trim();

    mutation.mutate(payload);
  }

  if (mutation.isSuccess && mutation.data) {
    const submission = mutation.data;
    const proxyUrl =
      (import.meta.env.VITE_BACKEND_URL || window.location.origin) +
      "/api/proxy/" +
      submission.slug;

    return (
      <SuccessState
        submission={submission}
        proxyUrl={proxyUrl}
      />
    );
  }

  return (
    <section id="submit" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Register Your Endpoint
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-3">
            Connect your service to MPP32
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10">
            List your endpoint in the ecosystem. Users and agents discover it, pay per query, and payment routes directly to your wallet.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Required fields */}
            <div className="space-y-5">
              <div>
                <Label>Project Name</Label>
                <input
                  type="text"
                  required
                  className={INPUT_CLASS}
                  placeholder="My Token Scanner"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>

              <div>
                <Label>
                  Short Description{" "}
                  <span className="text-xs text-muted-foreground font-sans normal-case tracking-normal">
                    ({form.shortDescription.length}/160)
                  </span>
                </Label>
                <textarea
                  required
                  rows={2}
                  maxLength={160}
                  className={INPUT_CLASS + " resize-none"}
                  placeholder="One or two sentences describing what your service does."
                  value={form.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                />
              </div>

              <div>
                <Label>Category</Label>
                <select
                  required
                  className={INPUT_CLASS}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Website URL</Label>
                <input
                  type="url"
                  required
                  className={INPUT_CLASS}
                  placeholder="https://your-service.com"
                  value={form.websiteUrl}
                  onChange={(e) => set("websiteUrl", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Creator Name</Label>
                  <input
                    type="text"
                    required
                    className={INPUT_CLASS}
                    placeholder="Your name or team name"
                    value={form.creatorName}
                    onChange={(e) => set("creatorName", e.target.value)}
                  />
                </div>
                <div>
                  <Label note="Private — not displayed publicly">
                    Creator Email
                  </Label>
                  <input
                    type="email"
                    required
                    className={INPUT_CLASS}
                    placeholder="you@example.com"
                    value={form.creatorEmail}
                    onChange={(e) => set("creatorEmail", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Optional fields */}
            <div className="pt-6 border-t border-mpp-border space-y-5">
              <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                Optional
              </p>

              <div>
                <Label>Endpoint URL</Label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="https://your-service.com/api/query"
                  value={form.endpointUrl}
                  onChange={(e) => set("endpointUrl", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Price per query (pathUSD)</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className={INPUT_CLASS}
                    placeholder="0.008"
                    value={form.pricePerQuery}
                    onChange={(e) => set("pricePerQuery", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment Address</Label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Your EVM wallet address (0x...)"
                    value={form.paymentAddress}
                    onChange={(e) => set("paymentAddress", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Logo URL</Label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="https://..."
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Twitter Handle</Label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="yourhandle (without @)"
                    value={form.twitterHandle}
                    onChange={(e) => set("twitterHandle", e.target.value)}
                  />
                </div>
                <div>
                  <Label>GitHub URL</Label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="https://github.com/..."
                    value={form.githubUrl}
                    onChange={(e) => set("githubUrl", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>
                  Full Description{" "}
                  <span className="text-xs text-muted-foreground font-sans normal-case tracking-normal">
                    ({form.fullDescription.length}/2000)
                  </span>
                </Label>
                <textarea
                  rows={4}
                  maxLength={2000}
                  className={INPUT_CLASS + " resize-none"}
                  placeholder="Detailed description of your service, its use cases, and what makes it unique."
                  value={form.fullDescription}
                  onChange={(e) => set("fullDescription", e.target.value)}
                />
              </div>
            </div>

            {mutation.isError ? (
              <p className="text-red-400 text-sm">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Submission failed. Please try again."}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-amber flex items-center gap-2 text-sm px-6 py-2.5 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Submitting..." : "Submit Project"}
              {!mutation.isPending ? <ArrowRight className="w-4 h-4" /> : null}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
