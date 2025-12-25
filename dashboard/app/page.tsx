import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CreditCard,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  Mail,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const features = [
    {
      icon: Mail,
      title: "Automatic Feedback Collection",
      description:
        "Automatically send emails to customers when jobs are logged, collecting ratings and valuable feedback to improve your service.",
    },
    {
      icon: FileText,
      title: "Custom Field Data Collection",
      description:
        "Collect any data you need when logging jobs. Customize fields to track exactly what matters most to your business.",
    },
    {
      icon: DollarSign,
      title: "Automatic Invoicing & Payments",
      description:
        "Trigger invoices and payment links instantly when jobs are complete. Batch invoicing available for efficient bulk processing.",
    },
    {
      icon: Download,
      title: "Feedback Analytics & Export",
      description:
        "Easily collate and analyze customer feedback. Download reports to track trends and identify areas for improvement.",
    },
    {
      icon: Camera,
      title: "Before & After Photos",
      description:
        "Upload and organize before and after photos for every job. Showcase your work and build customer trust.",
    },
    {
      icon: BarChart3,
      title: "Dashboard Statistics",
      description:
        "Track total jobs, revenue, and average ratings at a glance. Make data-driven decisions with real-time insights.",
    },
    {
      icon: CreditCard,
      title: "Payment Status Tracking",
      description:
        "Monitor payment status for all invoices. Know exactly what's been paid and what's pending.",
    },
    {
      icon: FileCheck,
      title: "PDF Invoice Generation",
      description:
        "Generate professional PDF invoices automatically. Brand them with your logo and send them directly to customers.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-background to-muted/20 py-24 sm:py-32 h-screen flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 flex justify-center">
              <Logo />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Streamline Your Car Detailing
              <br />
              <span className="text-primary">Business Operations</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              The all-in-one solution for car detailers and car yard cleaners.
              Manage jobs, collect feedback, automate invoicing, and grow your
              business with powerful tools designed for your industry.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="group">
                <Link href="/signup">
                  Get Started
                  <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
              <Sparkles className="size-4" />
              <span>Powerful Features</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Run Your Business
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Built specifically for car detailers and car yard cleaners, with
              features that save time and help you grow.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-24 sm:py-32 flex items-center h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to Transform Your Business?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join car detailers and car yard cleaners who are already using
              CleanLog to streamline their operations and grow their business.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="group">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
