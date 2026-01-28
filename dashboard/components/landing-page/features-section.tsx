"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Smartphone,
  FileText,
  Calculator,
  Users,
  MapPin,
  Zap,
  MessageCircle,
  Settings,
} from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Mobile Job Tracking",
    description: "Your workers complete jobs on their phones with custom forms. No more paper, no more lost data.",
    benefit: "Jobs sync instantly to your dashboard",
  },
  {
    icon: FileText,
    title: "Automated Invoicing",
    description: "Invoices generated automatically when jobs are completed. Send to customers with payment links included.",
    benefit: "Get paid faster with automated payment links",
  },
  {
    icon: MessageCircle,
    title: "Automatic Review Links to Clients",
    description: "Review request links are sent to clients automatically when jobs are done—capture feedback and build credibility without extra work.",
    benefit: "Clients leave reviews; you look after the job",
  },
  {
    icon: Calculator,
    title: "Custom Pricing Rules",
    description: "Set pricing by unit, location, service type, or flat rate. Perfect for complex pricing structures.",
    benefit: "Price jobs exactly how your business works",
  },
  {
    icon: Users,
    title: "Worker Management",
    description: "Add workers, track their jobs, manage payments, and monitor performance ratings.",
    benefit: "Keep your team organized and accountable",
  },
  {
    icon: MapPin,
    title: "Static & One-Off Locations",
    description: "Handle fixed sites (car yards, recurring customers) and one-off job addresses—each with its own pricing and rules.",
    benefit: "One system for yards, sites, and ad‑hoc jobs",
  },
  {
    icon: Zap,
    title: "Real-Time Updates",
    description: "Jobs completed in the field appear instantly in your dashboard. No delays, no confusion.",
    benefit: "Always know what's happening with your business",
  },
  {
    icon: Settings,
    title: "You Configure It Yourself",
    description: "Set up forms, pricing, and locations in your dashboard. No custom builds, no long waits—you're in control.",
    benefit: "Take control without calling a developer",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28 border-t bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything You Need to Run Your Service Business
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Take control with forms, pricing, and locations you configure yourself—plus automatic
            review links to clients. Built for solo operators and small teams.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="flex flex-col">
                <CardHeader>
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-base mb-3">
                    {feature.description}
                  </CardDescription>
                  <p className="text-sm font-medium text-primary">
                    {feature.benefit}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}