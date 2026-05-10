import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError, type ApiFieldError } from "@/lib/api";
import {
  CheckCircle,
  ArrowRight,
  Copy,
  Check,
  Download,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Zap,
  XCircle,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { SubmissionCreatedResponse, ValidateEndpointResponse } from "../../../../backend/src/types";
import { CategoryCombobox } from "./CategoryCombobox";

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const INPUT_CLASS =
  "w-full bg-mpp-card border border-mpp-border rounded px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm";

interface SubmitPayload {
  name: string;
  shortDescription: string;
  fullDescription?: string;
  category: string;
  websiteUrl: string;
  endpointUrl: string;
  pricePerQuery: number;
  paymentAddress: string;
  solanaAddress?: string;
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
  solanaAddress: string;
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
  solanaAddress: "",
  creatorName: "",
  creatorEmail: "",
  logoUrl: "",
  twitterHandle: "",
  githubUrl: "",
};

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      {message}
    </p>
  );
}

function fieldErrorMap(fields?: ApiFieldError[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!fields) return map;
  for (const f of fields) {
    if (!(f.path in map)) map[f.path] = f.message;
  }
  return map;
}

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

type EndpointTestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; responseTimeMs: number }
  | { status: "error"; message: string };

function EndpointTester({ endpointUrl }: { endpointUrl: string }) {
  const [testState, setTestState] = useState<EndpointTestState>({ status: "idle" });

  async function handleTest() {
    if (!endpointUrl.trim()) return;
    setTestState({ status: "loading" });
    try {
      const result = await api.post<ValidateEndpointResponse>(
        "/api/submissions/validate-endpoint",
        { url: endpointUrl.trim() }
      );
      if (result.reachable && result.responseTimeMs !== null) {
        setTestState({ status: "ok", responseTimeMs: result.responseTimeMs });
      } else {
        setTestState({ status: "error", message: result.error ?? "Endpoint not reachable" });
      }
    } catch {
      setTestState({ status: "error", message: "Could not reach endpoint" });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={!endpointUrl.trim() || testState.status === "loading"}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs border border-mpp-border rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:border-mpp-amber/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testState.status === "loading" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          Test
        </button>
      </div>
      {testState.status === "ok" ? (
        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          Reachable, {testState.responseTimeMs}ms
        </p>
      ) : testState.status === "error" ? (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          {testState.message}
        </p>
      ) : null}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-1.5 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label ?? "Copy"}
        </>
      )}
    </button>
  );
}

