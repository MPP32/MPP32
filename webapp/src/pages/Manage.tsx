import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  LogOut,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Activity,
  DollarSign,
  Clock,
  Settings,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  Zap,
  Download,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type {
  ProviderStats,
  SubmissionResponse,
  UpdateSubmission,
  ValidateEndpointResponse,
  VerifyEndpointResponse,
} from "../../../backend/src/types";
import type { ApiErrorDetails, ApiFieldError } from "@/lib/api";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const SLUG_KEY = "mpp32_manage_slug";
const TOKEN_KEY = "mpp32_manage_token";

type AuthState = {
  slug: string;
  token: string;
};

const INPUT_CLASS =
  "w-full bg-mpp-card border border-mpp-border rounded px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm";

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ─── Auth helpers ────────────────────────────────────────────────────────────

function getStoredAuth(): AuthState | null {
  const slug = localStorage.getItem(SLUG_KEY);
  const token = localStorage.getItem(TOKEN_KEY);
  if (slug && token) return { slug, token };
  return null;
}

function storeAuth(slug: string, token: string) {
  localStorage.setItem(SLUG_KEY, slug);
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAuth() {
  localStorage.removeItem(SLUG_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// ─── API helpers using fetch directly for auth header support ─────────────────

type FetchError = Error & { status: number; details?: ApiErrorDetails };

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const message = json?.error?.message || json?.message || `Request failed with status ${res.status}`;
    const err = new Error(message) as FetchError;
    err.status = res.status;
    const errorObj = json?.error;
    if (errorObj && typeof errorObj === "object" && typeof errorObj.message === "string") {
      err.details = {
        message: errorObj.message,
        code: typeof errorObj.code === "string" ? errorObj.code : undefined,
        fields: Array.isArray(errorObj.fields)
          ? errorObj.fields.filter(
              (f: unknown): f is ApiFieldError =>
                typeof f === "object" &&
                f !== null &&
                typeof (f as ApiFieldError).path === "string" &&
                typeof (f as ApiFieldError).message === "string"
            )
          : undefined,
      };
    }
    throw err;
  }

  const json = await res.json();
  return json.data as T;
}

function getErrorDetails(err: unknown): ApiErrorDetails | undefined {
  if (err !== null && typeof err === "object" && "details" in err) {
    const d = (err as { details?: unknown }).details;
    if (d !== null && typeof d === "object" && typeof (d as ApiErrorDetails).message === "string") {
      return d as ApiErrorDetails;
    }
  }
  return undefined;
}

function fieldErrorMap(fields?: ApiFieldError[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!fields) return map;
  for (const f of fields) {
    if (!(f.path in map)) map[f.path] = f.message;
  }
  return map;
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

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
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
          Copy
        </>
      )}
    </button>
  );
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

// ─── Recover Token Dialog ─────────────────────────────────────────────────────

type DialogStep =
  | { step: "email"; loading?: boolean; error?: string }
  | { step: "code"; slug: string; email: string; loading?: boolean; error?: string }
  | { step: "success"; slug: string; managementToken: string };

