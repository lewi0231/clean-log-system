"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const faqEntries = [
  {
    id: "field-based-pricing",
    question: "What is field-based pricing?",
    answer: (
      <>
        <strong>Field-based pricing</strong> means the price for a job is
        calculated from the values your workers enter in the job form—such as
        quantities, selected options, or service types—and the pricing rules you
        set on the{" "}
        <Link
          href="/dashboard/pricing"
          className="font-medium text-primary hover:underline"
        >
          Pricing page
        </Link>
        .
        <br />
        <br />
        For example, if you have a &quot;Number of rooms&quot; field with a
        rate of $50 per room, a job with 3 rooms would include $150 from that
        field. You configure these rules on the Pricing page. You can also set
        location-specific pricing by choosing a location in the Pricing
        page&apos;s scope selector.
      </>
    ),
  },
  {
    id: "location-hierarchy",
    question: "What is the location hierarchy?",
    answer: (
      <>
        The <strong>location hierarchy</strong> lets you group locations into
        regions or companies. This enables regional pricing: when a location is
        assigned to a region or company, it can inherit pricing rules from that
        group. Set up regions and companies in the{" "}
        <Link
          href="/dashboard/locations?tab=hierarchy"
          className="font-medium text-primary hover:underline"
        >
          Location Hierarchy
        </Link>{" "}
        tab, then assign locations to them when adding or editing a location.
      </>
    ),
  },
  {
    id: "pricing-scope",
    question: "How does the pricing scope selector work?",
    answer: (
      <>
        On the{" "}
        <Link
          href="/dashboard/pricing"
          className="font-medium text-primary hover:underline"
        >
          Pricing page
        </Link>
        , the scope selector lets you choose <strong>Organization</strong> (all
        locations), a specific <strong>Region</strong> or <strong>Company</strong>
        , or a single <strong>Location</strong>. Rules you set at a region or
        company apply to all locations in that group. Rules at a specific
        location override those from its region or company. Use this to tailor
        pricing by area or site.
      </>
    ),
  },
];

export default function HelpPage() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand the FAQ indicated by the URL hash on mount
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash && faqEntries.some((e) => e.id === hash)) {
      setOpenIds((prev) => new Set([...prev, hash]));
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          Help & FAQ
        </h1>
        <p className="text-muted-foreground mt-2">
          Answers to common questions about locations, pricing, and how things
          work.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Click a question to expand the answer. You can also link to a
            specific question from other pages (e.g. Help #field-based-pricing).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {faqEntries.map((entry) => (
            <div
              key={entry.id}
              id={entry.id}
              className="border rounded-lg overflow-hidden scroll-mt-24"
            >
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left font-medium transition-colors hover:bg-muted/50"
              >
                {entry.question}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground",
                    openIds.has(entry.id) && "rotate-180"
                  )}
                />
              </button>
              {openIds.has(entry.id) && (
                <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground border-t">
                  {entry.answer}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
