import {
  FAQSection,
  FeaturesSection,
  FinalCTASection,
  Footer,
  HeroSection,
  IndustrySections,
  MobileAppSection,
  PricingSection,
  SocialProofSection,
  WorkflowSection,
} from "@/components/landing-page";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col pt-16">
      <main>
        <HeroSection />
        <WorkflowSection />
        <FeaturesSection />
        <SocialProofSection />
        <PricingSection />
        <MobileAppSection />
        <IndustrySections />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
