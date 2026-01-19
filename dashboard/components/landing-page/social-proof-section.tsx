"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "RivetUp transformed how we manage our car yard detailing. The mobile app means our workers can log jobs on-site, and invoices go out automatically. We've cut our admin time in half.",
    name: "Sarah Chen",
    business: "Auto Detail Pro, Melbourne",
    rating: 5,
  },
  {
    quote: "As a solo operator, I needed something simple that didn't require a team to manage. RivetUp's mobile app lets me complete jobs and send invoices from my phone. Game changer.",
    name: "Mike Thompson",
    business: "Thompson Electrical Services",
    rating: 5,
  },
  {
    quote: "Managing 15 workers across 20 locations used to be chaos. Now with RivetUp, I can see all jobs in real-time, track worker performance, and invoice customers automatically. It's exactly what we needed.",
    name: "Lisa Rodriguez",
    business: "CleanSpace Commercial",
    rating: 5,
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted by Service Businesses Nationwide
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See how RivetUp is helping businesses like yours save time and get paid faster.
          </p>
        </div>

        {/* Statistics */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">100+</div>
            <div className="text-muted-foreground">Service businesses</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">2,500+</div>
            <div className="text-muted-foreground">Jobs completed monthly</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">95%</div>
            <div className="text-muted-foreground">Customer satisfaction</div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="size-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base mb-4 italic">
                  "{testimonial.quote}"
                </CardDescription>
                <div>
                  <CardTitle className="text-sm">{testimonial.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {testimonial.business}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}