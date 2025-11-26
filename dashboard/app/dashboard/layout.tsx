import DashboardLayout from "@/components/dashboard-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Clean Log",
  description: "Manage your organization's workers, locations, and jobs",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
