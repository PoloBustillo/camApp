"use client";

import { useCallback, useState } from "react";
import type { CameraViewerItem } from "@/types/camera-viewer";

const PAGE_SIZE = 4; // Max 4 cameras shown simultaneously

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
 * Manages pagination of cameras, max PAGE_SIZE (4) per page.
 * Changing page automatically triggers cleanup of WebRTC connections
 * via React key changes on CameraTile components.
 */
export function useCameraPage(cameras: CameraViewerItem[]): UseCameraPageResult {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(cameras.length / PAGE_SIZE));

  const visibleCameras = cameras.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  return {
    page,
    totalPages,
    visibleCameras,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    goToPage,
    nextPage: () => goToPage(page + 1),
    prevPage: () => goToPage(page - 1),
  };
}
