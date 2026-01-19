"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import Link from "next/link";
import { useAnalytics } from "@/lib/analytics";

const pricingPlans = [
  {
    name: "Starter",
    price: "$39",
    period: "/month",
    description: "Perfect for solo operators",
    features: [
      "Up to 5 workers",
      "Mobile job tracking",
      "Automated invoicing",
      "Basic reporting",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    price: "$79",
    period: "/month",
    description: "Ideal for small teams",
    features: [
      "Up to 20 workers",
      "All Starter features",
      "Custom pricing rules",
      "Location management",
      "Worker performance tracking",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Business",
    price: "$149",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Unlimited workers",
      "All Professional features",
      "Advanced analytics",
      "Custom integrations",
      "Dedicated account manager",
      "Phone support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  const analytics = useAnalytics();

  const handlePricingCTA = (planName: string) => {
    analytics.ctaClick(`Start Free Trial - ${planName}`, 'pricing_section', '/signup');
  };

  const handleContactSales = () => {
    analytics.ctaClick('Contact Sales - Business Plan', 'pricing_section', '/contact');
  };

  return (
    <section id="pricing" className="py-20 sm:py-28 border-t bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that fits your business. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="size-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="w-full mt-6"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={plan.cta === "Contact Sales" ? handleContactSales : () => handlePricingCTA(plan.name)}
                >
                  <Link href={plan.cta === "Contact Sales" ? "/contact" : "/signup"}>
                    {plan.cta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <div className="rounded-lg border bg-muted/50 p-6">
            <h3 className="font-semibold mb-2">All plans include:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div>✓ 14-day free trial</div>
              <div>✓ No credit card required</div>
              <div>✓ Cancel anytime</div>
              <div>✓ Mobile app access</div>
              <div>✓ Automated invoicing</div>
              <div>✓ Payment processing</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}