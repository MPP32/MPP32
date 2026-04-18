import { useState } from "react";

type Submitted = false | "success";

export default function Contact() {
  const [submitted, setSubmitted] = useState<Submitted>(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "Integration Help", message: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`[MPP32] ${form.subject}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\n\n${form.message}`
    );
    window.location.href = `mailto:hello@mpp32.org?subject=${subject}&body=${body}`;
    setSubmitted("success");
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
        {submitted === "success" ? (
          <div className="card-surface rounded p-8 text-center">
            <p className="text-mpp-success text-sm font-mono mb-2">Message sent.</p>
            <p className="text-muted-foreground text-sm">We'll be in touch within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <option>Press</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Message</label>
              <textarea name="message" required rows={5} value={form.message} onChange={handleChange} placeholder="Tell us what you're working on..." className={`${inputClass} resize-none`} />
            </div>
            <button type="submit" className="btn-amber w-full py-2.5 rounded text-sm font-semibold">
              Send Message
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-mpp-border">
          <p className="text-muted-foreground text-xs">Or email us directly at{" "}
            <a href="mailto:hello@mpp32.org" className="text-foreground hover:text-mpp-amber transition-colors">
              hello@mpp32.org
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
