function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Effective date: January 1, 2025</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Section title="1. Acceptance of Terms">
          <p>By accessing or using MPP32's on-chain intelligence services, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>MPP32 provides on-chain data intelligence for Solana tokens via a REST API. The service is billed per query through the Machine Payments Protocol (MPP) using pathUSD, a stablecoin. Access to the service does not require account registration.</p>
          <p>The service provides informational data derived from publicly available on-chain sources including DexScreener and Jupiter Price API. MPP32 does not provide financial advice, investment recommendations, or trading signals.</p>
        </Section>

        <Section title="3. No Financial Advice">
          <p>All content and data provided by MPP32 is for informational purposes only. Nothing in the service constitutes financial advice, investment advice, trading advice, or any other form of advice. You should not make any financial decision based solely on data returned by MPP32.</p>
          <p>Cryptocurrency markets are highly volatile. Past data patterns do not guarantee future performance. You bear sole responsibility for any trading or investment decisions you make.</p>
        </Section>

        <Section title="4. Payment and Billing">
          <p>Queries to the production endpoint at /api/intelligence are billed at 0.008 pathUSD per query via the Machine Payments Protocol. Payment is processed atomically and is non-refundable once the HTTP 200 response has been delivered.</p>
          <p>The playground endpoint at /api/intelligence/demo is provided free of charge for evaluation purposes and may be rate-limited or modified at any time.</p>
        </Section>

        <Section title="5. Prohibited Uses">
          <p>You may not use the service to: (a) build competing intelligence products that resell MPP32 data; (b) attempt to circumvent payment mechanisms; (c) make requests at rates that constitute denial-of-service behavior; (d) scrape, harvest, or systematically download data beyond normal API usage.</p>
        </Section>

        <Section title="6. Disclaimer of Warranties">
          <p>The service is provided "as is" without warranties of any kind. MPP32 does not warrant that data is accurate, complete, or current. On-chain data sources can be delayed, unavailable, or incorrect. MPP32 is not liable for any losses arising from reliance on service data.</p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>To the maximum extent permitted by law, MPP32's liability to you for any claim arising out of your use of the service is limited to the amount you paid for the specific queries giving rise to the claim.</p>
        </Section>

        <Section title="8. Changes to Terms">
          <p>We may update these terms from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.</p>
        </Section>

        <Section title="9. Contact">
          <p>For questions about these terms, contact us at hello@mpp32.org.</p>
        </Section>
      </div>
    </div>
  );
}
