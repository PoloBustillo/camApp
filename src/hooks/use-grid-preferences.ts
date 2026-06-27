"use client";

import { useCallback, useEffect, useState } from "react";

export type GridLayout = "2x2" | "3x3" | "auto";
export type GridFilter = "all" | "favorites";

const STORAGE_KEY = "camwatch-grid-prefs";

interface GridPreferences {
  layout: GridLayout;
  filter: GridFilter;
}

const DEFAULTS: GridPreferences = { layout: "2x2", filter: "all" };

export function getPageSize(layout: GridLayout): number;
export function getPageSize(layout: GridLayout, totalCameras: number): number;
export function getPageSize(layout: GridLayout, totalCameras?: number): number {
  if (layout === "auto") return totalCameras ?? 9;
  return layout === "3x3" ? 9 : 4;
}

export function useGridPreferences() {
  const [prefs, setPrefs] = useState<GridPreferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GridPreferences>;
        const validLayouts: GridLayout[] = ["2x2", "3x3", "auto"];
        setPrefs({
          layout: validLayouts.includes(parsed.layout as GridLayout) ? (parsed.layout as GridLayout) : "2x2",
          filter: parsed.filter === "favorites" ? "favorites" : "all",
        });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: GridPreferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const setLayout = useCallback(
    (layout: GridLayout) =>
      setPrefs((prev) => {
        const next = { ...prev, layout };
        persist(next);
        return next;
      }),
    [persist],
  );

  const setFilter = useCallback(
    (filter: GridFilter) =>
      setPrefs((prev) => {
        const next = { ...prev, filter };
        persist(next);
        return next;
      }),
    [persist],
  );

  return { ...prefs, hydrated, setLayout, setFilter };
}
