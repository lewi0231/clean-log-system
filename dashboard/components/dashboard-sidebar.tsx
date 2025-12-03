"use client";

import { cn } from "@/lib/utils";
import {
  Building2,
  ChartBar,
  Clipboard,
  DollarSign,
  FileText,
  Settings,
  Smartphone,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
  },
  {
    name: "Locations",
    href: "/dashboard/locations",
    icon: Building2,
  },
  {
    name: "Mobile Application",
    href: "/dashboard/mobile-config",
    icon: Smartphone,
  },
  {
    name: "Completed Jobs",
    href: "/dashboard/completed-jobs",
    icon: Clipboard,
  },
  {
    name: "Ratings",
    href: "/dashboard/ratings",
    icon: Star,
  },
  {
    name: "Pricing",
    href: "/dashboard/pricing",
    icon: DollarSign,
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
    <aside className="w-64 bg-gradient-to-b from-sidebar/95 to-sidebar/90 backdrop-blur-xl border-r border-sidebar-border/50 flex flex-col p-6 gap-8 fixed h-screen overflow-y-auto">
      {/* Logo/Branding Section */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
          <ChartBar className="w-6 h-6 text-white" strokeWidth={3} />
        </div>
        <div>
          <h1 className="text-lg font-bold gradient-text">Clean Log</h1>
          <p className="text-xs text-muted-foreground">Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                isActive
                  ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/50"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.name}</span>
              {isActive && (
                <div className="ml-auto w-2 h-2 bg-sidebar-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
