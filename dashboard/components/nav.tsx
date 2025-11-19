"use client";

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
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import Link from "next/link";
import Logo from "./logo";

function Nav() {
  const { isTop } = useIsScrollTop();
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    log.info("Nav: User sign out initiated", {
      userId: user?.id,
      email: user?.email,
    });
    const { error } = await supabase.auth.signOut();
    if (error) {
      log.error("Nav: Sign out failed", { error: error.message });
    } else {
      log.info("Nav: User signed out successfully");
    }
  };

  return (
    <nav
      className={cn(
        "fixed h-24 flex justify-between px-20 py-10 items-center min-w-full bg-secondary  -translate-y-20",
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
            className="bg-secondary rounded-lg text-secondary-foreground py-3 px-4 hover:opacity-50"
          >
            Log in
          </Link>
          <Link
            className="bg-primary rounded-lg text-primary-foreground py-3 px-4 hover:opacity-50"
            href="/signup"
          >
            Create account
          </Link>
        </div>
      ) : (
        // TODO - Fix user nav styling - perhaps asChild (more control?)

        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-full w-full cursor-pointer">
                <Avatar>
                  <AvatarFallback className="w-full text-center uppercase">
                    {user.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </NavigationMenuTrigger>
              <NavigationMenuContent className="">
                <NavigationMenuLink href="/dashboard">
                  Dashboard
                </NavigationMenuLink>
                <NavigationMenuLink onClick={handleSignOut} href="/">
                  Sign out
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        // <Button
        //   onClick={handleSignOut}
        //   className="rounded-full h-10 w-10 flex items-center uppercase cursor-pointer"
        //   title="Sign out"
        // >
        //   <Avatar>
        //     <AvatarFallback>{user.email?.charAt(0)}</AvatarFallback>
        //   </Avatar>
        // </Button>
      )}
    </nav>
  );
}

export default Nav;
