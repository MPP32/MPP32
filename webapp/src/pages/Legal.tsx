import { Link } from "react-router-dom";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function Legal() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Legal Notices</h1>
          <p className="text-muted-foreground text-sm">Last updated: January 2025</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Section title="Not Financial Advice">
          <p>MPP32 provides data intelligence services. All data, scores, signals, and analysis returned by our API and displayed on our website are for informational purposes only. Nothing on MPP32 constitutes investment advice, financial advice, trading advice, or any recommendation to buy, sell, or hold any cryptocurrency or other financial instrument.</p>
          <p>Cryptocurrency and token investments carry substantial risk of loss. On-chain data patterns are not predictive of future price performance. You should consult a qualified financial advisor before making any investment decisions.</p>
        </Section>

        <Section title="Data Accuracy Disclaimer">
          <p>MPP32 retrieves data from third-party sources including DexScreener and Jupiter Price API. We make reasonable efforts to present this data accurately, but we cannot guarantee its accuracy, completeness, or timeliness. Data feeds may be delayed, interrupted, or incorrect.</p>
          <p>MPP32 is not liable for any losses or damages arising from inaccurate, incomplete, or delayed data.</p>
        </Section>

        <Section title="Machine Payments Protocol">
          <p>Payments for MPP32 API queries are processed via the Machine Payments Protocol using pathUSD on the Tempo network (Ethereum L2). These transactions are irreversible once confirmed on-chain. MPP32 does not process, hold, or have access to user private keys or wallet credentials.</p>
          <p>Blockchain transactions carry inherent risks including network congestion, failed transactions, and smart contract vulnerabilities. MPP32 is not liable for payment failures, lost funds, or network errors.</p>
        </Section>

        <Section title="Solana Network Data">
          <p>This service analyzes data from the Solana blockchain and associated DEX infrastructure. Solana is a decentralized network operated by independent validators. MPP32 has no control over the Solana network and is not liable for network outages, forks, or protocol changes that affect data availability.</p>
        </Section>

        <Section title="Intellectual Property">
          <p>The Alpha Score™ methodology, scoring algorithms, and intelligence models are proprietary to MPP32. The underlying open-source SDKs (mppx, pympp) are licensed under the MIT License as stated in their respective repositories.</p>
        </Section>

        <Section title="Governing Law">
          <p>These legal notices and any disputes arising from use of the MPP32 service are governed by the laws of the jurisdiction in which MPP32 is incorporated.</p>
        </Section>

        <div className="mt-8 pt-6 border-t border-mpp-border flex gap-4 text-xs font-mono">
          <Link to="/terms" className="text-mpp-amber hover:underline">Terms of Service</Link>
          <Link to="/privacy" className="text-mpp-amber hover:underline">Privacy Policy</Link>
          <a href="mailto:hello@mpp32.org" className="text-mpp-amber hover:underline">hello@mpp32.org</a>
        </div>
      </div>
    </div>
  );
}
