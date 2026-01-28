"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useAnalytics } from "@/lib/analytics";

export function HeroSection() {
  const analytics = useAnalytics();

  const handleStartTrial = () => {
    analytics.ctaClick('Start Free Trial', 'hero_section', '/signup');
  };

  const handleWatchDemo = () => {
    analytics.ctaClick('Watch Demo', 'hero_section', '#features');
  };

  return (
    <section className="relative overflow-hidden border-b bg-linear-to-b from-background to-muted/20 py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Manage Your Field Workers,
            <br />
            <span className="text-primary">Jobs, and Invoicing in One Place</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Whether you're a lone operator or manage staff and sub-contractors—enter hours on a phone or tablet
            before leaving the job. Clients get invoiced correctly, sub-contractors get paid on time,
            and you stop losing revenue to missing or incorrect timesheets.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Configure forms, pricing, and locations yourself. No custom builds, no waiting—just set up and go.
          </p>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-primary font-semibold">Join 100+ service businesses</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>No credit card required</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="group" onClick={handleStartTrial}>
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" onClick={handleWatchDemo}>
              <Link href="#features">
                <Play className="mr-2 size-4" />
                Watch Demo
              </Link>
            </Button>
          </div>

          {/* Hero Visual Placeholder */}
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="relative rounded-lg border bg-muted/50 p-8 text-center">
              <p className="text-muted-foreground">
                [Hero Visual: Dashboard and mobile app screenshots showing job management workflow]
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}