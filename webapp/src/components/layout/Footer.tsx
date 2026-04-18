import { Link } from "react-router-dom";

const footerLinks = {
  Product: [
    { label: "Oracle", href: "/oracle" },
    { label: "Use Cases", href: "/use-cases" },
    { label: "Playground", href: "/playground" },
    { label: "Console", href: "/dashboard" },
    { label: "Pricing", href: "/pricing" },
  ],
  Builders: [
    { label: "Build Your MPP", href: "/build" },
    { label: "Ecosystem", href: "/ecosystem" },
  ],
  Developers: [
    { label: "API Reference", href: "/docs" },
    { label: "mppx SDK", href: "https://github.com/wevm/mppx", external: true },
    { label: "Examples", href: "/docs#examples" },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
    { label: "Legal", href: "/legal" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Follow on X", href: "https://x.com/MPP32_dev", external: true },
    { label: "GitHub", href: "https://github.com/MPP32/MPP32", external: true },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-mpp-border bg-mpp-bg mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img
                src="/logo-mpp32.jpg"
                alt="MPP32"
                className="h-6 w-6 rounded"
                style={{ mixBlendMode: "lighten" }}
              />
              <span className="font-display text-xl font-semibold text-foreground tracking-tight">MPP32</span>
            </Link>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-[180px]">
              On-chain intelligence for Solana tokens, billed per query.
            </p>
            <p className="text-muted-foreground text-[11px] mt-4 leading-relaxed max-w-[180px]">
              Built on the Machine Payments Protocol
            </p>
          </div>

          {/* Link sections */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="text-foreground text-xs font-semibold uppercase tracking-widest mb-3">
                {section}
              </p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Token CA */}
        <div className="border-t border-mpp-border py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contract Address</span>
            <div className="flex items-center gap-2 bg-white/5 border border-mpp-border rounded-md px-3 py-1.5">
              <span className="text-xs font-mono text-foreground/80 select-all tracking-wide">
                6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump
              </span>
              <button
                onClick={() => navigator.clipboard.writeText("6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump")}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Copy CA"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground text-xs">
              &copy; 2026 MPP32. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
