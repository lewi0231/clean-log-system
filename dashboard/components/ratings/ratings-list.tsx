"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RatingsSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRatingDimensionLabel } from "@/lib/constants/rating-config";
import type { Feedback } from "@/lib/types";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";

interface RatingsListProps {
  feedback: Feedback[];
  loading: boolean;
  error: string | null;
}

export default function RatingsList({
  feedback,
  loading,
  error,
}: RatingsListProps) {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const filteredFeedback = useMemo(() => {
    if (ratingFilter === null) return feedback;
    return feedback.filter((item) => item.rating === ratingFilter);
  }, [feedback, ratingFilter]);

  const stats = useMemo(() => {
    const total = feedback.length;
    const average =
      total > 0
        ? feedback.reduce((sum, item) => sum + item.rating, 0) / total
        : 0;
    const byRating = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: feedback.filter((item) => item.rating === rating).length,
      percentage:
        total > 0
          ? (feedback.filter((item) => item.rating === rating).length / total) *
            100
          : 0,
    }));

    return { total, average, byRating };
  }, [feedback]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium">{rating}/5</span>
      </div>
    );
  };

  if (loading) {
    return <RatingsSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.average.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.byRating[0].count}</div>
            <p className="text-xs text-muted-foreground">5-Star Reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
          <div className="space-y-3">
            {stats.byRating.map(({ rating, count, percentage }) => (
              <div
                key={rating}
                className="flex items-center gap-4 cursor-pointer hover:opacity-80"
                onClick={() =>
                  setRatingFilter(ratingFilter === rating ? null : rating)
                }
              >
                <div className="flex items-center gap-2 w-20">
                  <span className="text-sm font-medium">{rating}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground w-20 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </div>
                {ratingFilter === rating && (
                  <Badge variant="secondary">Filtered</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rating</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Job Completed</TableHead>
                  <TableHead>Feedback Submitted</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {ratingFilter
                        ? `No ${ratingFilter}-star reviews found.`
                        : "No feedback found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFeedback.map((item) => {
                    // Check if this feedback has multi-dimensional ratings
                    const hasMultiRatings =
                      item.ratings &&
                      typeof item.ratings === "object" &&
                      Object.keys(item.ratings).length > 1;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {hasMultiRatings ? (
                            <div className="space-y-2">
                              {Object.entries(item.ratings || {}).map(
                                ([dimension, rating]) => (
                                  <div
                                    key={dimension}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-xs text-muted-foreground w-24 truncate">
                                      {getRatingDimensionLabel(dimension)}:
                                    </span>
                                    {renderStars(rating as number)}
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            renderStars(item.rating)
                          )}
                        </TableCell>
                        <TableCell>{item.job.location?.name || "-"}</TableCell>
                        <TableCell>
                          {item.job.workers.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {item.job.workers.map((worker) => (
                                <span key={worker.id}>{worker.name}</span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(item.job.completed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(item.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {item.comment ? (
                            <p className="text-sm line-clamp-2">
                              {item.comment}
                            </p>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
