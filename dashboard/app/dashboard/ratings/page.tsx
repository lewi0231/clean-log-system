"use client";

import RatingsList from "@/components/ratings/ratings-list";
import { ErrorState } from "@/components/ui/error-state";
import {
  PageHeaderSkeleton,
  RatingsSkeleton,
} from "@/components/ui/skeleton-loaders";
import { useFeedback } from "@/hooks/use-feedback";
import useOrganization from "@/hooks/useOrganization";

export default function RatingsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { feedback, loading, error } = useFeedback();

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <RatingsSkeleton />
      </>
    );
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Customer Ratings</h1>
        <p className="text-muted-foreground mt-2">
          View and manage customer feedback and ratings
        </p>
      </div>

      <div className="space-y-4">
        <RatingsList feedback={feedback} loading={loading} error={error} />
      </div>
    </>
  );
}
