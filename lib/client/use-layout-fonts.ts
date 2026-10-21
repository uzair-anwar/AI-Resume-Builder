"use client";

import { useEffect, useState } from "react";
import { fontsLoaded, loadFontsInBrowser } from "@/lib/layout/fonts";

/** Loads PT Serif for exact text measuring (line counters and PDF line layout). */
export function useLayoutFonts(): boolean {
  const [ready, setReady] = useState(() => fontsLoaded());

  useEffect(() => {
    if (ready) return;
    let alive = true;
    loadFontsInBrowser()
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [ready]);

  return ready;
}
