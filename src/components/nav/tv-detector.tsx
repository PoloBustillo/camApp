"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTvBrowser } from "@/lib/device";

/**
 * Client-side TV redirect. Runs on every dashboard page load.
 * If the browser is a TV, redirects to /tv immediately.
 */
export function TvDetector() {
  const router = useRouter();
  useEffect(() => {
    if (isTvBrowser()) {
      console.log("[tv-detector] TV browser detected, redirecting to /tv");
      router.replace("/tv");
    }
  }, [router]);
  return null;
}