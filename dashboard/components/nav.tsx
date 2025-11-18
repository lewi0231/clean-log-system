"use client";

import { UseIsScrollTop } from "@/hooks/useIsScrollTop";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Logo from "./logo";

function Nav() {
  const { isTop } = UseIsScrollTop();
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
      <div>
        <Link
          className="bg-primary rounded-lg text-primary-foreground py-3 px-4 hover:opacity-50"
          href="/signup"
        >
          Sign Up
        </Link>
      </div>
    </nav>
  );
}

export default Nav;
