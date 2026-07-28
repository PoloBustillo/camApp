"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CameraTile } from "./camera-tile";
import { GripVertical } from "lucide-react";
import type { CameraViewerItem, PersistedFilters } from "@/types/camera-viewer";

export const SortableCameraTile = memo(function SortableCameraTile({
  camera,
  isEditing,
  onClick,
  filters,
  className,
}: {
  camera: CameraViewerItem;
  isEditing: boolean;
  onClick?: (cam: CameraViewerItem) => void;
  filters?: PersistedFilters | null;
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: camera.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${className ?? ""}`}>
      {isEditing && (
        <button
          type="button"
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 p-1 rounded bg-black/60 text-white/60 hover:text-white cursor-grab active:cursor-grabbing touch-none"
          aria-label="Arrastrar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <CameraTile
        camera={camera}
        streamType="main"
        onClick={isEditing ? undefined : onClick}
        filters={filters}
      />
    </div>
  );
});
