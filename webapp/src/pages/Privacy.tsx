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
          <p className="text-muted-foreground text-sm">Effective date: April 18, 2026</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Section title="1. Data We Collect">
          <p>MPP32 collects the following categories of data:</p>
          <p><strong className="text-foreground">API usage data:</strong> IP address, timestamp, token queried, and response time for each request to the intelligence API. This applies to all users of the paid and demo endpoints.</p>
          <p><strong className="text-foreground">Provider registration data:</strong> If you register a service via the Build page, we collect your name, email address, service name, description, endpoint URL, payment address, and optional social links. Your email address is stored to enable management token recovery and is never displayed publicly. This is the only form of personal data we collect from users.</p>
          <p><strong className="text-foreground">On-chain payment data:</strong> Payments made via the Machine Payments Protocol are recorded on-chain (Ethereum L2) and are inherently public. MPP32 does not control, hold, or have access to user private keys or wallet credentials.</p>
          <p><strong className="text-foreground">Standard server metadata:</strong> HTTP headers, referrer URLs, and request metadata processed during normal server operation.</p>
        </Section>

        <Section title="2. How We Use Data">
          <p>API request logs are used to: operate and improve the service, enforce rate limits, detect abuse and denial-of-service patterns, and generate aggregated usage analytics.</p>
          <p>Provider registration data (including email) is used solely to: authenticate management token recovery requests, send service-related operational notices, and detect abuse of the provider submission system. We do not use provider emails for marketing purposes.</p>
          <p>We do not sell or share personal data with third parties except as required by law.</p>
        </Section>

        <Section title="3. Data Retention">
          <p>API request logs (including IP addresses) are retained for 90 days and then automatically deleted. Aggregated analytics (no IP addresses or identifying information) may be retained indefinitely.</p>
          <p>Provider registration data is retained for as long as the provider's service listing exists on the platform. Providers who delete their listing via the management dashboard or who request deletion via our <a href="/contact" className="text-mpp-amber hover:underline">contact form</a> will have their personal data removed within 30 days.</p>
        </Section>

        <Section title="4. Cookies and Local Storage">
          <p>We do not use tracking cookies or advertising cookies of any kind.</p>
          <p>The playground interface stores query history in your browser's localStorage under the key <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">mpp32_queries</code>. The management interface stores your provider token and slug under <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">mpp32_manage_slug</code> and <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">mpp32_manage_token</code>. This data never leaves your device and can be cleared at any time by clearing your browser's local storage.</p>
        </Section>

        <Section title="5. Third-Party Data Sources">
          <p>The intelligence API retrieves data from the following third-party services as part of query processing:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">DexScreener:</strong> DEX pair data, volume, liquidity, and price history. Their privacy policy applies to forwarded requests.</li>
            <li><strong className="text-foreground">Jupiter Price API:</strong> Cross-validated spot prices and confidence scoring. Their privacy policy applies to forwarded requests.</li>
            <li><strong className="text-foreground">CoinGecko API:</strong> Token metadata, market capitalization, and social metrics. Their privacy policy applies to forwarded requests. Data is attributed as "Powered by CoinGecko API" where used.</li>
          </ul>
          <p>Token addresses you query are forwarded to these services as part of data retrieval. We do not forward your IP address to these services.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>For general API users: because we do not collect personal identifiers beyond IP addresses, most data subject rights cannot be exercised in a meaningful way. IP address logs are deleted after 90 days automatically.</p>
          <p>For registered providers: you have the right to access, correct, or delete your registration data (including your email address) at any time via our <a href="/contact" className="text-mpp-amber hover:underline">contact form</a>. We will process deletion requests within 30 days.</p>
          <p>Residents of California (CCPA) and the European Economic Area (GDPR) may have additional rights including the right to know what data we hold, the right to deletion, and the right to data portability. <a href="/contact" className="text-mpp-amber hover:underline">Contact us</a> to exercise these rights.</p>
        </Section>

        <Section title="7. International Transfers">
          <p>MPP32 operates infrastructure that may process data across multiple jurisdictions. By using the service, you acknowledge that your data (including API request logs) may be processed in jurisdictions other than your own. We apply reasonable security measures to protect data in transit and at rest.</p>
        </Section>

        <Section title="8. Changes">
          <p>We may update this policy from time to time. The effective date at the top of this page will be updated on any material changes. Material changes will be announced via our website.</p>
        </Section>

        <Section title="9. Contact">
          <p>For privacy questions or to exercise your data rights, reach out via our <a href="/contact" className="text-mpp-amber hover:underline">contact form</a>.</p>
        </Section>
      </div>
    </div>
  );
}
