import { BuildHero } from "@/components/build/BuildHero";
import { BuildValueProps } from "@/components/build/BuildValueProps";
import { BuildUseCases } from "@/components/build/BuildUseCases";
import { BuildProxyExplainer } from "@/components/build/BuildProxyExplainer";
import { BuildHowItWorks } from "@/components/build/BuildHowItWorks";
import { BuildTrustSafety } from "@/components/build/BuildTrustSafety";
import { BuildCategories } from "@/components/build/BuildCategories";
import { BuildSubmitForm } from "@/components/build/BuildSubmitForm";
import { BuildFaq } from "@/components/build/BuildFaq";

export default function Build() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <BuildHero />
      <div className="border-t border-mpp-border" />
      <BuildValueProps />
      <div className="border-t border-mpp-border" />
      <BuildUseCases />
      <div className="border-t border-mpp-border" />
      <BuildProxyExplainer />
      <div className="border-t border-mpp-border" />
      <BuildHowItWorks />
      <div className="border-t border-mpp-border" />
      <BuildTrustSafety />
      <div className="border-t border-mpp-border" />
      <BuildCategories />
      <div className="border-t border-mpp-border" />
      <BuildSubmitForm />
      <div className="border-t border-mpp-border" />
      <BuildFaq />
    </div>
  );
}
