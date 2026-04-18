import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-mpp-bg flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-6">404</p>
        <h1 className="font-display text-5xl font-semibold text-foreground mb-4">
          Page not found.
        </h1>
        <p className="text-muted-foreground text-base mb-8 leading-relaxed">
          The route{" "}
          <span className="font-mono text-foreground text-sm">{location.pathname}</span>{" "}
          doesn't exist. Check the URL or return to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Back to Home
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link to="/playground">
            <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm">
              Open Playground
            </button>
          </Link>
        </div>
        <div className="mt-12 pt-8 border-t border-mpp-border">
          <p className="text-muted-foreground text-xs font-mono">
            MPP32 · On-Chain Intelligence for Solana
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
