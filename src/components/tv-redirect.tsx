"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTvBrowser } from "@/lib/device";

export function TvRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isTvBrowser()) {
      router.replace("/tv");
    }
  }, [router]);

  return null;
}
