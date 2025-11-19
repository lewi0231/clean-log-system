"use client";
import { log } from "@/lib/logger";
import { useEffect, useState } from "react";

export const useIsScrollTop = () => {
  const [isTop, setIsTop] = useState(true);

  useEffect(() => {
    log.debug("useIsScrollTop: Initializing scroll listener");

    const handleScrollTop = () => {
      const scrollY = window.scrollY;
      const newIsTop = scrollY === 0;

      setIsTop((prevIsTop) => {
        if (newIsTop !== prevIsTop) {
          log.debug("useIsScrollTop: Scroll position changed", {
            scrollY,
            isTop: newIsTop,
          });
          return newIsTop;
        }
        return prevIsTop;
      });
    };

    window.addEventListener("scroll", handleScrollTop);

    return () => {
      log.debug("useIsScrollTop: Cleaning up scroll listener");
      window.removeEventListener("scroll", handleScrollTop);
    };
  }, []);

  return { isTop };
};
