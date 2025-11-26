"use client";

import { cn } from "@/lib/utils";
import {
  Building2,
  ChartBar,
  Clipboard,
  FileText,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Workers",
    href: "/dashboard/workers",
    icon: Users,
  },
  {
    name: "Locations",
    href: "/dashboard/locations",
    icon: Building2,
  },
  {
    name: "Mobile Config",
    href: "/dashboard/mobile-config",
    icon: Smartphone,
  },
  {
    name: "Completed Jobs",
    href: "/dashboard/completed-jobs",
    icon: Clipboard,
  },
  {
    name: "Invoicing",
    href: "/dashboard/invoicing",
    icon: FileText,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
  {
    name: "Visualizations",
    href: "/dashboard/visualizations",
    icon: ChartBar,
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-lg font-semibold">Dashboard</h2>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
