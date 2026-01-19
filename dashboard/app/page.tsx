import {
  NavigationHeader,
  HeroSection,
  WorkflowSection,
  FeaturesSection,
  SocialProofSection,
  PricingSection,
  MobileAppSection,
  IndustrySections,
  FAQSection,
  FinalCTASection,
  Footer,
} from "@/components/landing-page";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavigationHeader />
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