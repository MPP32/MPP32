import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Do I need to install any SDK?",
    a: "No. Our hosted proxy handles all MPP payment verification server-side. You just host a plain HTTP endpoint (any language, any stack) and submit its URL. We wrap it with the mppx charge middleware automatically — your endpoint receives a normal HTTP request only after payment is verified. No SDK, no client library, no middleware to install on your end.",
  },
  {
    q: "How does payment routing work?",
    a: "When a caller hits your MPP32 proxy URL, our gateway returns HTTP 402 with a payment challenge. The caller's MPP wallet pays, receives a signed receipt, and resubmits. Our proxy verifies the receipt, routes the payment directly to your configured wallet address (no intermediary custody), and forwards the request to your endpoint — which just sees a normal HTTP request.",
  },
  {
    q: "What's pathUSD?",
    a: "pathUSD is the Tempo stablecoin, pegged 1:1 to USD and settled on an EVM-compatible network. It's designed for micropayments — 0.008 pathUSD is literally less than one US cent. Clients fund a wallet or session deposit once and spend from it per query.",
  },
  {
    q: "Can I set my own pricing?",
    a: "Yes. You configure price per query in pathUSD when you register your service. You can set any amount above the minimum. Payments go directly to the wallet address you specify — MPP32 takes no cut from your service revenue.",
  },
  {
    q: "How long does listing take?",
    a: "Submissions go live instantly. The moment you submit your project, it appears in the ecosystem directory and your proxy URL is active. No review queue, no waiting period.",
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
    a: "You need a Tempo-compatible EVM wallet address (0x...) to receive payments. This is the address you provide when registering your service. Any standard EVM wallet works: MetaMask, a hardware wallet, or a programmatic keypair.",
  },
  {
    q: "How does the hosted proxy handle authentication?",
    a: "The proxy gate is the authentication. Only callers who've made an on-chain Tempo payment get their request forwarded. Your endpoint receives a plain HTTP request with an X-Forwarded-By: mpp32-proxy header confirming payment was verified.",
  },
  {
    q: "What if my endpoint goes down?",
    a: "The proxy returns a 502 error to the caller and they can retry once your service is back. The query is not counted and no payment is collected for failed forwards — callers are not charged for unreachable upstream services.",
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
    a: "MPP32 uses Tempo — a fast, low-fee stablecoin payment protocol on EVM. Callers need an MPP-compatible wallet or client. The mppx SDK handles the full payment flow client-side automatically.",
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