function RecoverTokenDialog({
  open,
  onOpenChange,
  initialSlug,
  onRecovered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSlug: string;
  onRecovered: (slug: string, token: string) => void;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [dialogStep, setDialogStep] = useState<DialogStep>({ step: "email" });
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug(initialSlug);
      setEmail("");
      setCode("");
      setDialogStep({ step: "email" });
      setTokenVisible(false);
      setCopied(false);
    }
  }, [open, initialSlug]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanEmail = email.trim();
    if (!cleanSlug || !cleanEmail) return;

    setDialogStep({ step: "email", loading: true });
    try {
      const res = await fetch(
        `${API_BASE}/api/submissions/${cleanSlug}/request-recovery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorEmail: cleanEmail }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        if (res.status === 403) {
          setDialogStep({
            step: "email",
            error: "Email doesn't match the registered owner of this slug.",
          });
          return;
        }
        if (res.status === 404) {
          setDialogStep({
            step: "email",
            error: "No API found with that slug.",
          });
          return;
        }
        const json = await res.json().catch(() => null);
        const message =
          json?.error?.message ?? `Request failed (status ${res.status}).`;
        setDialogStep({ step: "email", error: message });
        return;
      }

      setCode("");
      setDialogStep({ step: "code", slug: cleanSlug, email: cleanEmail });
    } catch {
      setDialogStep({
        step: "email",
        error: "Could not connect. Please try again.",
      });
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dialogStep.step !== "code") return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const { slug: stepSlug, email: stepEmail } = dialogStep;
    setDialogStep({ step: "code", slug: stepSlug, email: stepEmail, loading: true });
    try {
      const res = await fetch(
        `${API_BASE}/api/submissions/${stepSlug}/recover-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: cleanCode }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const errorCode = json?.error?.code;
        const message =
          errorCode === "INVALID_CODE"
            ? "Invalid or expired code. Please check your email and try again."
            : json?.error?.message ?? `Verification failed (status ${res.status}).`;
        setDialogStep({ step: "code", slug: stepSlug, email: stepEmail, error: message });
        return;
      }

      const json = await res.json();
      const payload = json.data as { managementToken: string; slug: string };
      setDialogStep({
        step: "success",
        slug: payload.slug,
        managementToken: payload.managementToken,
      });
    } catch {
      setDialogStep({
        step: "code",
        slug: stepSlug,
        email: stepEmail,
        error: "Could not connect. Please try again.",
      });
    }
  }

  function handleCopyToken() {
    if (dialogStep.step !== "success") return;
    navigator.clipboard.writeText(dialogStep.managementToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (dialogStep.step !== "success") return;
    const content = [
      "MPP32 Provider Management Credentials (Recovered)",
      "==================================================",
      "",
      `Slug:              ${dialogStep.slug}`,
      `Management Token:  ${dialogStep.managementToken}`,
      "",
      "IMPORTANT: Keep this file safe. The management token cannot be recovered again",
      "without verifying your creator email.",
      "Use it at https://mpp32.org/manage to update or deprecate your API.",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpp32-${dialogStep.slug}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUseToken() {
    if (dialogStep.step !== "success") return;
    onRecovered(dialogStep.slug, dialogStep.managementToken);
    onOpenChange(false);
  }

  const maskedToken =
    dialogStep.step === "success"
      ? dialogStep.managementToken.slice(0, 8) +
        "•".repeat(24) +
        dialogStep.managementToken.slice(-8)
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-mpp-card border-mpp-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display">
            Recover your management token
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            We'll issue a new token tied to the creator email you registered
            with. Your old token will be immediately invalidated.
          </DialogDescription>
        </DialogHeader>

        {dialogStep.step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
                Slug
              </label>
              <input
                type="text"
                required
                className={INPUT_CLASS}
                placeholder="my-token-scanner"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
                Creator Email
              </label>
              <input
                type="email"
                required
                className={INPUT_CLASS}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {dialogStep.error !== undefined ? (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded px-4 py-3">
                <XCircle className="w-4 h-4 shrink-0" />
                {dialogStep.error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={dialogStep.loading === true}
              className="btn-amber w-full flex items-center justify-center gap-2 text-sm px-6 py-2.5 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dialogStep.loading === true ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Send Verification Code</>
              )}
            </button>
          </form>
        ) : dialogStep.step === "code" ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check your email. We sent a 6-digit code to{" "}
              <span className="text-foreground font-medium">{dialogStep.email}</span>
            </p>

            <div>
              <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                className={INPUT_CLASS}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>

            {dialogStep.error !== undefined ? (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded px-4 py-3">
                <XCircle className="w-4 h-4 shrink-0" />
                {dialogStep.error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={dialogStep.loading === true}
              className="btn-amber w-full flex items-center justify-center gap-2 text-sm px-6 py-2.5 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dialogStep.loading === true ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Verify &amp; Get New Token</>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setDialogStep({ step: "email" })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong className="text-amber-200">Save this token now.</strong>{" "}
                It will only be shown once. Your old token has been invalidated.
              </p>
            </div>

            <div>
              <p className="font-mono text-xs text-mpp-amber uppercase tracking-widest mb-2">
                New Management Token
              </p>
              <code className="font-mono text-sm text-mpp-amber break-all block bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2 leading-relaxed">
                {tokenVisible ? dialogStep.managementToken : maskedToken}
              </code>
            </div>

            <button
              onClick={handleDownload}
              className="btn-amber w-full inline-flex items-center justify-center gap-2 text-sm px-6 py-3 rounded font-semibold"
            >
              <Download className="w-4 h-4" />
              Download Credentials
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setTokenVisible((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-1.5 transition-colors"
              >
                {tokenVisible ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {tokenVisible ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={handleCopyToken}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Token
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleUseToken}
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-mpp-amber border border-mpp-amber/40 hover:border-mpp-amber/70 rounded px-6 py-2.5 transition-colors"
            >
              Use this token to log in
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuthGate({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const [slug, setSlug] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanSlug = slug.trim().toLowerCase();
    const cleanToken = token.trim();

    try {
      await fetchWithAuth<ProviderStats>(`/api/submissions/${cleanSlug}/stats`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });
      storeAuth(cleanSlug, cleanToken);
      onAuth({ slug: cleanSlug, token: cleanToken });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401 || e.status === 404) {
        setError("Invalid slug or management token. Double-check both and try again.");
      } else {
        setError("Could not connect. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRecovered(recoveredSlug: string, recoveredToken: string) {
    setSlug(recoveredSlug);
    setToken(recoveredToken);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-mpp-bg px-4 py-8 sm:py-12">
      <div className="max-w-md mx-auto mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground hover:text-mpp-amber transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>
      </div>
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
            Provider Portal
          </p>
          <h1 className="font-display text-3xl font-semibold text-foreground mb-2">
            Manage Your API
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your credentials to access the management dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
              Slug
            </label>
            <input
              type="text"
              required
              className={INPUT_CLASS}
              placeholder="my-token-scanner"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
              Management Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                required
                className={INPUT_CLASS + " pr-10"}
                placeholder="Your 64-char management token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error !== null ? (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded px-4 py-3">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-amber w-full flex items-center justify-center gap-2 text-sm px-6 py-2.5 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Access Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setRecoverOpen(true)}
              className="text-xs text-mpp-amber hover:underline"
            >
              Forgot your token?
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your slug and management token were provided when you submitted your API.
          </p>
        </form>

        <RecoverTokenDialog
          open={recoverOpen}
          onOpenChange={setRecoverOpen}
          initialSlug={slug}
          onRecovered={handleRecovered}
        />
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className={cn("font-display text-2xl font-semibold", valueClassName ?? "text-foreground")}>{value}</p>
      {sub !== undefined ? (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      ) : null}
    </div>
  );
}

// ─── Edit Settings form ───────────────────────────────────────────────────────

type EditFormState = {
  endpointUrl: string;
  pricePerQuery: string;
  paymentAddress: string;
  solanaAddress: string;
  shortDescription: string;
  fullDescription: string;
  logoUrl: string;
  websiteUrl: string;
  twitterHandle: string;
  githubUrl: string;
};

function buildInitialForm(submission: SubmissionResponse): EditFormState {
  return {
    endpointUrl: submission.endpointUrl ?? "",
    pricePerQuery: submission.pricePerQuery !== null ? String(submission.pricePerQuery) : "",
    paymentAddress: submission.paymentAddress ?? "",
    solanaAddress: submission.solanaAddress ?? "",
    shortDescription: submission.shortDescription,
    fullDescription: submission.fullDescription ?? "",
    logoUrl: submission.logoUrl ?? "",
    websiteUrl: submission.websiteUrl,
    twitterHandle: submission.twitterHandle ?? "",
    githubUrl: submission.githubUrl ?? "",
  };
}

function EditSettings({
  auth,
  submission,
  queryClient,
}: {
  auth: AuthState;
  submission: SubmissionResponse;
  queryClient: QueryClient;
}) {
  const [form, setForm] = useState<EditFormState>(() => buildInitialForm(submission));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const { toast } = useToast();

  // FIX 3: Re-sync form state when submission prop updates (e.g. after invalidation)
  useEffect(() => {
    setForm(buildInitialForm(submission));
  }, [submission]);

  function set(field: keyof EditFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  const originalEndpointUrl = submission.endpointUrl ?? "";
  const originalPaymentAddress = submission.paymentAddress ?? "";

  const endpointChanged = form.endpointUrl.trim() !== originalEndpointUrl.trim();
  const paymentChanged = form.paymentAddress.trim() !== originalPaymentAddress.trim();

  // Dirty detection — form differs from submission
  const isDirty = useMemo(() => {
    const baseline = buildInitialForm(submission);
    return (Object.keys(baseline) as (keyof EditFormState)[]).some(
      (k) => baseline[k] !== form[k]
    );
  }, [submission, form]);

  // FIX 9: beforeunload warning when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const paymentAddressInvalid =
    form.paymentAddress.trim() !== "" && !EVM_ADDRESS_REGEX.test(form.paymentAddress.trim());

  const solanaAddressInvalid =
    form.solanaAddress.trim() !== "" && !SOLANA_ADDRESS_REGEX.test(form.solanaAddress.trim());

  const mutation = useMutation({
    mutationFn: (payload: UpdateSubmission) =>
      fetchWithAuth<SubmissionResponse>(`/api/submissions/${auth.slug}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${auth.token}` },
      }),
    onSuccess: () => {
      // FIX 2: Invalidate caches so Overview and form reflect latest
      queryClient.invalidateQueries({ queryKey: ["submission", auth.slug] });
      queryClient.invalidateQueries({ queryKey: ["provider-stats", auth.slug] });
      setFieldErrors({});
      setTopLevelError(null);
      toast({ title: "Settings saved", description: "Your API settings have been updated." });
    },
    onError: (err: Error) => {
      const details = getErrorDetails(err);
      const friendlyMessage = details?.message ?? err.message;
      if (details?.code === "VALIDATION_ERROR" && details.fields && details.fields.length > 0) {
        setFieldErrors(fieldErrorMap(details.fields));
      } else {
        setFieldErrors({});
      }
      setTopLevelError(friendlyMessage);
      toast({
        title: "Save failed",
        description: friendlyMessage,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (paymentAddressInvalid) {
      toast({
        title: "Invalid payment address",
        description: "Must be 0x followed by 40 hex characters.",
        variant: "destructive",
      });
      return;
    }
    if (solanaAddressInvalid) {
      toast({
        title: "Invalid Solana address",
        description: "Must be a valid Solana address (32-44 base58 characters).",
        variant: "destructive",
      });
      return;
    }
    const payload: UpdateSubmission = {};
    if (form.endpointUrl.trim()) payload.endpointUrl = form.endpointUrl.trim();
    if (form.pricePerQuery.trim()) payload.pricePerQuery = parseFloat(form.pricePerQuery);
    if (form.paymentAddress.trim()) payload.paymentAddress = form.paymentAddress.trim();
    payload.solanaAddress = form.solanaAddress.trim() || "";
    if (form.shortDescription.trim()) payload.shortDescription = form.shortDescription.trim();
    if (form.fullDescription.trim()) payload.fullDescription = form.fullDescription.trim();
    if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim();
    if (form.websiteUrl.trim()) payload.websiteUrl = form.websiteUrl.trim();
    if (form.twitterHandle.trim()) payload.twitterHandle = form.twitterHandle.trim();
    if (form.githubUrl.trim()) payload.githubUrl = form.githubUrl.trim();
    mutation.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
          Endpoint URL
        </label>
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder="https://your-service.com/api/query"
          value={form.endpointUrl}
          onChange={(e) => set("endpointUrl", e.target.value)}
        />
        <FieldError message={fieldErrors.endpointUrl} />
        {endpointChanged && originalEndpointUrl !== "" ? (
          <>
            <p className="mt-1.5 text-xs text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Changing this will affect all new requests immediately.
            </p>
            <p className="mt-1.5 text-xs text-amber-300 flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Changing your endpoint URL will reset verification. You will need to re-verify at the new URL.
            </p>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            Price per query (USD)
          </label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            className={INPUT_CLASS}
            placeholder="0.008"
            value={form.pricePerQuery}
            onChange={(e) => set("pricePerQuery", e.target.value)}
          />
          <FieldError message={fieldErrors.pricePerQuery} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Charged per request in USD. Callers pay via any of 5 supported protocols (Tempo, x402, AP2, ACP, AGTP). Typical range: 0.001 to 0.1.
          </p>
        </div>
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            EVM Payment Address
          </label>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="0x..."
            value={form.paymentAddress}
            onChange={(e) => set("paymentAddress", e.target.value)}
          />
          <FieldError message={fieldErrors.paymentAddress} />
          {paymentAddressInvalid ? (
            <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Must be 0x followed by 40 hex characters
            </p>
          ) : null}
          {paymentChanged && originalPaymentAddress !== "" && !paymentAddressInvalid ? (
            <p className="mt-1.5 text-xs text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Changing this will affect all new requests immediately.
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Receives payments via EVM-compatible protocols (Tempo, AP2, ACP, AGTP).
          </p>
        </div>
      </div>

      <div>
        <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
          Solana Address
          <span className="ml-2 text-muted-foreground normal-case tracking-normal font-sans">Optional, for x402 and Solana protocol payments</span>
        </label>
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder="Your Solana wallet address"
          value={form.solanaAddress}
          onChange={(e) => set("solanaAddress", e.target.value)}
        />
        <FieldError message={fieldErrors.solanaAddress} />
        {solanaAddressInvalid ? (
          <p className="mt-1.5 text-xs text-red-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Must be a valid Solana address (32-44 base58 characters)
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-muted-foreground">
          Provide a Solana address to receive x402 and other Solana-based payments directly to your wallet.
        </p>
      </div>

      <div>
        <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
          Short Description
        </label>
        <textarea
          rows={2}
          maxLength={200}
          className={INPUT_CLASS + " resize-none"}
          value={form.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
        />
        <FieldError message={fieldErrors.shortDescription} />
      </div>

      <div>
        <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
          Full Description
        </label>
        <textarea
          rows={4}
          className={INPUT_CLASS + " resize-none"}
          value={form.fullDescription}
          onChange={(e) => set("fullDescription", e.target.value)}
        />
        <FieldError message={fieldErrors.fullDescription} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            Website URL
          </label>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="https://your-site.com"
            value={form.websiteUrl}
            onChange={(e) => set("websiteUrl", e.target.value)}
          />
          <FieldError message={fieldErrors.websiteUrl} />
        </div>
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            Logo URL
          </label>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="https://..."
            value={form.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
          />
          <FieldError message={fieldErrors.logoUrl} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            Twitter Handle
          </label>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="yourhandle"
            value={form.twitterHandle}
            onChange={(e) => set("twitterHandle", e.target.value)}
          />
          <FieldError message={fieldErrors.twitterHandle} />
        </div>
        <div>
          <label className="block mb-1.5 font-mono text-xs text-foreground uppercase tracking-wide">
            GitHub URL
          </label>
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

      {topLevelError !== null ? (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded px-4 py-3">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{topLevelError}</p>
            {Object.keys(fieldErrors).length > 0 ? (
              <p className="text-xs text-red-400/80 mt-1">
                Please correct the highlighted fields above.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={mutation.isPending || paymentAddressInvalid}
          className="btn-amber flex items-center gap-2 text-sm px-6 py-2.5 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Save Changes
              <CheckCircle className="w-4 h-4" />
            </>
          )}
        </button>
        {isDirty ? (
          <span className="text-xs text-amber-300 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full" />
            Unsaved changes
          </span>
        ) : null}
      </div>
    </form>
  );
}

// ─── Endpoint Tester (live test in Overview) ─────────────────────────────────

type EndpointTestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; statusCode: number | null; responseTimeMs: number }
  | { status: "error"; message: string };

function OverviewEndpointTester({ endpointUrl }: { endpointUrl: string }) {
  const [testState, setTestState] = useState<EndpointTestState>({ status: "idle" });

  async function handleTest() {
    if (!endpointUrl.trim()) return;
    setTestState({ status: "loading" });
    try {
      const res = await fetch(`${API_BASE}/api/submissions/validate-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: endpointUrl.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        setTestState({ status: "error", message: `Request failed (${res.status})` });
        return;
      }
      const json = await res.json();
      const result = json.data as ValidateEndpointResponse;
      if (result.reachable && result.responseTimeMs !== null) {
        setTestState({
          status: "ok",
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
        });
      } else {
        setTestState({
          status: "error",
          message: result.error ?? "Endpoint not reachable",
        });
      }
    } catch {
      setTestState({ status: "error", message: "Could not reach endpoint" });
    }
  }

  return (
    <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
        Test Your Endpoint
      </p>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Verify your endpoint is reachable from our servers.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState.status === "loading"}
          className="inline-flex items-center gap-2 text-sm border border-mpp-border hover:border-mpp-amber/40 text-foreground rounded px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {testState.status === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-mpp-amber" />
          )}
          Run Test
        </button>
        {testState.status === "ok" ? (
          <span className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Reachable
            {testState.statusCode !== null ? ` (${testState.statusCode} · ${testState.responseTimeMs}ms)` : ` (${testState.responseTimeMs}ms)`}
          </span>
        ) : testState.status === "error" ? (
          <span className="text-xs text-red-400 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            {testState.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Verification Card ───────────────────────────────────────────────────────

type VerificationDetails = {
  verificationToken: string;
  isVerified: boolean;
  verifyFailCount: number;
  lastVerifiedAt: string | null;
};

function VerificationCard({ auth, submission }: { auth: AuthState; submission: SubmissionResponse }) {
  const [details, setDetails] = useState<VerificationDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDetailsLoading(true);
    setDetailsError(null);
    fetchWithAuth<VerificationDetails>(`/api/submissions/${auth.slug}/verification`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((data) => {
        setDetails(data);
        setDetailsLoading(false);
      })
      .catch((err: Error) => {
        setDetailsError(err.message);
        setDetailsLoading(false);
      });
  }, [auth.slug, auth.token]);

  async function handleVerify() {
    setVerifyState("loading");
    setVerifyMessage(null);
    try {
      const result = await fetchWithAuth<VerifyEndpointResponse>(
        `/api/submissions/${auth.slug}/verify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}` },
        }
      );
      if (result.verified) {
        setVerifyState("success");
        setVerifyMessage("Endpoint verified successfully. Proxy traffic is active.");
        queryClient.invalidateQueries({ queryKey: ["submission", auth.slug] });
        // Refresh verification details
        fetchWithAuth<VerificationDetails>(`/api/submissions/${auth.slug}/verification`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        }).then(setDetails).catch(() => {});
      } else {
        setVerifyState("error");
        setVerifyMessage(result.error ?? "Verification failed. Check that your endpoint returns the correct token.");
      }
    } catch (err) {
      setVerifyState("error");
      setVerifyMessage(err instanceof Error ? err.message : "Verification request failed.");
    }
  }

  const endpointOrigin = submission.endpointUrl
    ? (() => { try { return new URL(submission.endpointUrl).origin; } catch { return ""; } })()
    : "";
  const wellKnownUrl = endpointOrigin ? `${endpointOrigin}/.well-known/mpp32-verify` : "";
  const isSuspended = (details?.verifyFailCount ?? 0) >= 3 && !submission.isVerified;

  if (detailsLoading) {
    return (
      <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading verification status...
        </div>
      </div>
    );
  }

  if (detailsError !== null) {
    return (
      <div className="bg-mpp-card border border-mpp-border rounded-lg p-5">
        <p className="text-xs text-muted-foreground">Verification details unavailable.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-mpp-card border rounded-lg overflow-hidden",
      isSuspended ? "border-red-500/30" : submission.isVerified ? "border-green-500/30" : "border-blue-500/30"
    )}>
      <div className={cn(
        "px-5 py-3 border-b",
        isSuspended
          ? "border-red-500/20 bg-red-500/5"
          : submission.isVerified
          ? "border-green-500/20 bg-green-500/5"
          : "border-blue-500/20 bg-blue-500/5"
      )}>
        <p className={cn(
          "font-mono text-xs uppercase tracking-widest flex items-center gap-2",
          isSuspended ? "text-red-400" : submission.isVerified ? "text-green-400" : "text-blue-400"
        )}>
          {submission.isVerified ? (
            <ShieldCheck className="w-3.5 h-3.5" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5" />
          )}
          Endpoint Verification
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Status:</span>
          {submission.isVerified ? (
            <span className="text-xs text-green-400 font-mono uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Verified
            </span>
          ) : isSuspended ? (
            <span className="text-xs text-red-400 font-mono uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Suspended
            </span>
          ) : (
            <span className="text-xs text-yellow-400 font-mono uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              Unverified
            </span>
          )}
        </div>

        {/* Suspension warning */}
        {isSuspended ? (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">
              Proxy traffic suspended. Re-verify to restore.
            </p>
          </div>
        ) : null}

        {/* Last verified */}
        {submission.isVerified && details?.lastVerifiedAt ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Last verified:</span>
            <span className="text-xs text-foreground font-mono">
              {new Date(details.lastVerifiedAt).toLocaleString()}
            </span>
          </div>
        ) : null}

        {/* Verification token */}
        {details?.verificationToken ? (
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
              Verification Token
            </p>
            <div className="flex items-center gap-3">
              <code className="font-mono text-sm text-blue-400 break-all flex-1 bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
                {details.verificationToken}
              </code>
              <CopyButton text={details.verificationToken} />
            </div>
          </div>
        ) : null}

        {/* Expected URL */}
        {wellKnownUrl ? (
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
              Expected URL
            </p>
            <div className="flex items-center gap-3">
              <code className="font-mono text-xs text-foreground break-all flex-1 bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
                {wellKnownUrl}
              </code>
              <CopyButton text={wellKnownUrl} />
            </div>
          </div>
        ) : null}

        {/* Verify Now button */}
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifyState === "loading"}
          className="inline-flex items-center gap-2 text-sm border border-blue-500/40 hover:border-blue-500/70 text-blue-400 hover:bg-blue-500/5 rounded px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {verifyState === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          Verify Now
        </button>

        {/* Verify feedback */}
        {verifyState === "success" && verifyMessage !== null ? (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            {verifyMessage}
          </p>
        ) : verifyState === "error" && verifyMessage !== null ? (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            {verifyMessage}
          </p>
        ) : null}

        {/* Code example */}
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
            Example (Express.js)
          </p>
          <div className="bg-[#0d0d0d] border border-mpp-border rounded px-3 py-2">
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`app.get('/.well-known/mpp32-verify', (req, res) => res.send('${details?.verificationToken ?? "<your-token>"}'))`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type DashboardTab = "overview" | "settings" | "danger";

function Dashboard({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const [tab, setTab] = useState<DashboardTab>("overview");
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["provider-stats", auth.slug],
    queryFn: () =>
      fetchWithAuth<ProviderStats>(`/api/submissions/${auth.slug}/stats`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const submissionQuery = useQuery({
    queryKey: ["submission", auth.slug],
    queryFn: () =>
      fetchWithAuth<SubmissionResponse>(`/api/submissions/${auth.slug}`),
  });

  const deprecateMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<void>(`/api/submissions/${auth.slug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      }),
    onSuccess: () => {
      toast({ title: "API deprecated", description: "Your API has been removed from the ecosystem." });
      clearAuth();
      queryClient.clear();
      navigate("/build");
    },
    onError: (err: Error) => {
      toast({ title: "Deprecation failed", description: err.message, variant: "destructive" });
    },
  });

  const stats = statsQuery.data;
  const submission = submissionQuery.data;

  const proxyUrl =
    (import.meta.env.VITE_BACKEND_URL || window.location.origin) +
    "/api/proxy/" +
    auth.slug;

  const tabs: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "settings", label: "Edit Settings", icon: Settings },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* Page header */}
      <div className="border-b border-mpp-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground hover:text-mpp-amber transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-1">
                Provider Dashboard
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground truncate">
                {submission?.name ?? auth.slug}
              </h1>
              {submission !== undefined ? (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {(() => {
                    const isActive =
                      submission.status === "approved" ||
                      submission.status === "featured" ||
                      submission.status === "active";
                    return (
                      <span
                        className={cn(
                          "font-mono text-xs uppercase tracking-wide px-2 py-0.5 rounded border",
                          isActive
                            ? "text-green-400 border-green-500/30 bg-green-500/5"
                            : "text-yellow-400 border-yellow-500/30 bg-yellow-500/5"
                        )}
                      >
                        {submission.status}
                      </span>
                    );
                  })()}
                  {submission.isVerified ? (
                    <span className="font-mono text-xs uppercase tracking-wide px-2 py-0.5 rounded border text-green-400 border-green-500/30 bg-green-500/5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="font-mono text-xs uppercase tracking-wide px-2 py-0.5 rounded border text-yellow-400 border-yellow-500/30 bg-yellow-500/5 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Unverified
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">{auth.slug}</span>
                </div>
              ) : null}
            </div>
            <button
              onClick={onLogout}
              className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-mpp-border rounded px-3 py-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-mpp-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors",
                  tab === t.id
                    ? "border-mpp-amber text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Overview ── */}
        {tab === "overview" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-display text-lg font-semibold text-foreground">Overview</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="font-mono uppercase tracking-wide">Live · updates every 30s</span>
              </div>
            </div>

            {statsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading stats...
              </div>
            ) : statsQuery.isError ? (
              <p className="text-red-400 text-sm">Failed to load stats.</p>
            ) : stats !== undefined ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={Activity}
                    label="Total Queries"
                    value={stats.queryCount.toLocaleString()}
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Est. Revenue"
                    value={`${stats.estimatedRevenue.toFixed(4)} USD`}
                    sub={
                      stats.pricePerQuery !== null
                        ? `${stats.pricePerQuery} USD × ${stats.queryCount} queries`
                        : undefined
                    }
                  />
                  <StatCard
                    icon={Clock}
                    label="Last Active"
                    value={
                      stats.lastQueriedAt !== null
                        ? new Date(stats.lastQueriedAt).toLocaleDateString()
                        : "Never"
                    }
                    sub={
                      stats.lastQueriedAt !== null
                        ? new Date(stats.lastQueriedAt).toLocaleTimeString()
                        : undefined
                    }
                  />
                  {submission !== undefined ? (() => {
                    const createdDate = new Date(submission.createdAt);
                    const daysAgo = Math.max(
                      0,
                      Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
                    );
                    return (
                      <StatCard
                        icon={Calendar}
                        label="Created"
                        value={createdDate.toLocaleDateString()}
                        sub={daysAgo === 0 ? "Today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`}
                      />
                    );
                  })() : null}
                </div>

                {/* Enhanced analytics metrics */}
                {(stats.successRate !== undefined || stats.avgLatencyMs !== undefined || stats.requestsLast24h !== undefined || stats.requestsLast7d !== undefined || stats.errorCount !== undefined) ? (
                  <>
                    <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-2">
                      Performance Metrics
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stats.successRate !== undefined ? (
                        <StatCard
                          icon={CheckCircle}
                          label="Success Rate"
                          value={`${stats.successRate.toFixed(1)}%`}
                          valueClassName={
                            stats.successRate > 95
                              ? "text-green-400"
                              : stats.successRate > 80
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                          sub={
                            stats.successRate > 95
                              ? "Healthy"
                              : stats.successRate > 80
                              ? "Needs attention"
                              : "Critical"
                          }
                        />
                      ) : null}
                      {stats.avgLatencyMs !== undefined ? (
                        <StatCard
                          icon={Zap}
                          label="Avg Latency"
                          value={`${Math.round(stats.avgLatencyMs)} ms`}
                          sub={
                            stats.avgLatencyMs < 200
                              ? "Fast"
                              : stats.avgLatencyMs < 1000
                              ? "Moderate"
                              : "Slow"
                          }
                        />
                      ) : null}
                      {stats.errorCount !== undefined ? (
                        <StatCard
                          icon={XCircle}
                          label="Error Count"
                          value={stats.errorCount.toLocaleString()}
                          valueClassName={stats.errorCount > 0 ? "text-red-400" : "text-foreground"}
                          sub={stats.errorCount > 0 ? "Errors detected" : "No errors"}
                        />
                      ) : null}
                      {stats.requestsLast24h !== undefined ? (
                        <StatCard
                          icon={Activity}
                          label="Requests (24h)"
                          value={stats.requestsLast24h.toLocaleString()}
                        />
                      ) : null}
                      {stats.requestsLast7d !== undefined ? (
                        <StatCard
                          icon={Calendar}
                          label="Requests (7d)"
                          value={stats.requestsLast7d.toLocaleString()}
                        />
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

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
            </div>

            {/* Test Live Endpoint */}
            {submission !== undefined ? (
              submission.endpointUrl !== null && submission.endpointUrl !== "" ? (
                <OverviewEndpointTester endpointUrl={submission.endpointUrl} />
              ) : (
                <div className="bg-mpp-card border border-yellow-500/30 rounded-lg p-5 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground mb-1">No endpoint configured</p>
                    <p className="text-xs text-muted-foreground">
                      Add one in the Edit Settings tab to enable live testing.
                    </p>
                  </div>
                </div>
              )
            ) : null}

            {/* Quick info */}
            {submission !== undefined ? (
              <div className="bg-mpp-card border border-mpp-border rounded-lg divide-y divide-mpp-border">
                {submission.endpointUrl !== null ? (
                  <div className="flex items-center justify-between px-5 py-3 gap-4">
                    <span className="text-xs text-muted-foreground shrink-0">Endpoint</span>
                    <span className="font-mono text-xs text-foreground truncate text-right">
                      {submission.endpointUrl}
                    </span>
                  </div>
                ) : null}
                {submission.pricePerQuery !== null ? (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs text-muted-foreground">Price per query</span>
                    <span className="font-mono text-sm text-mpp-amber">
                      {submission.pricePerQuery} USD
                    </span>
                  </div>
                ) : null}
                {submission.paymentAddress !== null ? (
                  <div className="flex items-center justify-between px-5 py-3 gap-4">
                    <span className="text-xs text-muted-foreground shrink-0">Payment address</span>
                    <span className="font-mono text-xs text-foreground truncate text-right">
                      {submission.paymentAddress}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Verification */}
            {submission !== undefined ? (
              <VerificationCard auth={auth} submission={submission} />
            ) : null}
          </div>
        ) : null}

        {/* ── Edit Settings ── */}
        {tab === "settings" ? (
          submissionQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading settings...
            </div>
          ) : submission !== undefined ? (
            <EditSettings auth={auth} submission={submission} queryClient={queryClient} />
          ) : (
            <p className="text-red-400 text-sm">Failed to load settings.</p>
          )
        ) : null}

        {/* ── Danger Zone ── */}
        {tab === "danger" ? (
          <div className="space-y-6">
            <div className="bg-mpp-card border border-red-500/30 rounded-lg p-6">
              <h2 className="font-display text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                Deprecate API
              </h2>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                This will remove your API from the ecosystem. Users won't be able to query it anymore. This cannot be undone.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex items-center gap-2 text-sm text-red-400 border border-red-500/40 hover:border-red-500/70 hover:bg-red-500/5 rounded px-5 py-2.5 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Deprecate API
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-mpp-card border-mpp-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                      Deprecate this API?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      This will remove your API from the ecosystem. Users won't be able to query it anymore. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-mpp-border text-foreground hover:bg-mpp-surface">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deprecateMutation.mutate()}
                      disabled={deprecateMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white border-0"
                    >
                      {deprecateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Yes, deprecate"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function Manage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [autoCheckDone, setAutoCheckDone] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored === null) {
      setAutoCheckDone(true);
      return;
    }

    // Verify stored credentials by fetching stats
    fetchWithAuth<ProviderStats>(`/api/submissions/${stored.slug}/stats`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then(() => {
        setAuth(stored);
        setAutoCheckDone(true);
      })
      .catch(() => {
        clearAuth();
        setAutoCheckDone(true);
      });
  }, []);

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  if (!autoCheckDone) {
    return (
      <div className="min-h-screen bg-mpp-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (auth === null) {
    return <AuthGate onAuth={setAuth} />;
  }

  return <Dashboard auth={auth} onLogout={handleLogout} />;
}
