import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Do I need to install any SDK?",
    a: "No. Our hosted proxy handles all MPP payment verification server-side. You just host a plain HTTP endpoint (any language, any stack) and submit its URL. We wrap it with the mppx charge middleware automatically. Your endpoint receives a normal HTTP request only after payment is verified. No SDK, no client library, no middleware to install on your end.",
  },
  {
    q: "How does payment routing work?",
    a: "When a caller hits your MPP32 proxy URL, our gateway returns HTTP 402 with a payment challenge. The caller's MPP wallet pays, receives a signed receipt, and resubmits. Our proxy verifies the receipt, routes the payment directly to your configured wallet address (no intermediary custody), and forwards the request to your endpoint. Your endpoint just sees a normal HTTP request.",
  },
  {
    q: "What payment methods are accepted?",
    a: "MPP32 supports five payment protocols: Tempo (pathUSD on EVM), x402 (USDC on Solana), AP2, ACP, and AGTP. All are designed for micropayments. $0.008 per query is literally less than one US cent. Callers can pay with whichever protocol their wallet supports.",
  },
  {
    q: "Can I set my own pricing?",
    a: "Yes. You configure price per query (denominated in USD) when you register your service. You can set any amount above the minimum. Payments go directly to the wallet address you specify across any of the five supported protocols, and MPP32 takes no cut from your service revenue.",
  },
  {
    q: "How long does listing take?",
    a: "Submissions appear in the ecosystem directory instantly. Your proxy URL is active right away, but proxy traffic only flows to your endpoint after you complete endpoint verification. Verification takes about 2 minutes — add a route to your server, then click Verify in your dashboard.",
  },
  {
    q: "How does endpoint verification work?",
    a: "When you submit, you receive a verification token. Add a route to your server at /api/mpp32-verify that returns this token as plain text (HTTP 200, no JSON or HTML wrapper). Then go to /manage → Overview → click Verify Now. The system checks your endpoint and activates proxy traffic. The full setup guide with code examples for Express, Python, and static files is in your dashboard and docs.",
  },
  {
    q: "What if endpoint verification fails?",
    a: "Common causes: your route returns JSON instead of plain text, your server isn't publicly accessible over HTTPS, or there's extra whitespace in the response. Run 'curl -s https://yourdomain.com/api/mpp32-verify' to test — the output should be exactly your token with nothing else. You can retry verification as many times as needed. If the system's automatic daily re-check fails 3 times in a row, proxy traffic is paused until you re-verify.",
  },
  {
    q: "What if I change my endpoint URL later?",
    a: "You can change your endpoint URL anytime from the Edit Settings tab in your dashboard. Changing the URL resets your verification status and generates a new verification token. You'll need to set up the /api/mpp32-verify route at the new URL and re-verify.",
  },
  {
    q: "Is listing free?",
    a: "Yes. Submitting your project and being listed in the Built with MPP32 ecosystem is completely free. There are no listing fees, no revenue share, and no ongoing costs from MPP32 for being in the directory.",
  },
  {
    q: "What data services can I build?",
    a: "Anything with an HTTP endpoint: token scanners, price oracles, sentiment analysis, trading signals, DeFi analytics, NFT intelligence, wallet scoring, risk feeds, social data aggregators, and more. If it returns data over HTTP, it can be monetized through MPP.",
  },
  {
    q: "What wallet address do I need?",
    a: "You need an EVM wallet address (0x...) to receive payments via Tempo, AP2, ACP, and AGTP. Optionally, provide a Solana wallet address to receive x402 USDC payments directly. Any standard EVM wallet works: MetaMask, a hardware wallet, or a programmatic keypair. If you don't set a Solana address, x402 payments still work but settle to the platform address. Adding your own Solana address means you get paid directly on both networks.",
  },
  {
    q: "How does the hosted proxy handle authentication?",
    a: "The proxy gate is the authentication. Only callers who've made an on-chain payment (via Tempo or x402 on Solana) get their request forwarded. Your endpoint receives a plain HTTP request with an X-Forwarded-By: mpp32-proxy header confirming payment was verified.",
  },
  {
    q: "What if my endpoint goes down?",
    a: "The proxy returns a 502 error to the caller and they can retry once your service is back. The query is not counted and no payment is collected for failed forwards. Callers are not charged for unreachable upstream services.",
  },
  {
    q: "Can I update my service after listing?",
    a: "Yes. Visit the Manage Dashboard at /manage and log in with your slug and management token (issued at submission). You can update your endpoint URL, price, payment address, description, and socials. You can also deprecate your listing from the Danger Zone tab.",
  },
  {
    q: "What if I lose my management token?",
    a: "You can recover it from the Manage Dashboard login page using the email you registered with. Click 'Forgot your token?' enter your slug and creator email, and we'll issue a new token tied to that email. The old token is immediately invalidated for security.",
  },
  {
    q: "What payment method do callers use?",
    a: "MPP32 supports five payment protocols: Tempo, x402, AP2, ACP, and AGTP. Callers can use any protocol their wallet supports. The mppx SDK handles the full payment flow client-side automatically across all protocols.",
  },
  {
    q: "Is there a fee for using the proxy?",
    a: "Currently no platform fee. Payments go 100% to your configured wallet address. We may introduce an optional revenue-share model for featured listings in the future.",
  },
];

export function BuildFaq() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            FAQ
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-10">
            Common questions
          </h2>

          <Accordion type="single" collapsible className="space-y-0">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-mpp-border"
              >
                <AccordionTrigger className="text-left text-foreground font-semibold text-sm hover:no-underline hover:text-mpp-amber transition-colors py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
