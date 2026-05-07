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
          <p className="text-muted-foreground text-sm">Effective date: April 18, 2026</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Section title="1. Acceptance of Terms">
          <p>By accessing or using any MPP32 service, including the on-chain intelligence API, the Ecosystem marketplace, and the hosted proxy infrastructure, you agree to be bound by these Terms of Service. If you do not agree, do not use the service. You must be at least 18 years of age to use MPP32 services.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>MPP32 provides three categories of service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Intelligence API:</strong> On-chain data intelligence for Solana tokens, billed per query via the Machine Payments Protocol (MPP) across five supported protocols: Tempo, x402, AP2, ACP, and AGTP.</li>
            <li><strong className="text-foreground">Hosted Proxy:</strong> Payment-gated forwarding of third-party API endpoints registered by providers in the MPP32 Ecosystem.</li>
            <li><strong className="text-foreground">Builder Platform:</strong> Open infrastructure for registering and managing MPP-enabled data services.</li>
          </ul>
          <p>The intelligence service provides informational data derived from publicly available on-chain sources including DexScreener, Jupiter Price API, and CoinGecko API (data attributed as "Powered by CoinGecko API"). Access does not require account registration.</p>
          <p>MPP32 does not provide financial advice, investment recommendations, or trading signals.</p>
        </Section>

        <Section title="3. No Financial Advice">
          <p>All content and data provided by MPP32, including Alpha Scores, pump probability estimates, risk ratings, whale activity signals, and projected ROI ranges, is for informational purposes only. Nothing in the service constitutes financial advice, investment advice, trading advice, or any recommendation to buy, sell, or hold any cryptocurrency or other financial instrument.</p>
          <p>Cryptocurrency markets are highly volatile. Past data patterns do not guarantee future performance. You bear sole responsibility for any trading or investment decisions you make.</p>
        </Section>

        <Section title="4. Payment and Billing">
          <p>Queries to the production intelligence endpoint at <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">/api/intelligence</code> are billed at $0.008 per query via the Machine Payments Protocol (MPP) across five supported protocols: Tempo, x402, AP2, ACP, and AGTP. Payment is processed atomically and is non-refundable once an HTTP 200 response has been delivered.</p>
          <p>Proxy service queries are billed at rates set by the individual provider. These rates are displayed before payment is processed. Proxy payments are non-refundable once delivered to the provider's payment address.</p>
          <p>The demo endpoint at <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">/api/intelligence/demo</code> is provided free of charge for evaluation purposes and may be rate-limited or modified at any time.</p>
          <p>Blockchain transactions are irreversible by nature. MPP32 has no ability to reverse, recall, or refund on-chain payments regardless of the circumstances.</p>
        </Section>

        <Section title="5. Prohibited Uses">
          <p>You may not use any MPP32 service to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Build competing intelligence products that directly resell or repackage MPP32 data;</li>
            <li>Attempt to circumvent, bypass, or exploit payment mechanisms;</li>
            <li>Make requests at rates that constitute denial-of-service behavior;</li>
            <li>Scrape, harvest, or systematically download data beyond normal API usage;</li>
            <li>Engage in any activity that violates applicable laws or regulations;</li>
            <li>Access or use the service if you are located in, a resident of, or acting on behalf of a person or entity in a jurisdiction subject to OFAC sanctions, UN Security Council sanctions, or any other applicable sanctions regime (including but not limited to Cuba, Iran, North Korea, Syria, and the Crimea/Donetsk/Luhansk regions);</li>
            <li>Use the service if you are under 18 years of age.</li>
          </ul>
        </Section>

        <Section title="6. Provider and Builder Terms">
          <p>If you register a service on the MPP32 Ecosystem (as a "Provider"), the following additional terms apply:</p>
          <p><strong className="text-foreground">Eligibility and compliance:</strong> By submitting a service, you represent that you have all necessary rights, licenses, and authorizations to offer that service. You are solely responsible for ensuring your service complies with all applicable laws in every jurisdiction where it may be accessed, including but not limited to data protection laws, financial regulations, export controls, and anti-money laundering (AML) requirements.</p>
          <p><strong className="text-foreground">Prohibited service content:</strong> You may not register services that: offer illegal content or activities; constitute unlicensed financial services, investment advice, or money transmission; infringe third-party intellectual property; involve sanctioned parties or prohibited jurisdictions; or violate any third-party API's terms of service.</p>
          <p><strong className="text-foreground">Payment address responsibility:</strong> You are solely responsible for the accuracy of your payment address. MPP32 is not liable for payments sent to an incorrectly configured address.</p>
          <p><strong className="text-foreground">KYC/AML obligations:</strong> If your service involves financial data, trading tools, or payment services, you acknowledge and accept all applicable KYC (Know Your Customer) and AML (Anti-Money Laundering) obligations in your jurisdiction. MPP32 does not perform KYC on providers or their end users.</p>
          <p><strong className="text-foreground">Management token security:</strong> Your management token is shown only once at registration. You are responsible for its safekeeping. MPP32 is not liable for unauthorized use of a leaked or compromised management token.</p>
          <p><strong className="text-foreground">Removal:</strong> MPP32 reserves the right to remove or suspend any service listing at any time for any reason, including but not limited to suspected illegal activity, abuse reports, or violation of these terms, without prior notice.</p>
        </Section>

        <Section title="7. Disclaimer of Warranties">
          <p>The service is provided "as is" without warranties of any kind, express or implied. MPP32 does not warrant that data is accurate, complete, current, or fit for any particular purpose. On-chain data sources can be delayed, unavailable, or incorrect. Third-party provider services in the Ecosystem are not vetted, endorsed, or warranted by MPP32. MPP32 is not liable for any losses arising from reliance on service data or third-party provider outputs.</p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, MPP32's aggregate liability to you for any claims arising out of your use of the service is limited to the total amount you paid for the specific queries giving rise to the claim in the 30 days preceding the claim. MPP32 is not liable for indirect, incidental, consequential, special, or punitive damages of any kind.</p>
        </Section>

        <Section title="9. Governing Law">
          <p>These Terms of Service are governed by and construed in accordance with the laws of the jurisdiction in which MPP32 is incorporated. <strong className="text-foreground">Note: MPP32 must specify its incorporation jurisdiction here before these terms are finalized. <a href="/contact" className="text-mpp-amber hover:underline">Contact us</a> if you are a provider or user with questions about applicable law.</strong></p>
          <p>Any dispute arising out of or relating to these Terms that cannot be resolved informally shall be subject to binding arbitration, with proceedings conducted in English. Each party agrees to waive any right to a jury trial or to participate in a class action.</p>
        </Section>

        <Section title="10. Changes to Terms">
          <p>We may update these terms from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms. Material changes will be announced via our website with at least 14 days notice where reasonably practicable.</p>
        </Section>

        <Section title="11. Contact">
          <p>For questions about these terms, reach out via our <a href="/contact" className="text-mpp-amber hover:underline">contact form</a>.</p>
        </Section>
      </div>
    </div>
  );
}
