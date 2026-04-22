"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How much does Tally Runner cost?",
    answer:
      "Tally Runner offers three pricing plans: Starter at $39/month for solo operators, Professional at $79/month for small teams (most popular), and Business at $149/month for growing companies. All plans include a 14-day free trial with no credit card required.",
  },
  {
    question: "Can I configure Tally Runner myself—or do I need custom development?",
    answer:
      "You configure everything yourself. Set up job forms, pricing rules, and locations (static sites like car yards or one-off addresses) in your dashboard. No custom builds, no long waits—you're in control from day one.",
  },
  {
    question: "Do my workers need to install an app?",
    answer:
      "The Tally Runner mobile app (coming soon) lets workers complete jobs on their phones with optional offline sync. You can also use the web on any device—phones, tablets, or PCs—with no install. Just sign in and go.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! We offer a 14-day free trial with no credit card required. You can explore all features, set up your job forms, configure pricing rules, and invite workers to test the mobile app.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. You can cancel your subscription at any time with no long-term contracts. Your data remains accessible for 30 days after cancellation, and you can export all your information.",
  },
  {
    question: "How does the mobile app work?",
    answer:
      "The Tally Runner mobile app (coming soon) allows your workers to complete jobs on-site with custom forms tailored to your business. Jobs sync instantly to your dashboard, and invoices are generated automatically. The app works offline and syncs when connection is available.",
  },
  {
    question: "Can I customize job forms for my business?",
    answer:
      "Yes, that's one of Tally Runner's key features. You can create custom job forms with fields like quantities, photos, checklists, time tracking, materials, and signatures. Forms are tailored to your specific industry and services.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most businesses are up and running in 15-30 minutes. Our onboarding wizard guides you through setting up workers, configuring job forms, and establishing pricing rules. Our support team is available if you need help.",
  },
  {
    question: "Can I manage static locations and one-off jobs?",
    answer:
      "Yes. Tally Runner supports both fixed locations (car yards, recurring sites) and one-off job addresses—each with its own pricing and rules. Perfect for businesses that mix recurring customers with ad-hoc jobs.",
  },
  {
    question: "Is Tally Runner good for solo operators?",
    answer:
      "Definitely! Many of our customers are solo operators who love how Tally Runner eliminates paperwork and automates invoicing. The Starter plan is specifically designed for solo businesses.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, MasterCard, American Express) and use Stripe for secure payment processing. Customer payments are processed automatically when invoices are sent.",
  },
  {
    question: "Do you offer annual billing discounts?",
    answer:
      "Yes, we offer a 10% discount for annual billing on all plans. Contact our sales team for annual pricing options.",
  },
];

export function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about getting started with Tally Runner.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border">
              <button
                onClick={() => toggleItem(index)}
                className="flex w-full items-center justify-between py-4 text-left font-medium transition-colors hover:text-primary"
              >
                {faq.question}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    openItems.has(index) && "rotate-180"
                  )}
                />
              </button>
              {openItems.has(index) && (
                <div className="pb-4 text-muted-foreground">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-muted-foreground">
            Still have questions?{" "}
            <a href="/contact" className="text-primary hover:underline">
              Contact our support team
            </a>{" "}
            and we&apos;ll be happy to help.
          </p>
        </div>
      </div>
    </section>
  );
}