function SuccessState({ submission }: { submission: SubmissionCreatedResponse }) {
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);

  const proxyUrl =
    (import.meta.env.VITE_BACKEND_URL || window.location.origin) +
    "/api/proxy/" +
    submission.slug;

  const verifyUrl = submission.endpointUrl
    ? new URL(submission.endpointUrl).origin + "/api/mpp32-verify"
    : "";

  function handleDownload() {
    const content = [
      "MPP32 Provider Management Credentials",
      "======================================",
      "",
      `API Name:            ${submission.name}`,
      `Slug:                ${submission.slug}`,
      `Proxy URL:           ${proxyUrl}`,
      `Management Token:    ${submission.managementToken}`,
      `Verification Token:  ${submission.verificationToken}`,
      `Verify URL:          ${verifyUrl}`,
      "",
      "IMPORTANT: Keep this file safe. If you lose this token, you can recover it",
      "using your creator email at https://mpp32.org/manage.",
      "Use it at https://mpp32.org/manage to update or deprecate your API.",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpp32-${submission.slug}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maskedToken = submission.managementToken.slice(0, 8) + "•".repeat(24) + submission.managementToken.slice(-8);

  return (
    <section id="submit" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-5">

          {/* Success banner */}
          <div className="flex items-center gap-3 pb-2">
            <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-mono text-green-400 text-xs uppercase tracking-widest">Live</p>
              <h3 className="font-display text-2xl font-semibold text-foreground leading-tight">
                Your API is Live!
              </h3>
            </div>
          </div>

          {/* Management Token — most critical */}
          <div className="bg-mpp-card border border-mpp-amber/40 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-mpp-amber/20 bg-mpp-amber/5">
              <p className="font-mono text-xs text-mpp-amber uppercase tracking-widest">
                Management Token
              </p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 px-5 py-3 bg-amber-500/5 border-b border-mpp-border">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong className="text-amber-200">Save this token now.</strong> You need it to manage your API settings, update pricing, or deprecate your listing. If you lose it, you can recover it via your creator email at /manage.
              </p>
            </div>

            {/* Token display */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <code className="font-mono text-sm text-mpp-amber break-all flex-1 bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2 leading-relaxed">
                  {tokenVisible ? submission.managementToken : maskedToken}
                </code>
              </div>

              {/* Prominent Download button */}
              <button
                onClick={handleDownload}
                className="btn-amber w-full inline-flex items-center justify-center gap-2 text-sm px-6 py-3 rounded font-semibold mb-3"
              >
                <Download className="w-4 h-4" />
                Download Management Credentials
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setTokenVisible((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-1.5 transition-colors"
                >
                  {tokenVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {tokenVisible ? "Hide" : "Show"}
                </button>
                <CopyButton text={submission.managementToken} label="Copy Token" />
              </div>
            </div>
          </div>

          {/* Endpoint Verification */}
          <div className="bg-mpp-card border border-blue-500/30 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-blue-500/20 bg-blue-500/5">
              <p className="font-mono text-xs text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Endpoint Verification Required
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Proxy traffic activates after you verify ownership of your endpoint. Add a route to your server that returns a verification token, then confirm it from your dashboard.
              </p>

              {/* Step-by-step */}
              <div className="space-y-2.5">
                {[
                  { label: "Add this route to your server", desc: "It must return HTTP 200 with the token as plain text — no JSON, no HTML." },
                  { label: "Test it yourself", desc: `Run: curl -s ${submission.endpointUrl ? new URL(submission.endpointUrl).origin : "https://yourdomain.com"}/api/mpp32-verify` },
                  { label: "Click Verify in your dashboard", desc: "Go to /manage → Overview → Verify Now." },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-sm text-foreground font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick-start code example */}
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                  Quick Start (Express.js)
                </p>
                <div className="bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
                  <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`app.get('/api/mpp32-verify', (req, res) => {
  res.type('text/plain').send('${submission.verificationToken}');
});`}</pre>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  More examples (Python, static files) available in your{" "}
                  <a href="/manage" className="text-blue-400 hover:underline">dashboard</a>{" "}
                  and{" "}
                  <a href="/docs" className="text-blue-400 hover:underline">docs</a>.
                </p>
              </div>

              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                  Well-Known URL
                </p>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm text-blue-400 break-all flex-1 bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
                    {submission.endpointUrl ? new URL(submission.endpointUrl).origin : ""}/api/mpp32-verify
                  </code>
                  <CopyButton
                    text={`${submission.endpointUrl ? new URL(submission.endpointUrl).origin : ""}/api/mpp32-verify`}
                  />
                </div>
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                  Verification Token
                </p>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm text-blue-400 break-all flex-1 bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
                    {submission.verificationToken}
                  </code>
                  <CopyButton text={submission.verificationToken} label="Copy Token" />
                </div>
              </div>
            </div>
          </div>

          {/* Next steps checklist */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
              Next Steps
            </p>
            <ol className="space-y-3">
              {[
                "Save your management token — you need it to access your dashboard.",
                "Add the verification route to your server (see code example above).",
                "Test it: run the curl command above to confirm it returns your token.",
                "Go to /manage → Overview → click Verify Now to activate proxy traffic.",
                "Lost your token? Recover it anytime at /manage using your creator email.",
              ].map((txt, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full border border-mpp-amber/40 bg-mpp-amber/5 flex items-center justify-center font-mono text-xs text-mpp-amber">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed pt-0.5">{txt}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Proxy URL */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
              Proxy URL
            </p>
            <div className="flex items-center gap-3">
              <code className="font-mono text-mpp-amber text-sm break-all flex-1">
                {proxyUrl}
              </code>
              <CopyButton text={proxyUrl} />
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-2">
              /api/proxy/{submission.slug}
            </p>
          </div>

          {/* Metadata */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg divide-y divide-mpp-border">
            {submission.pricePerQuery !== null ? (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-muted-foreground">Price per query</span>
                <span className="font-mono text-sm text-mpp-amber">
                  {submission.pricePerQuery} USD
                </span>
              </div>
            ) : null}
            {submission.paymentAddress !== null ? (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-muted-foreground">Payment address</span>
                <span className="font-mono text-sm text-foreground">
                  {submission.paymentAddress.length > 14
                    ? submission.paymentAddress.slice(0, 8) + "..." + submission.paymentAddress.slice(-6)
                    : submission.paymentAddress}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="font-mono text-xs text-green-400 uppercase tracking-wide">
                {submission.status}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-muted-foreground">Verification</span>
              <span className="font-mono text-xs text-yellow-400 uppercase tracking-wide">
                Pending
              </span>
            </div>
          </div>

          {/* Token-saved confirmation */}
          <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tokenSaved}
                onChange={(e) => setTokenSaved(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-mpp-amber cursor-pointer"
              />
              <span className="text-sm text-foreground leading-relaxed">
                I've securely saved my management token
              </span>
            </label>
            {tokenSaved ? (
              <Link to="/manage" className="block mt-4">
                <button className="btn-amber w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded text-sm font-semibold">
                  <LayoutDashboard className="w-4 h-4" />
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Confirm you've saved the token to continue to the dashboard.
              </p>
            )}
          </div>

          {/* Secondary actions (always usable) */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/ecosystem">
              <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-mpp-border rounded px-5 py-2.5 transition-colors">
                <ExternalLink className="w-4 h-4" />
                View in Ecosystem
              </button>
            </Link>
            <Link to="/manage">
              <button className="inline-flex items-center gap-2 text-sm text-mpp-amber hover:text-mpp-amber/80 border border-mpp-amber/40 hover:border-mpp-amber/70 rounded px-5 py-2.5 transition-colors">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            You can update your endpoint URL, pricing, and other settings at any time from the{" "}
            <Link to="/manage" className="text-mpp-amber hover:underline">
              management dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

export function BuildSubmitForm() {
  const [form, setForm] = useState<FormState>(INITIAL);

  const mutation = useMutation({
    mutationFn: (payload: SubmitPayload) =>
      api.post<SubmissionCreatedResponse>("/api/submissions", payload),
  });

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const paymentAddressInvalid =
    form.paymentAddress.trim() !== "" &&
    !EVM_ADDRESS_REGEX.test(form.paymentAddress.trim());

  const solanaAddressInvalid =
    form.solanaAddress.trim() !== "" &&
    !SOLANA_ADDRESS_REGEX.test(form.solanaAddress.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (paymentAddressInvalid || solanaAddressInvalid) return;

    const payload: SubmitPayload = {
      name: form.name.trim(),
      shortDescription: form.shortDescription.trim(),
      category: form.category,
      websiteUrl: form.websiteUrl.trim(),
      endpointUrl: form.endpointUrl.trim(),
      pricePerQuery: parseFloat(form.pricePerQuery),
      paymentAddress: form.paymentAddress.trim(),
      creatorName: form.creatorName.trim(),
      creatorEmail: form.creatorEmail.trim(),
    };

    if (form.solanaAddress.trim()) payload.solanaAddress = form.solanaAddress.trim();
    if (form.fullDescription.trim()) payload.fullDescription = form.fullDescription.trim();
    if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim();
    if (form.twitterHandle.trim()) payload.twitterHandle = form.twitterHandle.trim();
    if (form.githubUrl.trim()) payload.githubUrl = form.githubUrl.trim();

    mutation.mutate(payload);
  }

  if (mutation.isSuccess && mutation.data) {
    return <SuccessState submission={mutation.data} />;
  }

  const slug = deriveSlug(form.name);

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;
  const isValidationError = apiError?.details?.code === "VALIDATION_ERROR";
  const fieldErrors = isValidationError ? fieldErrorMap(apiError?.details?.fields) : {};
  const topLevelErrorMessage = mutation.isError
    ? apiError?.details?.message ??
      (mutation.error instanceof Error ? mutation.error.message : "Submission failed. Please try again.")
    : null;

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
                <FieldError message={fieldErrors.name} />
                {form.name.trim() ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Your API will be accessible at:{" "}
                    <span className="font-mono text-mpp-amber/80">/api/proxy/{slug}</span>
                  </p>
                ) : null}
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
                <FieldError message={fieldErrors.shortDescription} />
              </div>

              <div>
                <Label>Category</Label>
                <CategoryCombobox
                  value={form.category}
                  onChange={(v) => set("category", v)}
                  placeholder="Select a category"
                />
                <FieldError message={fieldErrors.category} />
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
                <FieldError message={fieldErrors.websiteUrl} />
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
                  <FieldError message={fieldErrors.creatorName} />
                </div>
                <div>
                  <Label note="Private, not displayed publicly">
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
                  <FieldError message={fieldErrors.creatorEmail} />
                </div>
              </div>

              <div>
                <Label>Endpoint URL</Label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="url"
                      required
                      className={INPUT_CLASS}
                      placeholder="https://your-service.com/api/query"
                      value={form.endpointUrl}
                      onChange={(e) => set("endpointUrl", e.target.value)}
                    />
                  </div>
                  <div className="pt-0.5">
                    <EndpointTester endpointUrl={form.endpointUrl} />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Must be publicly reachable over HTTPS. We'll test it before listing.
                </p>
                <FieldError message={fieldErrors.endpointUrl} />
              </div>

              <div>
                <Label>Price per query (USD)</Label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step="0.001"
                  className={INPUT_CLASS}
                  placeholder="0.008"
                  value={form.pricePerQuery}
                  onChange={(e) => set("pricePerQuery", e.target.value)}
                />
                <FieldError message={fieldErrors.pricePerQuery} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Charged per request in USD. Callers pay via any of five supported protocols (Tempo, x402, AP2, ACP, AGTP). Typical range: 0.001 to 0.1.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label note="For Tempo, AP2, ACP, and AGTP payments">EVM Payment Address</Label>
                  <input
                    type="text"
                    required
                    className={INPUT_CLASS}
                    placeholder="0x..."
                    value={form.paymentAddress}
                    onChange={(e) => set("paymentAddress", e.target.value)}
                  />
                  {paymentAddressInvalid ? (
                    <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Must be 0x followed by 40 hex characters
                    </p>
                  ) : null}
                  <FieldError message={fieldErrors.paymentAddress} />
                </div>
                <div>
                  <Label note="Optional, for x402 USDC payments">Solana Address</Label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Your Solana wallet address"
                    value={form.solanaAddress}
                    onChange={(e) => set("solanaAddress", e.target.value)}
                  />
                  {solanaAddressInvalid ? (
                    <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Must be a valid Solana address (32-44 base58 characters)
                    </p>
                  ) : null}
                  <FieldError message={fieldErrors.solanaAddress} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Provide a Solana address to receive x402 protocol payments (USDC) directly to your wallet.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional fields */}
            <div className="pt-6 border-t border-mpp-border space-y-5">
              <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                Optional
              </p>

              <div>
                <Label>Logo URL</Label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="https://..."
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                />
                <FieldError message={fieldErrors.logoUrl} />
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
                  <FieldError message={fieldErrors.twitterHandle} />
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
                  <FieldError message={fieldErrors.githubUrl} />
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
                <FieldError message={fieldErrors.fullDescription} />
              </div>
            </div>

            {topLevelErrorMessage !== null ? (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded px-4 py-3">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{topLevelErrorMessage}</p>
                  {isValidationError && apiError?.details?.fields && apiError.details.fields.length > 0 ? (
                    <p className="text-xs text-red-400/80 mt-1">
                      Please correct the highlighted fields above.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={mutation.isPending || paymentAddressInvalid || solanaAddressInvalid}
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
