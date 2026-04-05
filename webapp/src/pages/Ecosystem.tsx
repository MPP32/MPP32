import { useState } from "react";
import { EcosystemHero } from "@/components/ecosystem/EcosystemHero";
import { EcosystemStats } from "@/components/ecosystem/EcosystemStats";
import { EcosystemFilters } from "@/components/ecosystem/EcosystemFilters";
import { EcosystemGrid } from "@/components/ecosystem/EcosystemGrid";
import { EcosystemCta } from "@/components/ecosystem/EcosystemCta";

export default function Ecosystem() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="bg-mpp-bg min-h-screen">
      <EcosystemHero />
      <div className="border-t border-mpp-border" />
      <EcosystemStats />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EcosystemFilters activeCategory={activeCategory} onSelect={setActiveCategory} />
        <div className="mt-6">
          <EcosystemGrid category={activeCategory} />
        </div>
      </div>
      <div className="border-t border-mpp-border" />
      <EcosystemCta />
    </div>
  );
}
