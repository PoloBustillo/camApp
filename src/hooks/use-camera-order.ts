"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CameraViewerItem } from "@/types/camera-viewer";

const STORAGE_KEY = "camwatch-camera-order";

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

function saveOrder(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/**
 * Manages per-user camera ordering via localStorage.
 *
 * - On mount, loads saved order and sorts cameras accordingly.
 * - Cameras not in the saved order are appended at the end.
 * - `reorder(from, to)` moves a camera in the full array and persists.
 * - `resetOrder()` clears localStorage and returns to server order.
 */
export function useCameraOrder(cameras: CameraViewerItem[]) {
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSavedOrder(loadOrder());
    setHydrated(true);
  }, []);

  const orderedCameras = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return cameras;

    const cameraMap = new Map(cameras.map((c) => [c.id, c]));
    const ordered: CameraViewerItem[] = [];
    const seen = new Set<string>();

    for (const id of savedOrder) {
      const cam = cameraMap.get(id);
      if (cam) {
        ordered.push(cam);
        seen.add(id);
      }
    }

    for (const cam of cameras) {
      if (!seen.has(cam.id)) {
        ordered.push(cam);
      }
    }

    return ordered;
  }, [cameras, savedOrder]);

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSavedOrder((prev) => {
        const ids = prev ?? cameras.map((c) => c.id);
        const next = [...ids];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        saveOrder(next);
        return next;
      });
    },
    [cameras],
  );

  const resetOrder = useCallback(() => {
    setSavedOrder(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const hasCustomOrder = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return false;
    const defaultIds = cameras.map((c) => c.id);
    return JSON.stringify(savedOrder) !== JSON.stringify(defaultIds);
  }, [savedOrder, cameras]);

  return { orderedCameras, reorder, resetOrder, hasCustomOrder, hydrated };
}
