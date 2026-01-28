"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAnalytics } from "@/lib/analytics";

export function FinalCTASection() {
  const analytics = useAnalytics();

  const handleStartTrial = () => {
    analytics.ctaClick('Start Free Trial', 'final_cta_section', '/signup');
  };

  const handleScheduleDemo = () => {
    analytics.ctaClick('Schedule Demo', 'final_cta_section', '/demo');
  };

  return (
    <section className="border-t bg-muted/30 py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ready to Transform Your Service Business?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Stop losing revenue to missing or incorrect timesheets. Configure it yourself—no custom builds.
            Start your 14-day free trial today. No credit card required. Set up in 15 minutes. Cancel anytime.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="group" onClick={handleStartTrial}>
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" onClick={handleScheduleDemo}>
              <Link href="/demo">
                Schedule Demo
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Join 100+ service businesses</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>14-day free trial • No credit card</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Cancel anytime • No long-term contracts</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}