function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Effective date: January 1, 2025</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Section title="1. Data We Collect">
          <p>MPP32 collects minimal data. Because the service uses wallet-based authentication via the Machine Payments Protocol, we do not collect email addresses, names, or other personal identifiers.</p>
          <p>We collect: (a) API request logs including IP address, timestamp, token queried, and response time; (b) on-chain transaction data associated with payments made to our payment address, which is inherently public on Ethereum L2; (c) standard server-side request metadata.</p>
        </Section>

        <Section title="2. How We Use Data">
          <p>Request logs are used to: operate and improve the service, enforce rate limits, detect abuse and denial-of-service patterns, and generate aggregated usage analytics. We do not sell or share request logs with third parties except as required by law.</p>
          <p>On-chain payment data is public by nature of the blockchain and outside our control to restrict.</p>
        </Section>

        <Section title="3. Data Retention">
          <p>Request logs are retained for 90 days and then deleted. Aggregated analytics data (no IP addresses or identifying information) may be retained indefinitely.</p>
        </Section>

        <Section title="4. Cookies and Local Storage">
          <p>We do not use tracking cookies. The playground interface stores query history in your browser's localStorage under the key mpp32_queries. This data never leaves your device and can be cleared at any time by clearing your browser's local storage.</p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>The service retrieves data from DexScreener and Jupiter Price API. Your token queries are forwarded to these services as part of data retrieval. Their respective privacy policies apply to those requests.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Because we do not collect personal identifiers, most data subject rights (access, rectification, deletion) cannot be exercised in a meaningful way. IP address logs are deleted after 90 days automatically.</p>
          <p>For any privacy questions, contact hello@mpp32.org.</p>
        </Section>

        <Section title="7. Changes">
          <p>We may update this policy from time to time. The effective date at the top of this page will be updated on any material changes.</p>
        </Section>
      </div>
    </div>
  );
}
