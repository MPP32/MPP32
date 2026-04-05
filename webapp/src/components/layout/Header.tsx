import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Oracle", href: "/oracle" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Build", href: "/build" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "API", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-mpp-border bg-mpp-bg/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-mpp32.jpg"
              alt="MPP32"
              className="h-7 w-7 rounded-md"
              style={{ mixBlendMode: "lighten" }}
            />
            <span className="font-display text-xl font-semibold text-foreground tracking-tight">
              MPP32
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-sm transition-colors",
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/dashboard">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Console
              </span>
            </Link>
            <Link to="/playground">
              <button className="btn-amber flex items-center gap-1.5 text-sm px-4 py-1.5 rounded">
                Run a Query
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground p-1 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-mpp-border bg-mpp-bg">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center justify-between py-2.5 text-sm border-b border-mpp-border/50 last:border-0 transition-colors",
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
            <Link
              to="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm border-b border-mpp-border/50 text-muted-foreground"
            >
              Console
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <div className="pt-3">
              <Link to="/playground" onClick={() => setMobileOpen(false)}>
                <button className="btn-amber w-full text-sm px-4 py-2.5 rounded flex items-center justify-center gap-2">
                  Run a Query
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
