import { StatsBar } from "@/components/home/StatsBar";
import { HowItWorks } from "@/components/home/HowItWorks";
import { IntelligenceFields } from "@/components/home/IntelligenceFields";
import { IntegrationStrip } from "@/components/home/IntegrationStrip";
import { CtaSection } from "@/components/home/CtaSection";
import { HeroSection } from "@/components/home/HeroSection";
import { BuilderCallout } from "@/components/home/BuilderCallout";

export default function Index() {
  return (
    <div className="bg-mpp-bg">
      <HeroSection />
      <StatsBar />
      <BuilderCallout />
      <HowItWorks />
      <IntelligenceFields />
      <IntegrationStrip />
      <CtaSection />
    </div>
  );
}
