"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface JobDetails {
  id: string;
  completed_at: string;
  location: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  workers: Array<{
    id: string;
    name: string;
  }>;
  hasFeedback: boolean;
}

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!token) {
        setError("Invalid feedback link");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-job-by-token",
          {
            body: { token },
          }
        );

        if (fetchError) {
          setError(
            fetchError.message ||
              "Failed to load job details. Please check your link."
          );
          setLoading(false);
          return;
        }

        if (!data?.success || !data?.job) {
          setError("Invalid or expired feedback link");
          setLoading(false);
          return;
        }

        // Check if feedback already submitted
        if (data.job.hasFeedback) {
          setError("Feedback has already been submitted for this job.");
          setLoading(false);
          return;
        }

        setJobDetails(data.job);
      } catch (err) {
        console.error("Error fetching job details:", err);
        setError("Failed to load job details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      setError("Please select a rating");
      return;
    }

    if (!token) {
      setError("Invalid feedback link");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data, error: submitError } = await supabase.functions.invoke(
        "submit-feedback",
        {
          body: {
            token,
            rating,
            comment: comment.trim() || null,
          },
        }
      );

      if (submitError) {
        setError(
          submitError.message || "Failed to submit feedback. Please try again."
        );
        return;
      }

      if (!data?.success) {
        setError(data?.error || "Failed to submit feedback. Please try again.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-muted-foreground">Loading job details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !jobDetails) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/")} variant="outline">
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-center">Thank You!</CardTitle>
            <CardDescription className="text-center">
              Your feedback has been submitted successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center text-muted-foreground">
              We appreciate you taking the time to share your experience with
              us.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobDetails) {
    return null;
  }

  const displayRating = hoveredRating || rating || 0;

  return (
    <div className="min-h-screen w-full flex justify-center items-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Share Your Feedback</CardTitle>
          <CardDescription>
            We&apos;d love to hear about your experience with our service.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Job Details */}
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm">Service Details</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {jobDetails.location && (
                  <p>
                    <span className="font-medium">Location:</span>{" "}
                    {jobDetails.location.name}
                  </p>
                )}
                <p>
                  <span className="font-medium">Completed:</span>{" "}
                  {formatDate(jobDetails.completed_at)}
                </p>
                {jobDetails.workers.length > 0 && (
                  <p>
                    <span className="font-medium">Workers:</span>{" "}
                    {jobDetails.workers.map((w) => w.name).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Rating */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                How would you rate your experience?{" "}
                <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                    aria-label={`Rate ${star} out of 5`}
                  >
                    <Star
                      className={`h-10 w-10 transition-colors ${
                        star <= displayRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200"
                      }`}
                    />
                  </button>
                ))}
                {rating && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {rating}/5
                  </span>
                )}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label htmlFor="comment" className="text-sm font-medium">
                Additional Comments (Optional)
              </label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                rows={4}
                maxLength={5000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {comment.length}/5000 characters
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !rating}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Your feedback helps us improve our services.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
