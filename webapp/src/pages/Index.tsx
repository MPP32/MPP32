import { StatsBar } from "@/components/home/StatsBar";
import { HowItWorks } from "@/components/home/HowItWorks";
import { IntelligenceFields } from "@/components/home/IntelligenceFields";
import { IntegrationStrip } from "@/components/home/IntegrationStrip";
import { CtaSection } from "@/components/home/CtaSection";
import { HeroSection } from "@/components/home/HeroSection";
import { BuilderCallout } from "@/components/home/BuilderCallout";
import { GetPaidSection } from "@/components/home/GetPaidSection";
import { ProtocolFragmentation } from "@/components/home/ProtocolFragmentation";
import { WhyProvidersWontBuild } from "@/components/home/WhyProvidersWontBuild";

export default function Index() {
  return (
    <div className="bg-mpp-bg">
      <HeroSection />
      <StatsBar />
      <ProtocolFragmentation />
      <HowItWorks />
      <WhyProvidersWontBuild />
      <BuilderCallout />
      <GetPaidSection />
      <IntelligenceFields />
      <IntegrationStrip />
      <CtaSection />
    </div>
  );
}
