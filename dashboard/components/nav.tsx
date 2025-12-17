"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import useAuth from "@/hooks/useAuth";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./logo";

function Nav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Don't show nav on public invoice pages (customer-facing)
  const isPublicInvoicePage = pathname?.startsWith("/invoice/");

  if (isPublicInvoicePage) {
    return null;
  }

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    log.info("Nav: User sign out initiated", {
      userId: user?.id,
      email: user?.email,
    });

    try {
      // Try to sign out globally first
      const { error } = await supabase.auth.signOut();

      // If session_not_found, the session is already invalid - this is fine
      // We'll still clear local state and redirect
      if (error) {
        const errorMessage = error.message?.toLowerCase() || "";
        const errorCode =
          (error as { code?: string }).code?.toLowerCase() || "";

        // Check if it's a session_not_found error (which is acceptable when signing out)
        const isSessionNotFound =
          errorCode === "session_not_found" ||
          errorMessage.includes("session_not_found") ||
          errorMessage.includes(
            "session from session_id claim in jwt does not exist"
          );

        if (isSessionNotFound) {
          log.info(
            "Nav: Session not found (already invalid), proceeding with sign out"
          );
        } else {
          log.error("Nav: Sign out failed", {
            error: error.message,
            code: (error as { code?: string }).code || error.status,
          });
        }
      } else {
        log.info("Nav: User signed out successfully");
      }
    } catch (err) {
      // Catch any unexpected errors but still proceed with sign out
      log.warn("Nav: Sign out encountered an error, proceeding anyway", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      // Always redirect and refresh regardless of error
      // The auth state change listener will handle clearing the user state
      router.push("/");
      router.refresh();
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 h-16 flex justify-between items-center px-4 sm:px-6 lg:px-8",
        "bg-card/95 backdrop-blur-sm border-b border-border",
        "card-shadow z-50"
      )}
    >
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>
      {!user ? (
        <div className={cn("flex gap-3", loading ? "hidden" : "")}>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      ) : (
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-auto rounded-full p-0 cursor-pointer hover:opacity-80 transition-opacity bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent gap-1.5">
                <Avatar className="h-9 w-9 rounded-full bg-primary/10 border-2 border-primary/20 shrink-0">
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary flex items-center justify-center h-full w-full">
                    {user.email ? (
                      <span className="text-sm font-medium uppercase">
                        {user.email.charAt(0)}
                      </span>
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="min-w-[160px] bg-card border border-border rounded-lg card-shadow mt-2 right-0 left-auto">
                <NavigationMenuLink
                  href="/dashboard"
                  className="block w-full px-4 py-2 text-sm rounded-md transition-colors"
                >
                  Dashboard
                </NavigationMenuLink>
                <NavigationMenuLink
                  onClick={handleSignOut}
                  href="#"
                  className="block w-full px-4 py-2 text-sm rounded-md transition-colors cursor-pointer"
                >
                  Sign out
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      )}
    </nav>
  );
}

export default Nav;
