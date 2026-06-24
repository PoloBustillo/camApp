"use client";

import { useCallback, useEffect, useState } from "react";
import type { CameraViewerItem } from "@/types/camera-viewer";

export interface UseCameraPageResult {
  page: number;
  totalPages: number;
  visibleCameras: CameraViewerItem[];
  hasNext: boolean;
  hasPrev: boolean;
  goToPage: (p: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

/**
 * Paginates cameras with a configurable page size (4 for 2×2, 9 for 3×3).
 * Page changes remount tiles via React keys → WebRTC connections close cleanly.
 */
export function useCameraPage(
  cameras: CameraViewerItem[],
  pageSize: number,
  resetKey?: string,
): UseCameraPageResult {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(cameras.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleCameras = cameras.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, [totalPages]);

  return {
    page,
    totalPages,
    visibleCameras,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    goToPage,
    nextPage,
    prevPage,
  };
}
