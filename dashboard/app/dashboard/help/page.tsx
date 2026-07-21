"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const faqEntries = [
  {
    id: "field-based-pricing",
    question: "What is field-based pricing?",
    answer: (
      <>
        <strong>Field-based pricing</strong> means the price for a job is calculated from the values
        your workers enter in the job form—such as quantities, selected options, or service
        types—and the pricing rules you set on the{" "}
        <Link href="/dashboard/pricing" className="font-medium text-primary hover:underline">
          Pricing page
        </Link>
        .
        <br />
        <br />
        For example, if you have a &quot;Number of rooms&quot; field with a rate of $50 per room, a
        job with 3 rooms would include $150 from that field. You configure these rules on the
        Pricing page. You can also set location-specific pricing by choosing a location in the
        Pricing page&apos;s scope selector.
      </>
    ),
  },
  {
    id: "location-hierarchy",
    question: "What is the location hierarchy?",
    answer: (
      <>
        The <strong>location hierarchy</strong> lets you group locations into regions or companies.
        This enables regional pricing: when a location is assigned to a region or company, it can
        inherit pricing rules from that group. Set up regions and companies in the{" "}
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
        <Link href="/dashboard/pricing" className="font-medium text-primary hover:underline">
          Pricing page
        </Link>
        , the scope selector lets you choose <strong>Organization</strong> (all locations), a
        specific <strong>Region</strong> or <strong>Company</strong>, or a single{" "}
        <strong>Location</strong>. Rules you set at a region or company apply to all locations in
        that group. Rules at a specific location override those from its region or company. Use this
        to tailor pricing by area or site.
      </>
    ),
  },
  // Settings & Invoicing
  {
    id: "invoice-sending-and-auto-generate",
    question:
      "What's the difference between 'Send Invoices Immediately' and 'Auto-Generate Invoices'?",
    answer: (
      <>
        <strong>Send Invoices Immediately</strong> (Settings → Invoicing) controls whether, once an
        invoice exists, it is emailed to the customer straight away or left in draft for you to
        review first. When on, invoices are sent as soon as they’re created; when off, they stay in
        &quot;pending review&quot; until you send them.
        <br />
        <br />
        <strong>Auto-Generate Invoices</strong> (same tab) controls whether an invoice is created at
        all when a job is completed. When on, completing a job automatically creates an invoice
        (which may then be sent immediately or not, depending on the setting above). When off, you
        create invoices yourself from Completed Jobs. If a location has its own auto-generate
        setting, that location’s setting overrides the organization default for jobs at that
        location. Configure both in{" "}
        <Link
          href="/dashboard/settings?tab=invoicing"
          className="font-medium text-primary hover:underline"
        >
          Settings → Invoicing
        </Link>
        .
      </>
    ),
  },
  {
    id: "gst-on-invoices",
    question: "How does GST work on my invoices?",
    answer: (
      <>
        In{" "}
        <Link
          href="/dashboard/settings?tab=invoicing"
          className="font-medium text-primary hover:underline"
        >
          Settings → Invoicing → Tax / GST
        </Link>
        you can turn <strong>GST registered</strong> on or off. If you’re not registered (e.g. under
        the $75k turnover threshold), leave it off: invoices will show as &quot;Invoice&quot; and no
        GST is calculated or shown. If you are registered, we use &quot;Tax Invoice&quot; and show a
        GST breakdown when the total is $82.50 or more (AUD).
        <br />
        <br />
        <strong>Prices include GST</strong> (on by default) tells the system whether amounts on the
        Pricing page already include GST. When on, we treat those as GST-inclusive and derive the
        GST component — the invoice total matches your price. When off, GST is added on top.{" "}
        <strong>GST rate (%)</strong> is the rate we use (default 10% for Australia).
      </>
    ),
  },
  {
    id: "customer-locations-setting",
    question: "What does the 'Customer Locations' setting do?",
    answer: (
      <>
        The <strong>Customer Locations</strong> toggle is in{" "}
        <Link
          href="/dashboard/settings?tab=features"
          className="font-medium text-primary hover:underline"
        >
          Settings → Features
        </Link>
        . When it’s <strong>on</strong>, the locations you add under{" "}
        <Link href="/dashboard/locations" className="font-medium text-primary hover:underline">
          Locations
        </Link>{" "}
        appear in the mobile app: workers choose a location when completing a job, and that can
        drive regional pricing and invoicing. When it’s <strong>off</strong>, workers don’t pick
        from a list of locations; you can still use the app and custom fields, but location-based
        features (e.g. location-specific pricing or auto-generate) don’t apply. Use &quot;Manage
        locations&quot; in that same card to add or edit locations.
      </>
    ),
  },
  {
    id: "send-feedback-requests-immediately",
    question: "What does 'Send Feedback Requests Immediately' do?",
    answer: (
      <>
        The <strong>Send Feedback Requests Immediately</strong> toggle is in{" "}
        <Link
          href="/dashboard/settings?tab=features"
          className="font-medium text-primary hover:underline"
        >
          Settings → Features
        </Link>
        . It controls when we email customers to ask for a rating or feedback after a job is
        completed.
        <br />
        <br />
        When it’s <strong>on</strong>, we send the feedback request email automatically as soon as
        the job is marked complete. When it’s <strong>off</strong>, we don’t send it automatically;
        you can still send feedback requests manually from the{" "}
        <Link href="/dashboard/ratings" className="font-medium text-primary hover:underline">
          Customer Ratings
        </Link>{" "}
        page or via the relevant job actions. Turning it off is useful if you prefer to review jobs
        first or send feedback requests in batches.
      </>
    ),
  },
  {
    id: "field-group-settings-mutual-exclusion",
    question: "How do field group settings and mutual exclusion work?",
    answer: (
      <>
        <strong>Field group settings</strong> on the{" "}
        <Link href="/dashboard/mobile-config" className="font-medium text-primary hover:underline">
          Mobile Config
        </Link>{" "}
        page let you define options that workers can choose from in the job form. Only one option
        can be selected at a time—that’s the <strong>mutual exclusion</strong> logic.
        <br />
        <br />
        <strong>Our approach:</strong> We use a single mutually exclusive group. Within it, each
        selectable &quot;option&quot; is a <strong>cluster</strong>. Fields that share the same
        cluster are shown together when that option is chosen—for example, &quot;Wiped&quot; and
        &quot;Soaped&quot; might be two fields in the cluster &quot;wiped + soaped details&quot;, so
        the worker picks one option and sees both fields as one choice. All clusters together form
        one set: the worker selects exactly one option from that set.
        <br />
        <br />
        <strong>How to use it:</strong> (1) Open Mobile Config and click{" "}
        <strong>Field Group Settings</strong> at the top to create option names (clusters) if you
        need new ones. (2) In the form builder, open a field’s settings (gear icon), expand
        &quot;Mutually Exclusive Cluster&quot;, and assign the field to an existing cluster or type
        a new cluster name. Fields in the same cluster act as one option; different clusters are the
        different choices the worker can pick. Clusters you create in Field Group Settings appear in
        the dropdown when assigning fields. You can also type a new cluster name directly in a
        field’s settings and it will be created.
      </>
    ),
  },
  {
    id: "invoice-due-days",
    question: "What does 'Default Invoice Due Days' mean?",
    answer: (
      <>
        <strong>Default Invoice Due Days</strong> is set in{" "}
        <Link
          href="/dashboard/settings?tab=invoicing"
          className="font-medium text-primary hover:underline"
        >
          Settings → Invoicing
        </Link>
        . It’s the number of days from the day the invoice is created until the payment due date
        shown on the invoice. For example, if you set it to 14, a new invoice will show &quot;Due in
        14 days&quot; (or an equivalent due date). You can change it between 1 and 365. This is the
        default for all new invoices unless a location or other rule overrides it.
      </>
    ),
  },
  {
    id: "bank-transfer-payments",
    question: "How do bank transfer payments work?",
    answer: (
      <>
        In{" "}
        <Link
          href="/dashboard/settings?tab=payment"
          className="font-medium text-primary hover:underline"
        >
          Settings → Payments
        </Link>
        you can add your <strong>BSB and account number</strong> and choose to
        <strong> show bank transfer details on invoices</strong>. When that’s on, customers see your
        bank details on the invoice so they can pay you by transfer. The app does not track whether
        they’ve paid; you update payment status yourself when the money arrives (e.g. from Completed
        Jobs or Invoicing). Including the invoice number in the payment reference helps you match
        payments to invoices.
      </>
    ),
  },
  {
    id: "primary-contact-details",
    question: "What are Primary Contact Email and Phone used for?",
    answer: (
      <>
        <strong>Primary Contact Email</strong> and <strong>Primary Contact Phone</strong> are set in{" "}
        <Link
          href="/dashboard/settings?tab=organization"
          className="font-medium text-primary hover:underline"
        >
          Settings → Organization
        </Link>
        . They are your business contact details, not your sign-in details. The email is used for
        account-related notifications and communications; the phone is shown on invoices so
        customers can contact you. Changing these does not change the email or password you use to
        log in.
      </>
    ),
  },
];

export default function HelpPage() {
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    // Initialize from the URL hash (no effect needed, avoids setState-in-effect lint rule).
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash && faqEntries.some((e) => e.id === hash)) {
      return new Set([hash]);
    }
    return new Set();
  });

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

  // NOTE: If we want to support changing the hash while staying on this page,
  // we can add a window 'hashchange' listener here (without calling setState
  // synchronously inside the effect body).

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          Help & FAQ
        </h1>
        <p className="text-muted-foreground mt-2">
          Answers to common questions about locations, pricing, Settings (invoicing, payments,
          features), and how things work.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Click a question to expand the answer. You can also link to a specific question from
            other pages (e.g. Help #field-based-pricing).
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
