"use client";

import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePricingHistory } from "@/hooks/use-pricing-history";
import type { PricingHistoryEntry } from "@/lib/services/pricing.service";
import { ArrowUpDown, Calendar, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

export function PricingHistory() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [pricingContext, setPricingContext] = useState<
    "all" | "customer" | "worker"
  >("all");
  const [sortBy, setSortBy] = useState<"date" | "field">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { pricingHistoryRefreshToken } = usePricingScope();

  const { historyEntries, loading, error } = usePricingHistory({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    pricingContext: pricingContext === "all" ? undefined : pricingContext,
    refreshToken: pricingHistoryRefreshToken,
  });

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = historyEntries;

    // Filter by pricing context
    if (pricingContext !== "all") {
      filtered = filtered.filter(
        (entry) => entry.pricing_context === pricingContext
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (entry) => new Date(entry.effective_at) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(
        (entry) => new Date(entry.effective_at) <= new Date(dateTo)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortBy === "date") {
        aValue = new Date(a.effective_at).getTime();
        bValue = new Date(b.effective_at).getTime();
      } else {
        aValue = a.field_name;
        bValue = b.field_name;
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [historyEntries, dateFrom, dateTo, pricingContext, sortBy, sortOrder]);

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChangeTypeBadge = (type: PricingHistoryEntry["change_type"]) => {
    switch (type) {
      case "created":
        return <Badge variant="default">Created</Badge>;
      case "updated":
        return <Badge variant="secondary">Updated</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pricing History</CardTitle>
            <CardDescription>
              View all pricing changes over time. Filter by date range and sort
              by field or date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Loading pricing history...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pricing History</CardTitle>
            <CardDescription>
              View all pricing changes over time. Filter by date range and sort
              by field or date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-destructive">
              Error loading pricing history: {error}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing History</CardTitle>
          <CardDescription>
            View all pricing changes over time. Filter by pricing context, date
            range, and sort by field or date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="pricing-context">Pricing Context</Label>
              <select
                id="pricing-context"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={pricingContext}
                onChange={(e) =>
                  setPricingContext(
                    e.target.value as "all" | "customer" | "worker"
                  )
                }
              >
                <option value="all">All</option>
                <option value="customer">Customer Pricing</option>
                <option value="worker">Worker Pricing</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPricingContext("all");
              }}
            >
              Clear Filters
            </Button>
          </div>

          {/* Sort controls */}
          <div className="flex gap-2">
            <Button
              variant={sortBy === "date" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (sortBy === "date") {
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                } else {
                  setSortBy("date");
                  setSortOrder("desc");
                }
              }}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Sort by Date{" "}
              {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
            <Button
              variant={sortBy === "field" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (sortBy === "field") {
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                } else {
                  setSortBy("field");
                  setSortOrder("desc");
                }
              }}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Sort by Field{" "}
              {sortBy === "field" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price Change</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    No pricing history found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.field_name}
                      {entry.option_value && (
                        <div className="text-sm text-muted-foreground">
                          {entry.option_value}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.pricing_context === "worker"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {entry.pricing_context === "worker"
                          ? "Worker"
                          : "Customer"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.location_name ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {entry.location_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Organization default
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.old_price !== undefined &&
                      entry.old_price !== null ? (
                        <div className="text-sm">
                          <span className="text-muted-foreground line-through">
                            {formatPrice(entry.old_price)}
                          </span>
                          <span className="ml-2 font-medium">
                            → {formatPrice(entry.new_price)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">
                          {formatPrice(entry.new_price)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(entry.effective_at)}</TableCell>
                    <TableCell>
                      {entry.expires_at ? formatDate(entry.expires_at) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.changed_by || "System"}
                    </TableCell>
                    <TableCell>
                      {getChangeTypeBadge(entry.change_type)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
