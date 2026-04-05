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

        {/* Bottom bar */}
        <div className="border-t border-mpp-border py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            &copy; 2026 MPP32. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
