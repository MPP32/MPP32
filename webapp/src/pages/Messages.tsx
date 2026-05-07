import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface ContactMsg {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

async function fetchMessages(key: string): Promise<ContactMsg[]> {
  const res = await fetch(`${API_BASE}/api/contact`, {
    headers: { "x-admin-key": key },
  });
  if (!res.ok) throw new Error("Invalid admin key");
  const json = await res.json();
  return json.data;
}

function LoginGate({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetchMessages(key);
      localStorage.setItem("mpp32_admin_key", key);
      onAuth(key);
    } catch {
      setError("Invalid key. Check your MPP_SECRET_KEY in the ENV tab.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <div className="card-surface rounded p-8">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Admin Access</p>
        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">View Messages</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Enter your admin key to view contact form submissions. You can find this in your ENV tab as <code className="font-mono text-xs text-mpp-amber">MPP_SECRET_KEY</code>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-2 text-red-400 text-sm">{error}</div>
          ) : null}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your MPP_SECRET_KEY"
            className="w-full bg-mpp-bg border border-mpp-border rounded px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm font-mono"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-amber w-full py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Checking..." : "View Messages"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageList({ adminKey }: { adminKey: string }) {
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["contact-messages", adminKey],
    queryFn: () => fetchMessages(adminKey),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto mt-12 px-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-surface rounded p-5 animate-pulse">
              <div className="h-4 bg-mpp-border rounded w-1/3 mb-3" />
              <div className="h-3 bg-mpp-border rounded w-full mb-2" />
              <div className="h-3 bg-mpp-border rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-12 px-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-red-400 text-sm">
          Failed to load messages. Your key may have changed.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground text-sm">
          {messages?.length ?? 0} message{messages?.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => {
            localStorage.removeItem("mpp32_admin_key");
            window.location.reload();
          }}
          className="text-muted-foreground hover:text-foreground text-xs font-mono transition-colors"
        >
          Sign out
        </button>
      </div>

      {messages?.length === 0 ? (
        <div className="card-surface rounded p-8 text-center">
          <p className="text-muted-foreground text-sm">No messages yet. They'll appear here when someone uses the contact form.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages?.map((msg) => (
            <div key={msg.id} className="card-surface rounded p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                <div>
                  <span className="text-foreground font-semibold text-sm">{msg.name}</span>
                  <span className="text-muted-foreground text-xs ml-2">{msg.email}</span>
                </div>
                <span className="text-muted-foreground text-xs font-mono">
                  {new Date(msg.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-mpp-amber text-xs font-mono mb-2">{msg.subject}</p>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Messages() {
  const [adminKey, setAdminKey] = useState<string>(
    () => localStorage.getItem("mpp32_admin_key") ?? ""
  );

  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Admin</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Contact Messages</h1>
          <p className="text-muted-foreground text-base">
            Messages submitted through the contact form on your site.
          </p>
        </div>
      </section>

      <div className="py-12">
        {adminKey ? (
          <MessageList adminKey={adminKey} />
        ) : (
          <LoginGate onAuth={setAdminKey} />
        )}
      </div>
    </div>
  );
}
