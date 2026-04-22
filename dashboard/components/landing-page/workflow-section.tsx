"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Bell,
  Calculator,
  CheckCircle,
  FileText,
  Mail,
  Smartphone,
  User,
} from "lucide-react";

const workflowSteps = [
  {
    icon: Smartphone,
    title: "Worker on Site",
    description: "Field worker completes job using mobile app with custom forms",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    icon: ArrowRight,
    title: "Job Submitted",
    description: "Data syncs instantly to your dashboard",
    color: "text-gray-400",
    bgColor: "bg-gray-50",
    isConnector: true,
  },
  {
    icon: Mail,
    title: "Client Email Sent",
    description: "Automated email with review request sent to customer",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    icon: FileText,
    title: "Invoice Generated",
    description: "Professional invoice created and ready to send",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    icon: Calculator,
    title: "Margins Calculated",
    description: "Profit margins automatically computed and tracked",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    icon: Bell,
    title: "Admin Notified",
    description: "You get notified of completed job and all processed data",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    icon: CheckCircle,
    title: "Review & Approve",
    description: "Quick review of all automated work, then approve and send invoice",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
];

export function WorkflowSection() {
  return (
    <section className="py-20 sm:py-28 border-t bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            From Job Site to Invoice in Minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our unique workflow automates everything between job completion and your approval, so
            you focus on growing your business, not paperwork.
          </p>
        </div>

        {/* Desktop Workflow - Horizontal */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-16 left-0 right-0 h-0.5 bg-linear-to-r from-blue-200 via-orange-200 to-emerald-200"></div>

            <div className="grid grid-cols-7 gap-4 relative">
              {workflowSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center">
                  <Card
                    className={`w-full max-w-48 transition-all hover:shadow-lg ${step.isConnector ? "border-dashed" : ""}`}
                  >
                    <CardContent className="p-6 text-center">
                      <div
                        className={`inline-flex size-12 items-center justify-center rounded-lg ${step.bgColor} mb-4`}
                      >
                        <step.icon className={`size-6 ${step.color}`} />
                      </div>
                      <h3 className="font-semibold mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Workflow - Vertical */}
        <div className="lg:hidden space-y-6">
          {workflowSteps.map((step, index) => (
            <div key={index} className="flex items-start gap-4">
              <div
                className={`shrink-0 inline-flex size-12 items-center justify-center rounded-lg ${step.bgColor}`}
              >
                <step.icon className={`size-6 ${step.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {index < workflowSteps.length - 1 && (
                <div className="shrink-0 mt-3">
                  <ArrowRight className="size-4 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Value Proposition */}
        <div className="mt-16 mx-auto max-w-3xl text-center">
          <div className="rounded-lg border bg-primary/5 p-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <User className="size-5 text-primary" />
              <span className="font-semibold text-primary">What makes Tally Runner unique</span>
            </div>
            <p className="text-lg mb-4">
              Most field service software just digitizes paperwork. Tally Runner automates the
              entire post-job workflow—review links to clients, emails, invoices, calculations—so
              you focus on your customers, not admin. You configure everything yourself: forms,
              pricing, static and one-off locations. No custom builds.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600 shrink-0" />
                <span>Zero manual data entry</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600 shrink-0" />
                <span>Automatic review links to clients</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600 shrink-0" />
                <span>You configure it—forms, pricing, locations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
