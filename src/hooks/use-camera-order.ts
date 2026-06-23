"use client";

import { useCallback, useMemo, useState } from "react";
import type { CameraViewerItem } from "@/types/camera-viewer";

/**
 * Manages per-user camera ordering via server API.
 *
 * Receives the server-side order as `initialOrderIds` (fetched in the dashboard
 * server component). Applies it immediately — no flash of wrong order.
 *
 * - `reorder(from, to)` → PUT /api/user/camera-order (persists to DB)
 * - `resetOrder()` → DELETE /api/user/camera-order (returns to default)
 * - Cameras not in the order are appended at the end.
 */
export function useCameraOrder(
  cameras: CameraViewerItem[],
  initialOrderIds: string[],
) {
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);

  // Use optimistic order if set (for instant UI feedback), otherwise server order
  const activeOrder = optimisticOrder ?? initialOrderIds;

  const orderedCameras = useMemo(() => {
    if (activeOrder.length === 0) return cameras;

    const cameraMap = new Map(cameras.map((c) => [c.id, c]));
    const ordered: CameraViewerItem[] = [];
    const seen = new Set<string>();

    for (const id of activeOrder) {
      const cam = cameraMap.get(id);
      if (cam) {
        ordered.push(cam);
        seen.add(id);
      }
    }

    // Append cameras not in the order (new cameras)
    for (const cam of cameras) {
      if (!seen.has(cam.id)) {
        ordered.push(cam);
      }
    }

    return ordered;
  }, [cameras, activeOrder]);

  const reorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const currentIds = activeOrder.length > 0
        ? activeOrder
        : cameras.map((c) => c.id);

      const next = [...currentIds];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      // Optimistic update — UI changes instantly
      setOptimisticOrder(next);

      try {
        const res = await fetch("/api/user/camera-order", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: next }),
        });
        if (!res.ok) {
          // Revert on failure
          setOptimisticOrder(null);
        }
      } catch {
        setOptimisticOrder(null);
      }
    },
    [cameras, activeOrder],
  );

  const resetOrder = useCallback(async () => {
    setOptimisticOrder([]);

    try {
      const res = await fetch("/api/user/camera-order", { method: "DELETE" });
      if (!res.ok) {
        setOptimisticOrder(null);
      }
    } catch {
      setOptimisticOrder(null);
    }
  }, []);

  const hasCustomOrder = useMemo(() => {
    if (optimisticOrder !== null) return optimisticOrder.length > 0;
    if (initialOrderIds.length === 0) return false;
    const defaultIds = cameras.map((c) => c.id);
    return JSON.stringify(initialOrderIds) !== JSON.stringify(defaultIds);
  }, [optimisticOrder, initialOrderIds, cameras]);

  return { orderedCameras, reorder, resetOrder, hasCustomOrder };
}
