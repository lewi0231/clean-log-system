"use client";

import { Button } from "@/components/ui/button";
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
  Wifi,
  Zap,
  Users,
} from "lucide-react";

const appFeatures = [
  {
    icon: FileText,
    title: "Custom Forms for Your Business",
    description: "Create job forms tailored to your services. Car details, service notes, photos, time tracking—whatever your business needs.",
    benefit: "Workers fill in exactly what you need, no more, no less",
  },
  {
    icon: Wifi,
    title: "Works Offline",
    description: "Jobs sync when connection is available. Workers can complete jobs even in areas with poor signal.",
    benefit: "Never lose a job due to connectivity issues",
  },
  {
    icon: Zap,
    title: "Instant Updates",
    description: "Jobs appear in your dashboard the moment workers complete them. No delays, no confusion.",
    benefit: "Always know what's happening with your business",
  },
  {
    icon: Users,
    title: "Simple for Your Team",
    description: "Intuitive interface designed for field workers. No training required, just download and start using.",
    benefit: "Your workers will actually use it",
  },
];

export function MobileAppSection() {
  return (
    <section id="mobile-app" className="py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your Workers Complete Jobs on Their Phones
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The RivetUp mobile app puts the power of your business in your workers' hands.
              Complete jobs, track time, add photos, and sync everything automatically.
            </p>
          </div>

          {/* Mobile App Features */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-12">
            {appFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index}>
                  <CardHeader>
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
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

          {/* Industry Examples */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-12">
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-lg bg-primary/10 mx-auto">
                <Smartphone className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Car Detailers</h3>
              <p className="text-sm text-muted-foreground">
                Workers log car details and services at the yard, add photos, and sync instantly.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-lg bg-primary/10 mx-auto">
                <Smartphone className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Tradespeople</h3>
              <p className="text-sm text-muted-foreground">
                Complete jobs on-site, track time, add materials, and document with photos.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-lg bg-primary/10 mx-auto">
                <Smartphone className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Cleaning Services</h3>
              <p className="text-sm text-muted-foreground">
                Log cleaning tasks, time spent per area, and sync schedules automatically.
              </p>
            </div>
          </div>

          {/* App Store Badges */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Mobile App Coming Soon</h3>
            <p className="text-muted-foreground mb-6">
              Sign up now to get notified when the mobile app launches and get early access.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" disabled>
                Download on the App Store (Coming Soon)
              </Button>
              <Button variant="outline" disabled>
                Get it on Google Play (Coming Soon)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}