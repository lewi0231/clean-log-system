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
  FileText,
  Sparkles,
  BadgeCheck,
  BarChart3,
  Blocks,
  CreditCard,
  FileSpreadsheet,
  Workflow,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const outcomes = [
    {
      icon: FileSpreadsheet,
      title: "Turn job data into invoices automatically",
      description:
        "Build your job forms once, then generate line items, totals, and PDFs from the exact data your team submits in the field.",
    },
    {
      icon: Workflow,
      title: "Standardize how work gets logged",
      description:
        "Give workers a clear, consistent workflow so every job entry includes the details you need—no more missing info.",
    },
    {
      icon: CreditCard,
      title: "Get paid faster with clear payment status",
      description:
        "Send invoices with payment links and keep tabs on what’s paid, pending, or needs a follow‑up.",
    },
    {
      icon: BarChart3,
      title: "See trends and performance at a glance",
      description:
        "Track jobs, revenue, and operations in one place—built for owner‑operators and small teams.",
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
              Field work in.
              <br />
              <span className="text-primary">Invoices out.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Fieldly helps service businesses capture the right job details from
              workers, then automatically generate invoices and payment links
              from that data—without spreadsheets.
            </p>
            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border bg-muted px-3 py-1">
                Cleaning
              </span>
              <span className="rounded-full border bg-muted px-3 py-1">
                Landscaping
              </span>
              <span className="rounded-full border bg-muted px-3 py-1">
                Maintenance
              </span>
              <span className="rounded-full border bg-muted px-3 py-1">
                Pest control
              </span>
              <span className="rounded-full border bg-muted px-3 py-1">
                Trades & installs
              </span>
              <span className="rounded-full border bg-muted px-3 py-1">
                Vehicle services
              </span>
            </div>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="group">
                <Link href="/dashboard">
                  Get started
                  <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
              <Sparkles className="size-4" />
              <span>Designed for field teams</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Configure your workflow once, then run it every day
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Most tools force you into one “job template”. Fieldly lets you
              design the exact data workers submit, and connect it directly to
              pricing and invoicing.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="flex flex-col">
              <CardHeader>
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <Blocks className="size-6 text-primary" />
                </div>
                <CardTitle className="text-xl">1) Build your job form</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base">
                  Add fields like quantities, photos, checklists, materials,
                  notes, and signatures. Make it match how your team works.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <BadgeCheck className="size-6 text-primary" />
                </div>
                <CardTitle className="text-xl">
                  2) Workers submit it onsite
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base">
                  Workers follow a guided workflow, so entries are consistent and
                  complete—no back‑and‑forth later.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="size-6 text-primary" />
                </div>
                <CardTitle className="text-xl">
                  3) Generate invoices automatically
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base">
                  Convert submitted data into line items, totals, and PDFs.
                  Invoice immediately or batch-send on your schedule.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section id="features" className="py-20 sm:py-28 border-t bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to go from job to payment
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Built for small service businesses that want a system, not more
              admin work.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
            {outcomes.map((feature) => {
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

      {/* Use cases */}
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
              <Sparkles className="size-4" />
              <span>Where Fieldly fits</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Made for work that doesn’t happen at a desk
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              If your pricing depends on what happened onsite (quantity, area,
              materials, photos), Fieldly is designed for you.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Per‑unit jobs</CardTitle>
                  <CardDescription>
                    Track counts, measurements, and options that impact price.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Multi‑location customers</CardTitle>
                  <CardDescription>
                    Standardize data capture across sites and invoice by location
                    or batch.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compliance & proof of work</CardTitle>
                  <CardDescription>
                    Photos, checklists, notes, and signatures—saved with every
                    job.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Owner‑operator friendly</CardTitle>
                  <CardDescription>
                    Simple setup, clear workflows, and automated admin tasks.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-24 sm:py-32 flex items-center h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to turn field work into invoices?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Set up your workflow, invite your team, and start capturing clean
              job data that powers invoicing and payments.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="group">
                <Link href="/dashboard">
                  Start now
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
