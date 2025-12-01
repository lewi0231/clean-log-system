"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import useAuth from "@/hooks/useAuth";
import { useIsScrollTop } from "@/hooks/useIsScrollTop";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "./logo";

function Nav() {
  const { isTop } = useIsScrollTop();
  const { user, loading } = useAuth();
  const router = useRouter();

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
        "fixed h-20 flex justify-between px-20 py-10 items-center min-w-full bg-secondary -translate-y-20 transition-all duration-300 z-50",
        isTop ? "translate-y-0 opacity-100" : "opacity-0"
      )}
    >
      <Link href="/">
        <Logo />
      </Link>
      {!user ? (
        <div className={cn("flex gap-4", loading ? "hidden" : "")}>
          <Link
            href="/login"
            className="bg-secondary rounded-lg text-secondary-foreground py-3 px-4 hover:opacity-50 transition-opacity"
          >
            Log in
          </Link>
          <Link
            className="bg-primary rounded-lg text-primary-foreground py-3 px-4 hover:opacity-50 transition-opacity"
            href="/signup"
          >
            Create account
          </Link>
        </div>
      ) : (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-auto rounded-full p-0 cursor-pointer hover:opacity-80 transition-opacity bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent gap-1.5">
                <Avatar className="h-10 w-10 rounded-full bg-primary/10 border-2 border-primary/20 shrink-0">
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary-foreground flex items-center justify-center h-full w-full">
                    {user.email ? (
                      <span className="text-sm font-medium uppercase">
                        {user.email.charAt(0)}
                      </span>
                    ) : (
                      <User className="h-5 w-5 text-primary-foreground" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="min-w-[160px]">
                <NavigationMenuLink href="/dashboard" className="block w-full">
                  Dashboard
                </NavigationMenuLink>
                <NavigationMenuLink
                  onClick={handleSignOut}
                  href="#"
                  className="block w-full cursor-pointer"
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
