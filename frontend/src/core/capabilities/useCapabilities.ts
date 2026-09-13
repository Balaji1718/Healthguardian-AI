import { useState, useEffect } from "react";
import type { AppCapabilities } from "./types";
import { probeCapabilities } from "./detector";

/**
 * React hook providing reactive, reliable capability discovery across devices and browsers.
 */
export function useCapabilities(hasFcmToken = false): AppCapabilities {
  const [capabilities, setCapabilities] = useState<AppCapabilities>(() =>
    probeCapabilities(hasFcmToken),
  );

  useEffect(() => {
    // Re-probe on mount and update
    setCapabilities(probeCapabilities(hasFcmToken));

    // Listen to pointer/touch changes if dynamic
    if (typeof window === "undefined") return;

    const coarseQuery = window.matchMedia?.("(pointer: coarse)");
    const fineQuery = window.matchMedia?.("(pointer: fine)");
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");

    const handleMediaChange = () => {
      setCapabilities(probeCapabilities(hasFcmToken));
    };

    try {
      coarseQuery?.addEventListener("change", handleMediaChange);
      fineQuery?.addEventListener("change", handleMediaChange);
      standaloneQuery?.addEventListener("change", handleMediaChange);
    } catch {
      // Fallback for older browsers
      coarseQuery?.addListener?.(handleMediaChange);
      fineQuery?.addListener?.(handleMediaChange);
      standaloneQuery?.addListener?.(handleMediaChange);
    }

    return () => {
      try {
        coarseQuery?.removeEventListener("change", handleMediaChange);
        fineQuery?.removeEventListener("change", handleMediaChange);
        standaloneQuery?.removeEventListener("change", handleMediaChange);
      } catch {
        coarseQuery?.removeListener?.(handleMediaChange);
        fineQuery?.removeListener?.(handleMediaChange);
        standaloneQuery?.removeListener?.(handleMediaChange);
      }
    };
  }, [hasFcmToken]);

  return capabilities;
}
