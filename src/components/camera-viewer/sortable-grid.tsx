"use client";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableCameraTile } from "./sortable-camera-tile";
import type { CameraViewerItem, PersistedFilters } from "@/types/camera-viewer";

interface SortableGridProps {
  cameras: CameraViewerItem[];
  sortableIds: string[];
  onDragEnd: (event: DragEndEvent) => void;
  onTileClick?: (camera: CameraViewerItem) => void;
  cameraFilters?: Record<string, PersistedFilters>;
  gridCols: string;
}

export function SortableGrid({
  cameras,
  sortableIds,
  onDragEnd,
  onTileClick,
  cameraFilters,
  gridCols,
}: SortableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
          {cameras.map((camera) => (
            <SortableCameraTile
              key={`edit-${camera.id}`}
              camera={camera}
              isEditing
              onClick={onTileClick}
              filters={cameraFilters?.[camera.id]}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
