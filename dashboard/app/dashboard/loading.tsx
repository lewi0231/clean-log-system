import {
  CardSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton-loaders";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </>
  );
}
