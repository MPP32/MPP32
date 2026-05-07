import { useState } from "react";
import { api } from "@/lib/api";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function Contact() {
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ name: "", email: "", subject: "Integration Help", message: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    try {
      await api.post("/api/contact", form);
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  const inputClass = "w-full bg-mpp-card border border-mpp-border rounded px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm";

  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Contact</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Get in touch.</h1>
          <p className="text-muted-foreground text-base">
            Questions about integration, volume pricing, or the protocol? We respond within 24 hours.
          </p>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {state === "success" ? (
          <div className="card-surface rounded p-8 text-center">
            <p className="text-mpp-success text-sm font-mono mb-2">Message sent.</p>
            <p className="text-muted-foreground text-sm">We'll be in touch within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {state === "error" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
              <input name="name" required value={form.name} onChange={handleChange} placeholder="Your name" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Subject</label>
              <select name="subject" value={form.subject} onChange={handleChange} className={inputClass}>
                <option>Integration Help</option>
                <option>Volume Pricing</option>
                <option>Partnership</option>
                <option>Bug Report</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Message</label>
              <textarea name="message" required rows={5} value={form.message} onChange={handleChange} placeholder="Tell us what you're working on..." className={`${inputClass} resize-none`} />
            </div>
            <button
              type="submit"
              disabled={state === "submitting"}
              className="btn-amber w-full py-2.5 rounded text-sm font-semibold disabled:opacity-50"
            >
              {state === "submitting" ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-mpp-border">
          <div className="card-surface rounded p-5 flex items-start gap-4">
            <svg className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <div>
              <p className="text-foreground font-semibold text-sm mb-1">Join us on X</p>
              <p className="text-muted-foreground text-sm mb-3">
                For faster responses, join the MPP32 group chat on X.
              </p>
              <a
                href="https://x.com/i/chat/group_join/g2047614770204074254/IHJ4Eq3H1L"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity"
              >
                Join the group chat
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
