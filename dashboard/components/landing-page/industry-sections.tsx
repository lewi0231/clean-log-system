"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Wrench, Sparkles } from "lucide-react";
import Link from "next/link";

const industries = [
  {
    id: "car-detailing",
    icon: Car,
    title: "Built for Car Detailers",
    headline: "Manage Car Yard Detailing with Ease",
    description: "Your workers complete detailing jobs at car yards using the mobile app. They log car details, select service packages, and add photos. Invoices are automatically generated and sent to customers monthly.",
    features: [
      "Track car details (make, model, size)",
      "Service package pricing",
      "Location-based pricing per car yard",
      "Automated monthly invoicing",
      "Worker performance tracking",
    ],
    testimonial: {
      quote: "RivetUp transformed how we manage our car yard detailing. The mobile app means our workers can log jobs on-site, and invoices go out automatically. We've cut our admin time in half.",
      name: "Sarah Chen",
      business: "Auto Detail Pro, Melbourne",
    },
  },
  {
    id: "tradespeople",
    icon: Wrench,
    title: "Perfect for Tradespeople",
    headline: "Complete Jobs On-Site, Invoice Instantly",
    description: "Your workers use the mobile app to complete jobs, track time, and document work with photos. Invoices are generated automatically with flexible pricing rules that match how you charge.",
    features: [
      "Time tracking per job",
      "Material and supply tracking",
      "Job photo documentation",
      "Flexible pricing (hourly, fixed, per job)",
      "Instant invoice generation",
    ],
    testimonial: {
      quote: "As a solo electrician, I needed something simple that worked on my phone and handled complex pricing. RivetUp lets me track time, add materials, and send professional invoices—all from the job site.",
      name: "Mike Thompson",
      business: "Thompson Electrical Services",
    },
  },
  {
    id: "cleaning-services",
    icon: Sparkles,
    title: "Ideal for Cleaning Services",
    headline: "Streamlined Cleaning Service Management",
    description: "Manage recurring cleaning jobs at fixed locations with time tracking and automated batch invoicing. Perfect for offices, homes, and commercial spaces.",
    features: [
      "Recurring job management",
      "Fixed location tracking",
      "Time tracking per area",
      "Service type tracking (deep clean, maintenance)",
      "Batch invoicing",
    ],
    testimonial: {
      quote: "Managing 15 workers across 20 locations used to be chaos. Now with RivetUp, I can see all jobs in real-time, track worker performance, and invoice customers automatically.",
      name: "Lisa Rodriguez",
      business: "CleanSpace Commercial",
    },
  },
];

export function IndustrySections() {
  return (
    <section id="industries" className="py-20 sm:py-28 border-t bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Designed for Your Industry
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            RivetUp adapts to how your business works, whether you&apos;re a car detailer,
            tradesperson, or cleaning service.
          </p>
        </div>

        <div className="space-y-16">
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <div key={industry.id} className={`grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                {/* Content */}
                <div className="flex flex-col justify-center">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
                    <Icon className="size-4" />
                    <span>{industry.title}</span>
                  </div>

                  <h3 className="text-2xl font-bold tracking-tight mb-4">
                    {industry.headline}
                  </h3>

                  <p className="text-lg text-muted-foreground mb-6">
                    {industry.description}
                  </p>

                  <div className="mb-6">
                    <h4 className="font-semibold mb-3">Key Features:</h4>
                    <ul className="space-y-2">
                      {industry.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">✓</Badge>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Card className="mb-6">
                    <CardContent className="pt-6">
                      <blockquote className="text-sm italic text-muted-foreground mb-3">
                        {industry.testimonial.quote}
                      </blockquote>
                      <div>
                        <div className="font-semibold text-sm">{industry.testimonial.name}</div>
                        <div className="text-xs text-muted-foreground">{industry.testimonial.business}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button asChild>
                    <Link href={`/industries/${industry.id}`}>
                      See How It Works
                    </Link>
                  </Button>
                </div>

                {/* Visual Placeholder */}
                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-md h-64 rounded-lg border bg-muted/50 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Icon className="size-12 mx-auto mb-2" />
                      <p className="text-sm">[{industry.title} Visual]</p>
                      <p className="text-xs">Screenshots and workflow demo</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}